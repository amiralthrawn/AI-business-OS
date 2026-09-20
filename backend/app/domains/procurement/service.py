import uuid

from sqlalchemy.orm import Session

from app.core.entities import Product
from app.core.events.business_event import BusinessEvent
from app.core.events.bus import EventBus

SUPPLIER_COST_INCREASED = "SupplierCostIncreased"


class ProcurementError(Exception):
    """Raised when a Procurement operation cannot be carried out as requested."""


class ProcurementService:
    """Minimal Procurement operations over the shared Data Core. Holds no data of
    its own: it reads and writes the existing Supplier/Product entities and
    publishes Business Events for whatever downstream layers will react to."""

    def __init__(self, session: Session, event_bus: EventBus) -> None:
        self.session = session
        self.event_bus = event_bus

    def record_supplier_cost_increase(
        self, supplier_id: uuid.UUID, product_id: uuid.UUID, new_unit_cost: float
    ) -> BusinessEvent:
        product = self.session.get(Product, product_id)
        if product is None or product.supplier_id != supplier_id:
            raise ProcurementError(f"Product {product_id} not found for supplier {supplier_id}")

        old_unit_cost = product.unit_cost
        if old_unit_cost is None or old_unit_cost <= 0:
            raise ProcurementError(f"Product {product_id} has no valid current unit cost to compare against")
        if new_unit_cost <= old_unit_cost:
            raise ProcurementError("new_unit_cost must be strictly higher than the current unit cost")

        variation_pct = (new_unit_cost - old_unit_cost) / old_unit_cost

        product.unit_cost = new_unit_cost
        self.session.add(product)
        self.session.commit()

        event = BusinessEvent(
            event_type=SUPPLIER_COST_INCREASED,
            source="procurement",
            payload={
                "supplier_id": str(supplier_id),
                "product_id": str(product_id),
                "old_unit_cost": old_unit_cost,
                "new_unit_cost": new_unit_cost,
                "variation_pct": variation_pct,
            },
        )
        self.event_bus.publish(event)
        return event
