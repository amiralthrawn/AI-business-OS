# AI Business OS

Système d'exploitation d'entreprise orienté IA — modular monolith (backend FastAPI + frontend Next.js) organisé autour de six espaces : Home, Business, Data, Intelligence, Actions, AI.

Voir `docs/ARCHITECTURE.md` pour l'architecture validée et l'ordre d'implémentation.

## État actuel

Étapes 1 à 4 en place : scaffolding, Data Core (SQLAlchemy + Alembic + SQLite), seed du vertical slice, infrastructure Events (Business Event / Event Bus / Event Handler / Event Log).

Non implémenté à ce stade : logique Procurement, Intelligence, Actions, Home, AI/Agents/Capabilities, Ask AI, Reports.

## Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
copy ..\.env.example ..\.env  # une seule fois, à la racine du repo
alembic upgrade head
python -m data.seed
uvicorn app.main:app --reload
```

Tests :

```bash
cd backend
pytest
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```
