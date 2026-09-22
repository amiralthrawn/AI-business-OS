"""AIOrchestrator: routes a user question to a SET of relevant domain agents
using simple, deterministic keyword rules (never a single agent gating all
access), resolves which Supplier/Product/Customer the question refers to with
a plain substring match against the Data Core (no ML, no embeddings, no RAG),
executes the union of those agents' declared capabilities that apply to the
resolved entities, and hands the merged structured results to an LLM for
interpretation and natural-language synthesis only.

Cross-domain reasoning (step 12): a question about "margin" pulls in Finance,
Procurement AND Sales capabilities in one pass, because margin genuinely
depends on all three -- this is what lets "Why is our margin declining on
Product X?" be answered without anyone telling the system which domains to
check. Simpler single-topic questions ("What is our supplier for X?") still
only touch one agent's capabilities, unchanged from before.

Cross-domain reasoning with no named entity (step 18): "Why is our margin
declining?" -- with no Product/Supplier/Customer named at all -- still
matches the same multi-agent topic, but there's nothing to resolve directly.
`_handle_cross_domain_request` falls back to the Business State Snapshot
(the same mechanism the broad "what deserves my attention?" path already
used) to find which entities are actually significant within the matched
domain(s), then drills into each with the same targeted capability dispatch
a named question would use. This is what keeps a domain-only question from
ever needing to scan the whole Data Core, and what makes "insufficient data"
a clean, explicit error instead of a guess.

The LLM never touches SQLAlchemy or the database: it only ever sees the JSON
context this module builds for it, and it is never asked to compute a number
or decide a Task's status. One routing pass, one round of capability calls
per relevant area, one LLM call -- no tool-calling loop, no retries, no
capability outside what some agent declares.
"""

import json
import uuid
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.ai.agents import AGENTS, Agent
from app.ai.capabilities.base import CapabilityError
from app.ai.capabilities.registry import CapabilityRegistry
from app.ai.llm import DeterministicLLMClient, LLMClient
from app.core.entities import Customer, Product, RelatedEntityType, Supplier
from app.core.events.bus import EventBus


class OrchestratorError(Exception):
    """A clean, expected failure: nothing to route to, nothing to resolve, a
    capability rejected its input, or the LLM is unavailable. Distinct from an
    unexpected bug, and always safe to surface as a 400 to the caller."""


@dataclass
class AskAIResult:
    answer: str
    agent: str
    capabilities_used: list[str]
    context: dict = field(default_factory=dict)
    requires_human_validation: bool = False
    action_result: dict | None = None


# Deliberately simple, deterministic keyword routing -- no ML classifier.
# "margin" is its own topic (not folded into "finance") because a margin
# question genuinely needs Procurement and Sales context too, not just Finance.
# French synonyms sit alongside the English ones (Step 26: the frontend is
# now entirely in French) -- purely additive, same matching logic, so every
# English phrasing that worked before still works identically.
_TOPIC_KEYWORDS: dict[str, tuple[str, ...]] = {
    "margin": ("margin", "marge"),
    "finance": ("revenue", "profit", "finance", "cash", "chiffre d'affaires", "revenu", "trésorerie"),
    "procurement": ("supplier", "vendor", "procurement", "purchase", "cost", "fournisseur", "achat", "coût"),
    "sales": ("customer", "client", "churn", "pipeline", "sales", "vente", "ventes"),
}
_TOPIC_AGENTS: dict[str, tuple[str, ...]] = {
    "margin": ("finance", "procurement", "sales"),
    "finance": ("finance",),
    "procurement": ("procurement",),
    "sales": ("sales",),
}

_PRIORITIES_KEYWORDS = ("attention", "mérite", "merite", "priorit", "urgent")
_TASK_CREATION_VERBS = ("create", "crée", "créer", "creer", "add")
_TASK_CREATION_NOUNS = ("task", "tâche", "tache")


