from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.events.bus import EventBus
from app.database import get_db
from app.dependencies import get_event_bus
from app.domains.procurement.schemas import SupplierCostChangeRequest, SupplierCostChangeResponse
from app.domains.procurement.service import ProcurementError, ProcurementService

router = APIRouter(prefix="/procurement", tags=["procurement"])


@router.post("/supplier-cost-changes", response_model=SupplierCostChangeResponse)
def record_supplier_cost_increase(
    payload: SupplierCostChangeRequest,
    db: Session = Depends(get_db),
    event_bus: EventBus = Depends(get_event_bus),
) -> SupplierCostChangeResponse:
    service = ProcurementService(db, event_bus)
    try:
        event = service.record_supplier_cost_increase(
            supplier_id=payload.supplier_id,
            product_id=payload.product_id,
            new_unit_cost=payload.new_unit_cost,
        )
    except ProcurementError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return SupplierCostChangeResponse(
        event_id=event.event_id,
        event_type=event.event_type,
        correlation_id=event.correlation_id,
        supplier_id=payload.supplier_id,
        product_id=payload.product_id,
        old_unit_cost=event.payload["old_unit_cost"],
        new_unit_cost=event.payload["new_unit_cost"],
        variation_pct=event.payload["variation_pct"],
    )
