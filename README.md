# AI Business OS

AI Business OS is an experimental **"operating system for the life of a company"**: instead of being another siloed ERP/CRM/BI dashboard, it tries to give a small/mid-size B2B company one place that says, in plain language, *what is happening*, *why it matters*, and *what to do about it* — with a human always in the loop before anything is actually sent, changed, or executed.

It is a modular monolith: a FastAPI backend holding the real Data Core and all business/intelligence logic, and a Next.js frontend that renders it. There is no microservices split, no message queue, no vector database, and no multi-agent framework — every "intelligent" behavior described below is deterministic Python plus, in a few well-defined places, one LLM call for natural-language explanation only.

> This is a working MVP built incrementally, one reasoned step at a time. Every decision behind it — including the ones *not* taken — is logged in [`brain/decisions.md`](brain/decisions.md). This README describes what is **actually implemented today**, not a target design.

## The problem it's trying to solve

Small and mid-size companies run on a patchwork of spreadsheets, emails, and disconnected tools. Nobody has a single, honest view of "what changed, why it's significant, and what I should decide" across Finance, Procurement, Sales, and the rest of the business. Existing software either shows raw data (ERPs, CRMs) or a dashboard of charts (BI tools) — neither one tells you what to actually pay attention to, and none of them are honest about *how* they arrived at a conclusion.

## The product concept: MACRO → MICRO → NANO

Every screen in the product is designed around one hierarchy, applied consistently instead of dumping everything at once:

```text
MACRO
→ what matters right now
→ what needs a decision
→ what I can actually do about it

MICRO
→ why (the reasoning trail)
→ context (which data produced this conclusion)
→ details for one entity (a supplier, a customer, a risk...)

NANO
→ raw data (a transaction, a communication, a document)
   -- for anyone who needs to go that deep, never the default view
```

The Command Center (`/`) is the MACRO layer. A Risk/Opportunity/Decision detail page is MICRO. The Data pages (Suppliers/Customers/Products/Transactions) are the NANO layer.

## How the AI reasoning actually works

The whole "intelligence" pipeline is deterministic and explainable end to end, with the LLM restricted to producing natural-language explanations of numbers that were already computed — it never decides what is significant and never executes anything on its own:

```text
Company Data / History / Configuration
                ↓
        Business Context            (declared: size, sector, monitored domains, objectives, baselines)
                ↓
             Baseline                (what "normal" is for a metric: observed | declared | generic)
                ↓
           Significance              (is a deviation from that baseline worth surfacing?)
                ↓
     Business State Snapshot         (a compact, derived view of what currently matters)
                ↓
        AI Orchestrator              (routes a question — or "what deserves my attention?" — to...)
                ↓
       Targeted Capabilities         (typed read/action functions: read_supplier, analyze_margin, ...)
                ↓
        Decision / Action            (options + trade-offs + a recommendation, or a proposed Task)
                ↓
        Human Validation             (approve / reject — nothing executes without this)
                ↓
             Result                  (a real Task, a real status change — never simulated)
```

Full detail on each layer — including the deterministic classification rules and the exact limits of each one — lives in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and the per-topic files in [`brain/`](brain/).

## What is actually implemented

Backend layers, in the order data flows through them:

