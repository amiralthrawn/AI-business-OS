import uuid

from sqlalchemy import Float, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.entities.base import Base, IdMixin, TimestampMixin


class Product(Base, IdMixin, TimestampMixin):
    __tablename__ = "products"

    company_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("companies.id"), nullable=False, index=True)
    supplier_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("suppliers.id"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    sku: Mapped[str | None] = mapped_column(String(120))
    # Float is good enough for MVP demo data; real money handling should move to Numeric.
    unit_cost: Mapped[float | None] = mapped_column(Float)

    company: Mapped["Company"] = relationship(back_populates="products")
    supplier: Mapped["Supplier | None"] = relationship(back_populates="products")
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="product")
