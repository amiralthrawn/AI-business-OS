"""Seed script for the vertical-slice demo dataset: one Company, a handful of
Suppliers and Products, and a few coherent Transactions linking them.

Assumes the schema already exists (run `alembic upgrade head` first)."""

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.entities import Company, Product, Supplier, Transaction, TransactionStatus, TransactionType
from app.database import SessionLocal


def seed(session: Session) -> dict:
    if session.query(Company).first() is not None:
        return {"skipped": True}

    company = Company(name="Acme Manufacturing", industry="Industrial equipment")
    session.add(company)
    session.flush()

    suppliers = [
        Supplier(company_id=company.id, name="Northline Steel", country="DE"),
        Supplier(company_id=company.id, name="Pacific Components", country="TW"),
        Supplier(company_id=company.id, name="Iberia Logistics Parts", country="ES"),
    ]
    session.add_all(suppliers)
    session.flush()

    products = [
        Product(company_id=company.id, supplier_id=suppliers[0].id, name="Steel Frame Assembly", sku="STL-001", unit_cost=420.0),
        Product(company_id=company.id, supplier_id=suppliers[0].id, name="Steel Bracket Set", sku="STL-002", unit_cost=38.5),
        Product(company_id=company.id, supplier_id=suppliers[1].id, name="Control Board Rev C", sku="PCB-010", unit_cost=95.0),
        Product(company_id=company.id, supplier_id=suppliers[1].id, name="Sensor Module", sku="PCB-011", unit_cost=61.0),
        Product(company_id=company.id, supplier_id=suppliers[2].id, name="Hydraulic Hose 2m", sku="HYD-020", unit_cost=27.0),
    ]
    session.add_all(products)
    session.flush()

    now = datetime.now(timezone.utc)
    transactions = [
        Transaction(
            company_id=company.id, supplier_id=suppliers[0].id, product_id=products[0].id,
            type=TransactionType.PURCHASE_ORDER, status=TransactionStatus.CONFIRMED,
            amount=420.0 * 50, currency="EUR", occurred_at=now - timedelta(days=30),
        ),
        # Same supplier, same product, ~11% pricier a month later -- the kind of
        # signal the future Intelligence layer will detect as a cost increase.
        Transaction(
            company_id=company.id, supplier_id=suppliers[0].id, product_id=products[0].id,
            type=TransactionType.PURCHASE_ORDER, status=TransactionStatus.CONFIRMED,
            amount=468.0 * 50, currency="EUR", occurred_at=now - timedelta(days=2),
        ),
        Transaction(
            company_id=company.id, supplier_id=suppliers[1].id, product_id=products[2].id,
            type=TransactionType.PURCHASE_ORDER, status=TransactionStatus.PAID,
            amount=95.0 * 200, currency="EUR", occurred_at=now - timedelta(days=15),
        ),
        Transaction(
            company_id=company.id, supplier_id=suppliers[2].id, product_id=products[4].id,
            type=TransactionType.PURCHASE_ORDER, status=TransactionStatus.DRAFT,
            amount=27.0 * 300, currency="EUR", occurred_at=now - timedelta(days=1),
        ),
    ]
    session.add_all(transactions)
    session.commit()

    return {
        "skipped": False,
        "suppliers": len(suppliers),
        "products": len(products),
        "transactions": len(transactions),
    }


def run() -> None:
    session = SessionLocal()
    try:
        result = seed(session)
        if result["skipped"]:
            print("Seed already applied, skipping.")
        else:
            print(
                f"Seed applied: 1 company, {result['suppliers']} suppliers, "
                f"{result['products']} products, {result['transactions']} transactions."
            )
    finally:
        session.close()


if __name__ == "__main__":
    run()