| Layer | What it does | Code |
|---|---|---|
| **Data Core** | Company, Supplier, Customer, Product, Transaction, Contact, Communication, Document, Task, Risk, Opportunity, Event Log. SQLite + SQLAlchemy 2.x + Alembic. | `backend/app/core/entities/` |
| **Business Context** | Declared company profile (size, country, business model, monitored domains, objectives, declared baselines). Editable via API; the system also *suggests* (never auto-applies) configuration changes based on a human's past decisions. | `backend/app/business_context/` |
| **Baseline** | What "normal" means for one metric on one entity — observed history, a declared target (always wins over observed), or a generic fallback (low confidence, explicitly marked as such). | `backend/app/core/baseline.py` |
| **Significance** | Scores a deviation from baseline across several independent dimensions (deviation size, impact, urgency, persistence, recurrence, correlation, strategic relevance, confidence) — never collapsed into one opaque score. | `backend/app/core/significance.py` |
| **Business State Snapshot** | A derived, compact read of what currently matters company-wide — not a second database, not a persisted cache. | `backend/app/snapshot/` |
| **Business Observation Engine** | Generic, pluggable signal detection (an "Observable" = a metric + entity type + baseline function + thresholds). Runs on demand (`POST /observation/sweep`), not on a scheduler. | `backend/app/observation/` |
| **Business Event Interpretation** | Turns a detected Observation into a deterministically classified `risk`/`opportunity`/`insight`/`observation`, with an LLM-written explanation only. | `backend/app/interpretation/` |
| **Decision Intelligence** | For a classified risk/opportunity, produces 2-3 concrete options with trade-offs and a deterministically chosen recommendation (the LLM only writes the reasoning text). May propose a Task if applicable. | `backend/app/decision/` |
| **AI Orchestrator** | Answers a targeted question (a named entity) or a cross-domain one ("why is our margin dropping?") by consulting the Snapshot, then calling only the capabilities that matter — never a blind scan of the Data Core. | `backend/app/ai/orchestrator/`, `backend/app/ai/capabilities/` |
| **Ask AI** | The chat-style endpoint over the Orchestrator. | `backend/app/ai/ask_ai/` |
| **Home / Command Center** | Re-reads what every layer above already produced (priorities, decisions, tasks, company narrative, OS activity) — computes nothing new itself. | `backend/app/home/` |
| **Business Domains** | Finance / Procurement / Sales overviews (KPIs, 12-month trends, intelligence signals, recent activity) — pure composition over Data Core + analytics, no separate per-domain database. | `backend/app/domains/{finance,procurement,sales}/` |
| **Actions / Tasks** | The one place Task rows are written. Human-in-the-loop: an AI-authored proposal is a `PENDING_VALIDATION` Task that only becomes real on explicit approval; a human-authored Task moves through `open → in_progress → done/cancelled`, or can be submitted for someone else's validation. | `backend/app/actions/` |
| **External Connectivity** | Mock providers only (email, calendar, website) — no OAuth, no real Gmail/Outlook/Calendar connection. Demonstrates the ingestion → Data Core path the real integrations would use. | `backend/app/connectors/` |

`CRM`, `HR`, `Marketing`, and `Supply Chain` exist as empty placeholder modules (`backend/app/domains/{crm,hr,marketing,supply_chain}/`) and matching "not available yet" frontend pages — intentionally not built out, not a bug.

## Frontend

Next.js 16 (App Router) + TypeScript + Tailwind v4, single design system (Fraunces / Plus Jakarta Sans / IBM Plex Mono, light theme only). What's actually there today:

- **Onboarding** (`/onboarding`) — a 4-step wizard (company, organization, current systems, summary) that writes to the real Company/BusinessContext endpoints.
- **Command Center** (`/`) — animated KPI band (revenue/costs/margin), "à décider" / "à faire" / "ce que l'entreprise propose" / "ce qui s'est passé" / "activité de l'OS" sections, all fed by real data with honest empty states.
- **Finance / Achats / Ventes** (`/business/*`) — KPIs, a real 12-month line chart per domain (animated, hoverable, click-to-pin a month), Finance additionally cross-references Achats vs Ventes on one chart to show margin compression/improvement.
- **Data** (`/data`) — Suppliers/Customers/Products/Transactions as four widgets on one page, each linking to its full list and detail pages.
- **Contacts** (`/data/contacts`) — a real communication center: per-channel connection status (email/website genuinely connected to the mock connectors; LinkedIn/Facebook/Email-marketing explicitly shown as "not configured", never faked), real contacts with a "prepare an email" (`mailto:`, never auto-sent) and "create a task" action, and a campaign widget that only fills in the funnel stages ("content" today) it actually has data for.
- **Intelligence** (`/intelligence/*`) — Risks, Opportunities, and Decision Intelligence, each item showing its reasoning trail; Decision options are clickable and expand into their own trade-offs.
- **Tasks** (`/actions/tasks`) — the action center: filter by sector and by lifecycle stage, open any task for full context, create a new one from a curated library of ~70 real business actions across Finance/RH/Ventes/Achats/Marketing/Direction/Opérations. Every button either performs a real, persisted state change or isn't shown.
- **Activité de l'entreprise** (`/actions/activity`) — a unified, per-sector feed merging AI-detected activity with real logged communications, honest "no data" state per sector.
- **Ask AI** (`/ai/ask-ai`) — the same Orchestrator the backend exposes, no separate/simulated chat logic.
- **Settings** (`/settings`) — edits the real BusinessContext fields.
- **FR/EN switcher** — a real, working toggle for the app's chrome and static labels (backend-generated content stays French; see Limitations).

