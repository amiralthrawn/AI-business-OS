from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.entities.base import Base, IdMixin, LinkableMixin, TimestampMixin


class Contact(Base, IdMixin, TimestampMixin, LinkableMixin):
    """A person, linked via LinkableMixin to the Supplier or Customer they belong to."""

    __tablename__ = "contacts"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(50))
    role: Mapped[str | None] = mapped_column(String(120))
