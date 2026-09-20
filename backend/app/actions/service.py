import uuid

from sqlalchemy.orm import Session

from app.core.entities import Risk, Task, TaskStatus
from app.core.events.bus import EventBus
from app.core.events.business_event import BusinessEvent

TASK_CREATED = "TaskCreated"


class ActionsService:
    """Turns an Intelligence signal into a human-validated Task. Knows nothing
    about how Intelligence produced its Risk -- only the Risk record and the
    RiskCreated event -- and holds no data of its own beyond the Task it writes
    to the shared Data Core."""

    def __init__(self, session: Session, event_bus: EventBus) -> None:
        self.session = session
        self.event_bus = event_bus

    def create_task_from_risk_created(self, event: BusinessEvent) -> Task | None:
        # Idempotence at the persistence level, same approach as Risk detection:
        # a given source event must never produce more than one Task, even if
        # this handler is invoked again outside the Event Bus (e.g. a replay).
        already_created = self.session.query(Task).filter_by(source_event_id=event.event_id).first()
        if already_created is not None:
            return None

        risk_id = uuid.UUID(event.payload["risk_id"])
        risk = self.session.get(Risk, risk_id)
        if risk is None:
            # Data inconsistency (the Risk this event points to is gone) --
            # nothing to build a Task from.
            return None

        task = Task(
            company_id=risk.company_id,
            title="Review supplier cost increase",
            description=f"{risk.title}. Review supplier pricing and consider renegotiation.",
            status=TaskStatus.PENDING_VALIDATION,
            related_entity_type=risk.related_entity_type,
            related_entity_id=risk.related_entity_id,
            source_event_id=event.event_id,
        )
        self.session.add(task)
        self.session.commit()

        self.event_bus.publish(
            BusinessEvent(
                event_type=TASK_CREATED,
                source="actions",
                correlation_id=event.correlation_id,
                payload={
                    "task_id": str(task.id),
                    "risk_id": str(risk.id),
                    "supplier_id": event.payload.get("supplier_id"),
                    "product_id": event.payload.get("product_id"),
                    "status": task.status.value,
                },
            )
        )
        return task
