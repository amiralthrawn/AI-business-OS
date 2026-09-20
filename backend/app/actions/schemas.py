import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.core.entities.base import RelatedEntityType
from app.core.entities.task import TaskStatus


class TaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    company_id: uuid.UUID
    title: str
    description: str | None
    status: TaskStatus
    related_entity_type: RelatedEntityType | None
    related_entity_id: uuid.UUID | None
    source_event_id: uuid.UUID | None
    created_at: datetime
