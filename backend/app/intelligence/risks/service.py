import uuid

from sqlalchemy.orm import Session

from app.core.analytics import compute_customer_value_trend, compute_margin_trend, compute_supplier_delivery_performance
from app.core.entities import Customer, Product, RelatedEntityType, Risk, RiskSeverity, RiskStatus, Supplier
from app.core.events.bus import EventBus
from app.core.events.business_event import BusinessEvent
from app.intelligence.risks.rule import is_significant_cost_increase, severity_for_cost_increase

RISK_CREATED = "RiskCreated"
MARGIN_DETERIORATED = "MarginDeteriorated"
SUPPLIER_PERFORMANCE_DETERIORATED = "SupplierPerformanceDeteriorated"
CUSTOMER_DECLINE_DETECTED = "CustomerDeclineDetected"


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

    def _has_open_risk_of_kind(self, title_prefix: str, related_entity_type: RelatedEntityType, related_entity_id) -> bool:
        """Idempotence for monitoring-triggered rules: unlike the reactive
        SupplierCostIncreased handler, a monitoring sweep has no single
        upstream event_id to dedupe against (it can be re-run at any time on
        unchanged data), so instead it checks whether an OPEN Risk of the same
        kind already exists for the same entity before creating another one."""

        return (
            self.session.query(Risk)
            .filter(
                Risk.related_entity_type == related_entity_type,
                Risk.related_entity_id == related_entity_id,
                Risk.status == RiskStatus.OPEN,
                Risk.title.like(f"{title_prefix}%"),
            )
            .first()
            is not None
        )

    def evaluate_margin_trend(self, product_id: uuid.UUID) -> Risk | None:
        """Proactive (monitoring-triggered, not event-triggered) margin
        deterioration detection: compares recent vs baseline margin computed
        from real purchase and sales Transactions -- no LLM, no estimate."""

        product = self.session.get(Product, product_id)
        if product is None:
            return None

        trend = compute_margin_trend(self.session, product_id)
        if trend.trend != "deteriorating":
            return None

        title = f"Margin deterioration on product {product.name}"
        if self._has_open_risk_of_kind("Margin deterioration", RelatedEntityType.PRODUCT, product_id):
            return None

        signal_event = BusinessEvent(
            event_type=MARGIN_DETERIORATED,
            source="intelligence",
            payload={
                "product_id": str(product_id),
                "baseline_margin_pct": trend.baseline_margin_pct,
                "recent_margin_pct": trend.recent_margin_pct,
                "point_change": trend.point_change,
            },
        )
        self.event_bus.publish(signal_event)

        risk = Risk(
            company_id=product.company_id,
            title=title,
            description=(
                f"Margin moved from {trend.baseline_margin_pct:.1%} to {trend.recent_margin_pct:.1%} "
                f"({trend.point_change:+.1%} pts) based on recent purchase and sales transactions."
            ),
            severity=RiskSeverity.HIGH if trend.point_change <= -0.10 else RiskSeverity.MEDIUM,
            status=RiskStatus.OPEN,
            related_entity_type=RelatedEntityType.PRODUCT,
            related_entity_id=product_id,
            source_event_id=signal_event.event_id,
        )
        self.session.add(risk)
        self.session.commit()

        self.event_bus.publish(
            BusinessEvent(
                event_type=RISK_CREATED,
                source="intelligence",
                correlation_id=signal_event.correlation_id,
                payload={
                    "risk_id": str(risk.id),
                    "source_event_id": str(signal_event.event_id),
                    "product_id": str(product_id),
                    "severity": risk.severity.value,
                },
            )
        )
        return risk

    def evaluate_supplier_delivery_performance(self, supplier_id: uuid.UUID) -> Risk | None:
        """Proactive supplier delivery performance monitoring: compares recent
        vs baseline average delay and on-time rate from real Transactions with
        a recorded expected delivery date."""

        supplier = self.session.get(Supplier, supplier_id)
        if supplier is None:
            return None

        performance = compute_supplier_delivery_performance(self.session, supplier_id)
        if performance.trend != "deteriorating":
            return None

        title = f"Supplier performance deterioration: {supplier.name}"
        if self._has_open_risk_of_kind("Supplier performance deterioration", RelatedEntityType.SUPPLIER, supplier_id):
            return None

        signal_event = BusinessEvent(
            event_type=SUPPLIER_PERFORMANCE_DETERIORATED,
            source="intelligence",
            payload={
                "supplier_id": str(supplier_id),
                "baseline_avg_delay_days": performance.baseline_avg_delay_days,
                "recent_avg_delay_days": performance.recent_avg_delay_days,
                "baseline_on_time_rate": performance.baseline_on_time_rate,
                "recent_on_time_rate": performance.recent_on_time_rate,
            },
        )
        self.event_bus.publish(signal_event)

        risk = Risk(
            company_id=supplier.company_id,
            title=title,
            description=(
                f"Average delivery delay rose from {performance.baseline_avg_delay_days:.1f} to "
                f"{performance.recent_avg_delay_days:.1f} days; on-time rate fell from "
                f"{performance.baseline_on_time_rate:.0%} to {performance.recent_on_time_rate:.0%}."
            ),
            severity=RiskSeverity.HIGH if performance.recent_avg_delay_days >= 4 else RiskSeverity.MEDIUM,
            status=RiskStatus.OPEN,
            related_entity_type=RelatedEntityType.SUPPLIER,
            related_entity_id=supplier_id,
            source_event_id=signal_event.event_id,
        )
        self.session.add(risk)
        self.session.commit()

        self.event_bus.publish(
            BusinessEvent(
                event_type=RISK_CREATED,
                source="intelligence",
                correlation_id=signal_event.correlation_id,
                payload={
                    "risk_id": str(risk.id),
                    "source_event_id": str(signal_event.event_id),
                    "supplier_id": str(supplier_id),
                    "severity": risk.severity.value,
                },
            )
        )
        return risk

    def evaluate_customer_decline(self, customer_id: uuid.UUID) -> Risk | None:
        """Proactive customer decline / churn-risk monitoring: compares recent
        vs baseline revenue from real sales Transactions."""

        customer = self.session.get(Customer, customer_id)
        if customer is None:
            return None

        trend = compute_customer_value_trend(self.session, customer_id)
        if trend.trend != "declining":
            return None

        title = f"Customer decline: {customer.name}"
        if self._has_open_risk_of_kind("Customer decline", RelatedEntityType.CUSTOMER, customer_id):
            return None

        signal_event = BusinessEvent(
            event_type=CUSTOMER_DECLINE_DETECTED,
            source="intelligence",
            payload={
                "customer_id": str(customer_id),
                "baseline_revenue": trend.baseline_revenue,
                "recent_revenue": trend.recent_revenue,
                "variation_pct": trend.variation_pct,
            },
        )
        self.event_bus.publish(signal_event)

        risk = Risk(
            company_id=customer.company_id,
            title=title,
            description=(
                f"Revenue from {customer.name} fell {abs(trend.variation_pct):.1%} "
                f"(from {trend.baseline_revenue:.0f} to {trend.recent_revenue:.0f}) -- possible churn risk."
            ),
            severity=RiskSeverity.HIGH if trend.variation_pct <= -0.35 else RiskSeverity.MEDIUM,
            status=RiskStatus.OPEN,
            related_entity_type=RelatedEntityType.CUSTOMER,
            related_entity_id=customer_id,
            source_event_id=signal_event.event_id,
        )
        self.session.add(risk)
        self.session.commit()

        self.event_bus.publish(
            BusinessEvent(
                event_type=RISK_CREATED,
                source="intelligence",
                correlation_id=signal_event.correlation_id,
                payload={
                    "risk_id": str(risk.id),
                    "source_event_id": str(signal_event.event_id),
                    "customer_id": str(customer_id),
                    "severity": risk.severity.value,
                },
            )
        )
        return risk
