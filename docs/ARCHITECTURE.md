# AI Business OS — Architecture validée

Référence courte des décisions prises avant implémentation. Ne remplace pas la discussion complète, sert de rappel pendant le développement.

## Principe général

Modular monolith en couches, connectées par un bus d'événements interne plutôt que par des appels en cascade :

```
DATA CORE → BUSINESS → INTELLIGENCE → ACTIONS → HOME
                ↕ Business Events (Event Bus)
AI : accès transversal en lecture, organisée par Capabilities, pas par domaine
```

Home n'a pas de stockage propre : c'est un agrégateur en lecture (modèle hybride, pas de CQRS complet) qui interroge directement les services internes de Business/Intelligence/Actions.

## Data Core

Entités : Company, Contact, Supplier, Customer, Product, Transaction, Document, Communication, Task, Risk, Opportunity, Event (log).

Relations transversales (Document, Communication, Task, Risk, Opportunity) via `related_entity_type` + `related_entity_id` — compromis de prototype assumé : pas de FK native multi-table, intégrité au niveau applicatif. Évolution future si nécessaire : table `entities` registre unique ou tables de jointure dédiées. Un Supplier/Customer/Product/Transaction n'existe qu'une fois, jamais dupliqué par domaine.

SQLite pour le MVP, SQLAlchemy 2.x + Alembic pour rester migrable vers PostgreSQL. Différences à traiter lors de la migration : mode batch Alembic pour les `ALTER TABLE`, activation des FK (`PRAGMA foreign_keys`), pas de `JSONB`/`TIMESTAMPTZ` natifs, verrou mono-écrivain SQLite vs MVCC Postgres.

## Events — quatre concepts distincts

- **Business Event** : objet immuable (`event_type`, `payload`, `source`, `timestamp`, `correlation_id`, `event_id`).
- **Event Bus** : interface `publish()`/`subscribe()`. Implémentation MVP : in-process, synchrone. Le code métier dépend de l'interface, jamais de l'implémentation.
- **Event Handler / Consumer** : fonction abonnée à un type d'événement, exécute un effet de bord.
- **Event Log** : persistance append-only, réalisée par un handler générique abonné à tous les événements — un consommateur parmi d'autres, pas une fonctionnalité intégrée au bus.

## Business / Intelligence / Actions

Chaque domaine Business publie des événements sur les faits métier significatifs. Intelligence s'abonne, applique des règles déterministes, produit Risk/Opportunity. Actions s'abonne aux événements d'Intelligence, matérialise des Tasks avec une porte de validation humaine (`pending_validation`) au-delà d'un seuil de sévérité.

## AI / Agents / Capabilities / Orchestrator

Agent ≠ domaine de navigation : un agent est un regroupement de capabilities. Capability = unité typée (lecture ou action), certaines déterministes, d'autres enveloppant un appel LLM. Orchestrator : interprète la demande → sélectionne les capabilities pertinentes → exécute lectures et analyses → synthétise → propose éventuellement une action (jamais d'exécution automatique d'un effet de bord sans validation humaine).

## Vertical slice prioritaire

Seed → Supplier/Product/Transaction → Procurement → Business Event → Intelligence → Risk/Opportunity → Action/Task → Home → Ask AI → Capability → Action éventuelle.

## Ordre d'implémentation

1. Scaffolding — 2. Data Core — 3. Seed — 4. Events — 5. Procurement minimal — 6. Intelligence — 7. Actions — 8. API CRUD — 9. Home — 10. Frontend Home/Data — 11. Capabilities — 12. Finance/Procurement Agents — 13. Orchestrator + Ask AI — 14. Frontend Ask AI — 15. Research Agent — 16. Extension autres domaines — 17. Reports — 18. Cohérence UI/UX finale.

Étapes 1 à 4 implémentées à ce stade. Voir README.md pour les commandes.
