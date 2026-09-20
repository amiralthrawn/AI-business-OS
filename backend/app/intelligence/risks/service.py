import uuid

from sqlalchemy.orm import Session

from app.core.entities import Product, RelatedEntityType, Risk, RiskStatus
from app.core.events.bus import EventBus
from app.core.events.business_event import BusinessEvent
from app.intelligence.risks.rule import is_significant_cost_increase, severity_for_cost_increase

RISK_CREATED = "RiskCreated"


class RiskDetectionService:
    """Applies deterministic Intelligence rules to Business Events and
    materializes Risk records in the Data Core when a rule is triggered. Holds
    no data of its own beyond what it writes to the shared Risk table."""

    def __init__(self, session: Session, event_bus: EventBus) -> None:
        self.session = session
        self.event_bus = event_bus

    def evaluate_supplier_cost_increase(self, event: BusinessEvent) -> Risk | None:
        # Idempotence at the persistence level: even if this handler somehow ran
        # twice for the same source event (bus restart, manual replay from the
        # Event Log, ...), it must never create a second Risk for it.
        already_created = self.session.query(Risk).filter_by(source_event_id=event.event_id).first()
        if already_created is not None:
            return None

        variation_pct = event.payload["variation_pct"]
        if not is_significant_cost_increase(variation_pct):
            return None

        product_id = uuid.UUID(event.payload["product_id"])
        supplier_id = uuid.UUID(event.payload["supplier_id"])
        old_unit_cost = event.payload["old_unit_cost"]
        new_unit_cost = event.payload["new_unit_cost"]

        product = self.session.get(Product, product_id)
        if product is None:
            # Data inconsistency (the product Procurement just updated is gone) --
            # nothing meaningful to attach a Risk to, so skip rather than crash
            # the caller that published the event.
            return None

        risk = Risk(
            company_id=product.company_id,
            title=f"Supplier cost increase of {variation_pct:.0%} on product {product.name}",
            description=(
                f"Unit cost rose from {old_unit_cost} to {new_unit_cost} "
                f"({variation_pct:.1%}), detected from event {event.event_id}."
            ),
            severity=severity_for_cost_increase(variation_pct),
            status=RiskStatus.OPEN,
            related_entity_type=RelatedEntityType.SUPPLIER,
            related_entity_id=supplier_id,
            source_event_id=event.event_id,
        )
        self.session.add(risk)
        self.session.commit()

        self.event_bus.publish(
            BusinessEvent(
                event_type=RISK_CREATED,
                source="intelligence",
                correlation_id=event.correlation_id,
                payload={
                    "risk_id": str(risk.id),
                    "source_event_id": str(event.event_id),
                    "supplier_id": str(supplier_id),
                    "product_id": str(product_id),
                    "severity": risk.severity.value,
                },
            )
        )
        return risk
