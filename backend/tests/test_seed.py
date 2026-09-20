from data.seed import seed
from app.core.entities import Company, Product, Supplier, Transaction


def test_seed_creates_coherent_vertical_slice(db_session):
    result = seed(db_session)
    assert result["skipped"] is False

    company = db_session.query(Company).one()
    suppliers = db_session.query(Supplier).all()
    products = db_session.query(Product).all()
    transactions = db_session.query(Transaction).all()

    assert len(suppliers) >= 2
    assert len(products) >= 2
    assert len(transactions) >= 2

    supplier_ids = {s.id for s in suppliers}
    assert all(s.company_id == company.id for s in suppliers)
    assert all(p.supplier_id in supplier_ids for p in products)
    assert all(t.company_id == company.id for t in transactions)
    assert all(t.supplier_id in supplier_ids for t in transactions)


def test_seed_is_idempotent(db_session):
    seed(db_session)
    second = seed(db_session)

    assert second["skipped"] is True
    assert db_session.query(Company).count() == 1
