import enum
import uuid

from sqlalchemy import Enum, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.entities.base import Base, IdMixin, LinkableMixin, TimestampMixin


class TaskStatus(str, enum.Enum):
    PENDING_VALIDATION = "pending_validation"
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    CANCELLED = "cancelled"


class Task(Base, IdMixin, TimestampMixin, LinkableMixin):
    __tablename__ = "tasks"

    company_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("companies.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[TaskStatus] = mapped_column(Enum(TaskStatus), nullable=False, default=TaskStatus.OPEN, index=True)
    # Traces which Business Event (Event Log entry) produced this task, for audit.
    # Not a foreign key: the polymorphic event source isn't a single target table.
    source_event_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True, index=True)
