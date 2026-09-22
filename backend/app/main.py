from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.actions.router import router as tasks_router
from app.ai.ask_ai.router import router as ask_ai_router
from app.business_context.router import router as business_context_router
from app.company.router import router as company_router
from app.connectors.router import router as connectors_router
from app.data.router import router as data_router
from app.database import engine
from app.decision.router import router as decision_router
from app.domains.finance.router import router as finance_router
from app.domains.procurement.router import router as procurement_router
from app.domains.sales.router import router as sales_router
from app.home.router import router as home_router
from app.intelligence.opportunities.router import router as opportunities_router
from app.intelligence.risks.router import router as risks_router
from app.intelligence.router import router as monitoring_router
from app.interpretation.router import router as interpretation_router
from app.observation.router import router as observation_router

app = FastAPI(title="AI Business OS", version="0.1.0")

# The frontend's Server Components fetch server-to-server (no CORS involved),
# but client components (Ask AI's form) call this API directly from the
# browser, which is cross-origin as soon as ports differ. Dev-only: any
# localhost/127.0.0.1 port, no credentials.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(business_context_router)
app.include_router(company_router)
app.include_router(connectors_router)
app.include_router(data_router)
app.include_router(procurement_router)
app.include_router(finance_router)
app.include_router(sales_router)
app.include_router(risks_router)
app.include_router(opportunities_router)
app.include_router(monitoring_router)
app.include_router(observation_router)
app.include_router(interpretation_router)
app.include_router(decision_router)
app.include_router(tasks_router)
app.include_router(home_router)
app.include_router(ask_ai_router)


@app.get("/health")
def health() -> dict:
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return {"status": "ok"}