def _is_task_creation_request(question: str) -> bool:
    lowered = question.lower()
    return any(v in lowered for v in _TASK_CREATION_VERBS) and any(n in lowered for n in _TASK_CREATION_NOUNS)


def _is_priorities_request(question: str) -> bool:
    lowered = question.lower()
    return any(keyword in lowered for keyword in _PRIORITIES_KEYWORDS)


def _match_agents_for_topics(question: str) -> list[Agent]:
    """Returns the deduplicated, deterministically-ordered set of agents whose
    domains are relevant to the question -- possibly more than one."""

    lowered = question.lower()
    matched_topics = [
        topic for topic, keywords in _TOPIC_KEYWORDS.items() if any(k in lowered for k in keywords)
    ]
    if not matched_topics:
        raise OrchestratorError(
            "Could not determine which business area this question relates to. Try mentioning "
            "a supplier/product (procurement), margin/revenue (finance) or a customer (sales)."
        )

    agent_names: list[str] = []
    for topic in matched_topics:
        for agent_name in _TOPIC_AGENTS[topic]:
            if agent_name not in agent_names:
                agent_names.append(agent_name)
    return [AGENTS[name] for name in agent_names]


def _agent_with_capability(capability_name: str) -> Agent | None:
    """Action requests are routed by capability, not topic keywords: whichever
    agent declares `create_task` handles it, regardless of wording."""
    for agent in AGENTS.values():
        if capability_name in agent.capability_names:
            return agent
    return None


def _resolve_supplier(session: Session, question: str) -> Supplier | None:
    lowered = question.lower()
    for supplier in session.query(Supplier).all():
        if supplier.name.lower() in lowered:
            return supplier
    return None


def _resolve_product(session: Session, question: str) -> Product | None:
    lowered = question.lower()
    for product in session.query(Product).all():
        if product.name.lower() in lowered:
            return product
    return None


def _resolve_customer(session: Session, question: str) -> Customer | None:
    lowered = question.lower()
    for customer in session.query(Customer).all():
        if customer.name.lower() in lowered:
            return customer
    return None


def _resolve_entity_by_ref(
    session: Session, entity_type: str | None, entity_id
) -> tuple[Supplier | None, Product | None, Customer | None]:
    """The inverse of the three _resolve_* functions above: given a
    (type, id) reference (as carried by a SnapshotArea, JSON-serialized as a
    plain string), loads the actual row so the same targeted-capability
    dispatch used for a named question can run for an area the Snapshot
    identified instead."""

    if entity_id is None:
        return None, None, None
    if isinstance(entity_id, str):
        entity_id = uuid.UUID(entity_id)
    if entity_type == "supplier":
        return session.get(Supplier, entity_id), None, None
    if entity_type == "product":
        product = session.get(Product, entity_id)
        supplier = session.get(Supplier, product.supplier_id) if product and product.supplier_id else None
        return supplier, product, None
    if entity_type == "customer":
        return None, None, session.get(Customer, entity_id)
    return None, None, None


def _fmt_eur(value: float | None) -> str:
    if value is None:
        return "montant inconnu"
    return f"{value:,.0f} €".replace(",", " ")


def _fmt_pct(value: float | None) -> str:
    if value is None:
        return "taux inconnu"
    return f"{value * 100:.1f} %".replace(".", ",")


_TREND_LABEL_FR = {
    "deteriorating": "en dégradation",
    "declining": "en déclin",
    "improving": "en amélioration",
    "growing": "en croissance",
    "stable": "stable",
    "insufficient_data": "données insuffisantes",
}