## Repository structure

```text
AI-business-OS/
├── README.md
├── .env.example
├── start.bat                    # double-click launcher (Windows) -> start.ps1
├── start.ps1                    # starts backend + frontend, each in its own window
├── docs/
│   └── ARCHITECTURE.md          # detailed architecture reference, one section per layer/step
├── brain/                       # per-topic design notes + brain/decisions.md (the full decision log)
├── backend/
│   ├── app/
│   │   ├── core/                # entities (Data Core), baseline.py, significance.py, analytics.py
│   │   ├── observation/         # Observable registry + engine
│   │   ├── interpretation/      # Business Event → Risk/Opportunity/Insight/Observation
│   │   ├── decision/            # Decision Intelligence
│   │   ├── snapshot/            # Business State Snapshot
│   │   ├── ai/                  # orchestrator, capabilities, ask_ai
│   │   ├── home/                # Command Center read model
│   │   ├── domains/             # finance, procurement, sales (+ empty crm/hr/marketing/supply_chain)
│   │   ├── actions/             # Task lifecycle + Human-in-the-Loop executor
│   │   ├── connectors/          # mock email/calendar/website providers + ingestion
│   │   ├── business_context/, company/, data/  # config + read APIs
│   │   └── main.py              # FastAPI app, router wiring
│   ├── alembic/                 # migrations
│   ├── data/seed.py             # idempotent demo dataset + full pipeline replay
│   ├── tests/                   # pytest suite
│   └── requirements.txt
└── frontend/
    ├── app/
    │   ├── onboarding/          # outside the app chrome
    │   └── (app)/               # every chrome'd route (Command Center, Business, Data, Intelligence, Actions, AI, Settings)
    ├── components/
    │   ├── ui/                  # design-system primitives (Card, Badge, MonthlyLineChart, ...)
    │   ├── intelligence/, home/, actions/, data/, layout/, onboarding/, settings/, shared/
    ├── lib/                     # api.ts, types.ts, labels.ts, i18n.tsx, action-library.ts
    └── package.json
```

## Tech stack

- **Backend**: Python, FastAPI, SQLAlchemy 2.x, Alembic, Pydantic v2, SQLite (dev), pytest, `openai` SDK (only used when `OPENAI_API_KEY` is set — see Limitations).
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, ESLint 9. No external charting library — charts are hand-built SVG. No frontend test runner is configured yet (see Limitations).

## Quick Start

The fastest way to run both servers locally on Windows, once the one-time setup below has been done at least once:

```text
Double-click start.bat
```

The launcher (`start.bat` → `start.ps1`) starts backend and frontend **each in their own window**, so both stay running at the same time:

- Backend → http://localhost:8000
- Frontend → http://localhost:3000

It opens your browser on `http://localhost:3000` automatically, but only once the frontend is actually responding — never on a fixed delay. If a port is already in use (e.g. another instance is already running), it skips starting a duplicate on that port and tells you so instead. If `backend\.venv` or `frontend\node_modules` don't exist yet, it says so and points at the manual setup below rather than guessing a setup command. It contains no API keys, tokens, or credentials — it only runs the same local commands documented below.

Closing the launcher's own window does **not** stop the backend/frontend — each keeps running in its own window until you close that window (or Ctrl+C inside it).

Prefer PowerShell directly? `start.bat` is just a double-clickable wrapper around:

```powershell
.\start.ps1
```

## Getting Started

