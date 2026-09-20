import uuid

from pydantic import BaseModel, Field


class SupplierCostChangeRequest(BaseModel):
    supplier_id: uuid.UUID
    product_id: uuid.UUID
    new_unit_cost: float = Field(gt=0)


class SupplierCostChangeResponse(BaseModel):
    event_id: uuid.UUID
    event_type: str
    correlation_id: uuid.UUID
    supplier_id: uuid.UUID
    product_id: uuid.UUID
    old_unit_cost: float
    new_unit_cost: float
    variation_pct: float