def _summarize_capability_result(name: str, data: dict) -> str | None:
    """One French sentence for a single capability's real result -- the
    building block of `_deterministic_answer` below. Returns `None` for a
    capability this function doesn't know how to summarize (e.g.
    `create_task`, which is an action, not a fact to report)."""

    if name in ("read_supplier",) and "name" in data:
        country = f" ({data['country']})" if data.get("country") else ""
        return f"Fournisseur {data['name']}{country} — {data.get('product_count', 0)} produit(s) référencé(s)."
    if name == "read_customer" and "name" in data:
        country = f" ({data['country']})" if data.get("country") else ""
        return f"Client {data['name']}{country}."
    if name == "read_product" and "name" in data:
        sku = f" ({data['sku']})" if data.get("sku") else ""
        return f"Produit {data['name']}{sku}, coût unitaire {_fmt_eur(data.get('unit_cost'))}."
    if name == "analyze_margin":
        return (
            f"Marge actuelle : {_fmt_pct(data.get('margin_percentage'))} "
            f"(coût {_fmt_eur(data.get('cost'))}, revenu {_fmt_eur(data.get('revenue'))})."
        )
    if name == "analyze_supplier_performance":
        return f"Performance de livraison du fournisseur : {_TREND_LABEL_FR.get(data.get('trend'), data.get('trend'))}."
    if name == "analyze_customer_value":
        return f"Tendance de revenu du client : {_TREND_LABEL_FR.get(data.get('trend'), data.get('trend'))}."
    if name == "read_transactions" and "transactions" in data:
        return f"{len(data['transactions'])} transaction(s) récente(s) consultée(s)."
    if name == "get_business_state_snapshot":
        areas = data.get("material_areas") or []
        if not areas:
            return "Aucun signal significatif détecté dans le périmètre surveillé."
        titles = " ; ".join(a.get("title", "") for a in areas[:3] if a.get("title"))
        return f"{len(areas)} signal(aux) détecté(s) : {titles}."
    if name == "list_priorities":
        priorities = data.get("priorities") or []
        if not priorities:
            return "Aucune priorité ouverte pour l'instant."
        titles = " ; ".join(p.get("title", "") for p in priorities[:3] if p.get("title"))
        return f"{len(priorities)} priorité(s) : {titles}."
    return None


def _deterministic_answer(context: dict) -> str:
    """A clean, honest French summary built directly from the same
    structured capability results an LLM would have received -- used only
    when no real LLM is configured (see app.ai.llm.DeterministicLLMClient),
    so Ask AI never shows a raw JSON/prompt dump in place of an answer
    (Step 27). A real LLM, once configured, replaces this with its own
    free-text synthesis; this is not a second intelligence layer, just this
    one call's fallback when there is no LLM to call."""

    lines = [
        summary
        for capability_name, data in context.items()
        if isinstance(data, dict) and (summary := _summarize_capability_result(capability_name, data))
    ]
    if not lines:
        return (
            "Les données ont été consultées, mais aucun modèle de langage n'est configuré pour en "
            "rédiger une synthèse. Consultez la page Finance, Achats ou Ventes correspondante pour le détail complet."
        )
    return "\n".join(lines)