The manual method — useful the first time (setup), or if you'd rather start backend and frontend yourself in two terminals. Verified against the scripts and files actually present in this repository.

### Prerequisites

- Python 3.10+ (a `.venv` already exists under `backend/.venv` in this checkout; create your own with the commands below if starting fresh)
- Node.js + npm compatible with Next.js 16 / React 19

### 1. Environment file

```bash
copy .env.example .env        # Windows
# cp .env.example .env        # macOS/Linux
```

`.env` at the repo root provides `DATABASE_URL`, `OPENAI_API_KEY` (optional — leave empty to run fully offline with deterministic French fallback text instead of LLM output), `OPENAI_MODEL`, and `NEXT_PUBLIC_API_URL`.

### 2. Backend — install, migrate, seed, run

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows; source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
alembic upgrade head
python -m data.seed               # idempotent: safe to re-run, skips if already seeded
uvicorn app.main:app --reload
```

- API: **http://localhost:8000**
- Interactive docs (Swagger UI): **http://localhost:8000/docs**
- Health check: **http://localhost:8000/health**

### 3. Frontend — install and run

```bash
cd frontend
npm install
npm run dev
```

- App: **http://localhost:3000**

### 4. Backend tests

```powershell
cd backend
.venv\Scripts\python.exe -m pytest -q
```

287 tests, all passing as of this writing.

### 5. Frontend lint and build

```bash
cd frontend
npm run lint
npm run build
```

(`npm run start` serves the production build; there is no `npm test` script configured yet.)

## Current Status

This is a real, working MVP, not a mock-up — every number in the UI is either a live computation over the seeded Data Core or an explicit "no data available" state. That said, it has clear, honestly-stated limits:

**Genuinely functional:**
- The full Business Context → Baseline → Significance → Snapshot → Observation → Interpretation → Decision → Action pipeline, deterministic and inspectable end to end.
- Human-in-the-loop on every AI-proposed action — nothing executes without explicit approval.
- Finance/Procurement/Sales as real domains with real 12-month trends and cross-referenced margin analysis.
- The Tasks board as a real action center with genuine lifecycle transitions.
- FR/EN toggle for the app's own interface labels.

**Prepared but not connected to a real external system:**
- Email/Calendar/Website "connectors" are mock providers with realistic demo data — the ingestion → Data Core pipeline is real, but there is no OAuth flow and no real Gmail/Outlook/Google Calendar/LinkedIn/Facebook account behind them. The Contacts page states this explicitly per channel ("Connecté (démonstration)" vs "Non configuré") rather than pretending otherwise.
- The social/campaign widget shows only the one funnel stage ("content") backed by real seeded data; diffusion/engagement/conversion/retention are explicitly "unavailable", not invented.
- "Soumettre pour validation" on a Task reuses the existing single-branch executor rather than a dedicated financial/HR workflow engine — there is no cash-flow or scenario modeling behind a "financing request" action; the human still does that analysis.

**Not implemented:**
- CRM, HR, Marketing, and Supply Chain as functional domains (placeholder pages only).
- Reports (`app/ai/reports` is an empty module).
- Any persisted, calculated baseline (baselines are computed on the fly from history, never cached).
- A frontend automated test suite (only ESLint + `next build`'s type-check gate today).
- Multi-company / multi-tenant support — the backend assumes exactly one `Company` row throughout.

**Next steps that are already identified (not a promise, not a roadmap invention):** unifying the two existing "priorities" computations (`brain/decisions.md` #19), a persisted baseline cache if performance ever requires it, and — if/when a real integration is wanted — implementing one real `EmailProvider`/`CalendarProvider` behind the existing connector interface without touching anything above it.

## Further reading

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — the architecture reference, one section per layer, written before/alongside implementation.
- [`brain/decisions.md`](brain/decisions.md) — the full log of non-obvious decisions and why alternatives were rejected.
- [`brain/`](brain/) — one file per topic (Business Context, Baseline/Significance, Observation Engine, Interpretation, Decision Intelligence, Connectors, Data Core, Business Domains, Home/Command Center) with the demonstrated behavior and assumed limits for each.
