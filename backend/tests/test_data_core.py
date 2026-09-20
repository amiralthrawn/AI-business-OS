from datetime import datetime, timezone

from app.core.entities import (
    Company,
    Product,
    Supplier,
    Transaction,
    TransactionStatus,
    TransactionType,
)


def test_create_core_entities_and_relations(db_session):
    company = Company(name="Test Co")
    db_session.add(company)
    db_session.flush()

    supplier = Supplier(company_id=company.id, name="Test Supplier")
    db_session.add(supplier)
    db_session.flush()

    product = Product(company_id=company.id, supplier_id=supplier.id, name="Widget", sku="W-1", unit_cost=10.0)
    db_session.add(product)
    db_session.flush()

    transaction = Transaction(
        company_id=company.id,
        supplier_id=supplier.id,
        product_id=product.id,
        type=TransactionType.PURCHASE_ORDER,
        status=TransactionStatus.CONFIRMED,
        amount=100.0,
        currency="EUR",
        occurred_at=datetime.now(timezone.utc),
    )
    db_session.add(transaction)
    db_session.commit()

    assert db_session.query(Company).count() == 1
    assert supplier.company_id == company.id
    assert product.supplier_id == supplier.id
    assert transaction.supplier_id == supplier.id
    assert transaction.product_id == product.id
    assert supplier in company.suppliers
    assert product in supplier.products