class AIOrchestrator:
    def __init__(self, session: Session, registry: CapabilityRegistry, llm: LLMClient, event_bus: EventBus) -> None:
        self.session = session
        self.registry = registry
        self.llm = llm
        self.event_bus = event_bus

    def ask(self, question: str) -> AskAIResult:
        if not question or not question.strip():
            raise OrchestratorError("Question must not be empty.")

        if _is_task_creation_request(question):
            return self._handle_action_request(question)
        if _is_priorities_request(question):
            return self._handle_priorities_request(question)
        return self._handle_analytical_request(question)

    # -- Action proposal (unchanged from step 10/11) -----------------------

    def _handle_action_request(self, question: str) -> AskAIResult:
        agent = _agent_with_capability("create_task")
        if agent is None:
            raise OrchestratorError("No agent is currently able to create tasks.")

        supplier = _resolve_supplier(self.session, question)
        product = _resolve_product(self.session, question)
        if product is not None and supplier is None and product.supplier_id is not None:
            supplier = self.session.get(Supplier, product.supplier_id)

        if supplier is None and product is None:
            raise OrchestratorError("Could not identify which supplier or product this question refers to.")

        context: dict[str, dict] = {}
        capabilities_used: list[str] = []

        if "read_supplier" in agent.capability_names and supplier is not None:
            self._call(context, capabilities_used, "read_supplier", supplier_id=supplier.id)
        if "read_product" in agent.capability_names and product is not None:
            self._call(context, capabilities_used, "read_product", product_id=product.id)

        target_name = supplier.name if supplier is not None else product.name  # type: ignore[union-attr]
        company_id = supplier.company_id if supplier is not None else product.company_id  # type: ignore[union-attr]
        related_entity_type = RelatedEntityType.SUPPLIER if supplier is not None else RelatedEntityType.PRODUCT
        related_entity_id = supplier.id if supplier is not None else product.id  # type: ignore[union-attr]

        action_result = self._call(
            context,
            capabilities_used,
            "create_task",
            company_id=company_id,
            title=f"Review supplier {target_name}" if supplier is not None else f"Review product {target_name}",
            description=f'Requested via Ask AI: "{question}"',
            related_entity_type=related_entity_type,
            related_entity_id=related_entity_id,
            correlation_id=uuid.uuid4(),
            agent=agent.name,
        )

        answer = self._complete(
            agent_label=agent.name,
            question=question,
            context=context,
            system_prompt=(
                f"You are the {agent.name} assistant inside an AI Business OS. "
                "A Task has been proposed from the structured data below and is PENDING "
                "human validation -- it has NOT been executed and no external action has "
                "been taken. Confirm what was proposed and state plainly that a human "
                "must validate it before anything happens."
            ),
        )

        return AskAIResult(
            answer=answer,
            agent=agent.name,
            capabilities_used=capabilities_used,
            context=context,
            requires_human_validation=True,
            action_result=action_result,
        )

    # -- "What deserves my attention?" (broad/proactive path) ----------------

    def _handle_priorities_request(self, question: str) -> AskAIResult:
        """The "large/proactive question" path: consult the Business State
        Snapshot to identify which areas are significant enough to be worth
        looking at, then drill into the single most significant one with the
        same targeted capabilities a named question would have used --
        rather than either loading everything or answering with only the
        summary counts. See brain/business_state.md."""

        agent = AGENTS["priorities"]
        context: dict[str, dict] = {}
        capabilities_used: list[str] = []

        self._call(context, capabilities_used, "list_priorities")
        snapshot = self._call(context, capabilities_used, "get_business_state_snapshot")

        material_areas = snapshot.get("material_areas", [])
        if material_areas:
            top_area = material_areas[0]
            supplier, product, customer = _resolve_entity_by_ref(
                self.session, top_area.get("entity_type"), top_area.get("entity_id")
            )
            area_agents = [AGENTS[name] for name in _TOPIC_AGENTS.get(top_area["domain"], ())]
            self._dispatch_targeted_capabilities(area_agents, supplier, product, customer, context, capabilities_used)

        answer = self._complete(
            agent_label=agent.name,
            question=question,
            context=context,
            system_prompt=(
                "You are the priorities assistant inside an AI Business OS. Summarize what "
                "deserves attention today strictly from the structured data below -- the open "
                "Risks and Opportunities, how many Tasks are pending validation, and the "
                "detailed data gathered for the most significant area, if any. Never invent an "
                "item that is not present in the data."
            ),
        )

        return AskAIResult(answer=answer, agent=agent.name, capabilities_used=capabilities_used, context=context)

    # -- Cross-domain analytical questions -----------------------------------

    def _handle_analytical_request(self, question: str) -> AskAIResult:
        agents = _match_agents_for_topics(question)

        supplier = _resolve_supplier(self.session, question)
        product = _resolve_product(self.session, question)
        customer = _resolve_customer(self.session, question)
        if product is not None and supplier is None and product.supplier_id is not None:
            supplier = self.session.get(Supplier, product.supplier_id)

        if supplier is None and product is None and customer is None:
            # No named entity to resolve -- this is a genuinely cross-domain
            # question (e.g. "Why is our margin declining?", matching several
            # topics/agents but naming no specific supplier/product/customer).
            # Falls back to the Snapshot to find WHICH entities are actually
            # significant in the matched domain(s), rather than either
            # failing outright or scanning the whole Data Core.
            return self._handle_cross_domain_request(question, agents)

        context: dict[str, dict] = {}
        capabilities_used: list[str] = []
        self._dispatch_targeted_capabilities(agents, supplier, product, customer, context, capabilities_used)

        if not capabilities_used:
            raise OrchestratorError(
                "None of the relevant agents had a capability that applies to what was resolved "
                "from this question."
            )

        agent_label = ", ".join(sorted({a.name for a in agents}))

        answer = self._complete(
            agent_label=agent_label,
            question=question,
            context=context,
            system_prompt=(
                f"You are the {agent_label} assistant inside an AI Business OS. "
                "Answer the user's question strictly from the structured data below, which may "
                "combine several business domains. Never invent a number that is not present in "
                "the data. If the data shows a limitation (e.g. margin could not be computed), "
                "say so plainly."
            ),
        )

        return AskAIResult(answer=answer, agent=agent_label, capabilities_used=capabilities_used, context=context)

    # -- Cross-domain questions with no named entity (broader than one row) --

    def _handle_cross_domain_request(self, question: str, agents: list[Agent]) -> AskAIResult:
        """A question that spans several domains (e.g. "Why is our margin
        declining?") but doesn't name a specific supplier/product/customer to
        resolve directly. Consults the Business State Snapshot -- exactly
        the same mechanism the broad "what deserves my attention?" path uses
        -- to identify WHICH entities are actually significant within the
        matched domain(s), then drills into each with the same targeted
        capability dispatch a named question would use. This is what keeps
        the Orchestrator from ever scanning the whole Data Core: it only
        ever looks at entities the Snapshot already flagged as material."""

        matched_domains = {a.name for a in agents}
        context: dict[str, dict] = {}
        capabilities_used: list[str] = []

        snapshot = self._call(context, capabilities_used, "get_business_state_snapshot")
        relevant_areas = [a for a in snapshot.get("material_areas", []) if a.get("domain") in matched_domains]

        if not relevant_areas:
            raise OrchestratorError(
                "Not enough significant data was found across the relevant business area(s) "
                f"({', '.join(sorted(matched_domains))}) to answer this yet."
            )

        # Each area gets its own scratch dict/list for _dispatch_targeted_
        # capabilities, then is merged under its own namespaced key -- unlike
        # every other caller of _call (which only ever resolves one entity
        # per request), several areas here can legitimately need the SAME
        # capability for DIFFERENT entities (e.g. analyze_margin for two
        # different products), and _call's cache is keyed by capability name
        # alone. Keeping each area's results in its own dict sidesteps that
        # collision entirely, without changing _call's simple, existing
        # single-entity-per-request contract for every other path.
        for area in relevant_areas:
            supplier, product, customer = _resolve_entity_by_ref(
                self.session, area.get("entity_type"), area.get("entity_id")
            )
            area_agents = [AGENTS[name] for name in _TOPIC_AGENTS.get(area["domain"], ())]
            area_context: dict[str, dict] = {}
            area_capabilities: list[str] = []
            self._dispatch_targeted_capabilities(area_agents, supplier, product, customer, area_context, area_capabilities)
            if area_context:
                # SnapshotAreaOutput carries a title but no entity_name, so
                # the title (already descriptive, e.g. "Margin deterioration
                # on product Steel Frame Assembly") is what disambiguates
                # areas sharing the same domain.
                context[f"{area['domain']}: {area.get('title')}"] = area_context
                capabilities_used.extend(c for c in area_capabilities if c not in capabilities_used)

        agent_label = ", ".join(sorted(matched_domains))

        answer = self._complete(
            agent_label=agent_label,
            question=question,
            context=context,
            system_prompt=(
                f"You are the {agent_label} assistant inside an AI Business OS. This question spans "
                "multiple business areas and names no single entity, so the data below combines the "
                "Business State Snapshot's most significant areas across those domains, each enriched "
                "with targeted details. Synthesize ONE coherent answer strictly from that data -- never "
                "invent a number that is not present in it -- and explicitly connect findings across "
                "domains where the data supports it (e.g. a supplier cost increase alongside a margin "
                "drop on the product it supplies)."
            ),
        )

        return AskAIResult(answer=answer, agent=agent_label, capabilities_used=capabilities_used, context=context)

    # -- Shared helpers -------------------------------------------------------

    def _dispatch_targeted_capabilities(
        self,
        agents: list[Agent],
        supplier: Supplier | None,
        product: Product | None,
        customer: Customer | None,
        context: dict,
        capabilities_used: list[str],
    ) -> None:
        """Calls whichever of the given agents' declared capabilities apply to
        the resolved entities. Shared by the named-entity analytical path and
        the Snapshot-driven proactive path so there is exactly one place that
        decides "which capability for which resolved entity" -- reusing it is
        also how the Snapshot's drill-down is guaranteed to only ever call a
        capability some Agent actually declares, same as any other question.
        """

        for agent in agents:
            names = set(agent.capability_names)
            if "read_supplier" in names and supplier is not None:
                self._call(context, capabilities_used, "read_supplier", supplier_id=supplier.id)
            if "read_product" in names and product is not None:
                self._call(context, capabilities_used, "read_product", product_id=product.id)
            if "read_customer" in names and customer is not None:
                self._call(context, capabilities_used, "read_customer", customer_id=customer.id)
            if "read_transactions" in names:
                if product is not None:
                    self._call(context, capabilities_used, "read_transactions", product_id=product.id)
                elif customer is not None:
                    self._call(context, capabilities_used, "read_transactions", customer_id=customer.id)
                elif supplier is not None:
                    self._call(context, capabilities_used, "read_transactions", supplier_id=supplier.id)
            if "analyze_margin" in names and product is not None:
                self._call(context, capabilities_used, "analyze_margin", product_id=product.id)
            if "analyze_supplier_performance" in names and supplier is not None:
                self._call(context, capabilities_used, "analyze_supplier_performance", supplier_id=supplier.id)
            if "analyze_customer_value" in names and customer is not None:
                self._call(context, capabilities_used, "analyze_customer_value", customer_id=customer.id)

    def _call(self, context: dict, capabilities_used: list[str], name: str, **kwargs) -> dict:
        if name in capabilities_used:
            # Already gathered for this request (e.g. two matched agents both
            # declare read_transactions) -- the underlying data is the same
            # regardless of which agent asked for it.
            return context[name]

        capability = self.registry.get(name)
        try:
            result = capability.run(self.session, event_bus=self.event_bus, **kwargs)
        except CapabilityError as exc:
            raise OrchestratorError(str(exc)) from exc
        dumped = result.model_dump(mode="json")
        context[name] = dumped
        capabilities_used.append(name)
        return dumped

    def _complete(self, agent_label: str, question: str, context: dict, system_prompt: str) -> str:
        if isinstance(self.llm, DeterministicLLMClient):
            return _deterministic_answer(context)
        try:
            return self.llm.complete(
                system_prompt=system_prompt,
                user_prompt=f"Question: {question}\n\nData:\n{json.dumps(context, indent=2)}",
            )
        except Exception as exc:
            raise OrchestratorError("The language model is currently unavailable. Please try again later.") from exc
