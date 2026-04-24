# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Development (run both concurrently):**
```bash
cd server && node index.js          # Express API on port 3000
cd client && npm run dev            # Vite dev server on port 5173
```
The Vite dev server proxies all `/api` requests to port 3000, so no CORS setup is needed.

**Run tests** (requires server to be running):
```bash
node test/test.js
```

**Deploy on NAS:**

The app runs on the NAS via Dockge (port 5002), pulling `ghcr.io/wvdberge/budget-app:latest`. GitHub Actions builds the full Docker image (including client) and pushes to GHCR on every push to `main`.

Deploy workflow:
1. Commit and push changes
2. Wait ~2 min for GitHub Actions to build
3. In **Dockge**: pull the new image and redeploy the `budget` stack

The NAS never needs to build anything locally.

## Architecture

Two-process app: an Express server (`server/`) serving a REST API and the React build as static files, and a React client (`client/`) built with Vite.

**Server (`server/`)**
- `db.js` — single SQLite database via `better-sqlite3`. Contains the full schema, all migrations (as `ALTER TABLE` try/catch blocks at the top), and the rollover budget computation logic (`computeBudget`). Any schema changes go here.
- `index.js` — mounts all routes
- `routes/` — one file per resource: `profiles`, `accounts`, `groups`, `categories`, `budget`, `transactions`, `transfers`, `import`

**Client (`client/src/`)**
- `App.jsx` — root component, holds global state (`profileId`, `month`) in `AppContext`, fetches profiles
- `api.js` — all HTTP calls in one place; all other components import from here
- `components/` — three top-level views (`BudgetView`, `TransactionsView`, `ManageView`) plus `modals/`

**Key data model relationships:**
- Everything is scoped to a `profile_id`
- Budget targets have two layers: `categories.monthly_target` (the default) and `month_budgets` (per-month overrides). `computeBudget` in `db.js` uses the override if present, otherwise falls back to `monthly_target`.
- Rollover is computed by replaying all months from the earliest transaction/budget row forward — never stored, always derived.
- Transfers are two linked `transactions` rows (`is_transfer=1`, `transfer_peer_id` pointing to each other). Deleting either leg deletes both. Transfers are excluded from budget spending calculations.
- Recurring transactions carry an `is_recurring` flag and a `recurring_anchor_id` pointing back to the original; "apply recurring" uses the anchor to stay idempotent.

**CSV import** (`routes/import.js`, `modals/ImportModal.jsx`) supports ABN AMRO and ASN Bank formats. Parsing happens server-side; the client receives parsed rows for review before saving.

**Database location:** `/data/budget.db` in production (set via `DB_PATH` env var), `../data/budget.db` relative to `server/` in development.
