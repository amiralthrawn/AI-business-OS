from fastapi import FastAPI
from sqlalchemy import text

from app.actions.router import router as tasks_router
from app.database import engine
from app.domains.procurement.router import router as procurement_router
from app.intelligence.risks.router import router as risks_router

app = FastAPI(title="AI Business OS", version="0.1.0")
app.include_router(procurement_router)
app.include_router(risks_router)
app.include_router(tasks_router)


@app.get("/health")
def health() -> dict:
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return {"status": "ok"}
