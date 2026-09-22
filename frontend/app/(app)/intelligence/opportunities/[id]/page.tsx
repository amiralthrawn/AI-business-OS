import Link from "next/link";
import { notFound } from "next/navigation";
import CreateTaskButton from "@/components/actions/CreateTaskButton";
import ContactCard from "@/components/data/ContactCard";
import ReasoningTrail from "@/components/intelligence/ReasoningTrail";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { getHomeView, getOpportunity } from "@/lib/api";
import { entityHref, findPriorityFor, resolveEntityWithContact } from "@/lib/related-entity";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = { open: "ouverte", acknowledged: "prise en compte", pursued: "engagée", dismissed: "écartée" };
const ENTITY_LABEL: Record<string, string> = { supplier: "fournisseur", customer: "client", product: "produit", transaction: "transaction", company: "entreprise" };
const CONFIDENCE_LABEL: Record<string, string> = { low: "faible", medium: "moyenne", high: "élevée" };

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let opportunity;
  try {
    opportunity = await getOpportunity(id);
  } catch {
    notFound();
  }

  const [home, related] = await Promise.all([
    getHomeView().catch(() => null),
    resolveEntityWithContact(opportunity.related_entity_type, opportunity.related_entity_id),
  ]);
  const entityName = related.name;

  const priority = home ? findPriorityFor(home, "opportunity", opportunity.id) : null;
  const href = opportunity.related_entity_type ? entityHref(opportunity.related_entity_type, opportunity.related_entity_id ?? "") : null;

  return (
    <main className="mx-auto max-w-3xl space-y-8 p-8 md:p-12">
      <Link href="/intelligence/opportunities" className="text-[13px] text-text-faint hover:text-text">
        &larr; Retour aux opportunités
      </Link>

      <div className="animate-reveal flex items-start justify-between gap-4">
        <div>
          <Badge label="Opportunité" tone="success" />
          <h1 className="mt-2 font-display text-[28px] italic text-text">{opportunity.title}</h1>
          <div className="mt-3">
            <ReasoningTrail kind="opportunity" />
          </div>
        </div>
        <CreateTaskButton
          defaultTitle={opportunity.title}
          relatedEntityType={opportunity.related_entity_type ?? undefined}
          relatedEntityId={opportunity.related_entity_id ?? undefined}
        />
      </div>

      {related.contact && entityName && opportunity.related_entity_type && (
        <ContactCard contact={related.contact} entityName={entityName} entityType={opportunity.related_entity_type} entityId={opportunity.related_entity_id!} />
      )}

      <Card className="p-7">
        <span className="text-[11.5px] font-bold tracking-wide text-text-faint uppercase">Analyse de l&rsquo;IA</span>
        <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-text">
          {priority?.explanation ?? opportunity.description ?? "Aucun détail supplémentaire enregistré pour cette opportunité."}
        </p>
        {priority?.recommendation && (
          <p className="mt-3 text-[13.5px] text-text-soft">
            <span className="font-semibold text-text">Recommandation&nbsp;: </span>
            {priority.recommendation}
          </p>
        )}
        {priority && <p className="mt-3 text-[12px] text-text-faint">confiance {CONFIDENCE_LABEL[priority.confidence] ?? priority.confidence}</p>}
      </Card>

      <div className="grid gap-5 sm:grid-cols-2">
        <Card className="p-6">
          <p className="text-[13px] text-text-soft">Statut</p>
          <p className="mt-1.5 text-[14.5px] font-semibold text-text">{STATUS_LABEL[opportunity.status] ?? opportunity.status}</p>
        </Card>
        {opportunity.related_entity_type && (
          <Card className="p-6">
            <p className="text-[13px] text-text-soft">Entité concernée</p>
            {href && entityName ? (
              <Link href={href} className="mt-1.5 block text-[14.5px] font-semibold text-accent-strong hover:underline">
                {entityName}
              </Link>
            ) : (
              <p className="mt-1.5 text-[14.5px] font-semibold text-text">{ENTITY_LABEL[opportunity.related_entity_type] ?? opportunity.related_entity_type}</p>
            )}
          </Card>
        )}
      </div>
    </main>
  );
}
