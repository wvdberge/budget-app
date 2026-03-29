  No code exists yet. This is a greenfield project. Do not create any files until Step 3 is complete and I have given explicit written go-ahead.

  ## Mandatory sequence — follow in strict order. Do NOT proceed to the next step until the current step is fully complete and I have responded.

  ---

  ### Step 1 — YNAB 4 export format
  
  A sample YNAB 4 CSV export is in the folder ynab_export/. Use it to determine the exact column structure. Do not web search — use the file directly. Output the column list as a compact table, then proceed to Step 2.

  ---

  ### STEP 2 — Interview

  Ask me the topics below **one at a time, in order**. Wait for my answer before asking the next. Do not batch questions.

  1. **Transaction entry** — Manual entry only, or also CSV import from Dutch banks (ING/Rabobank format)?
  2. **YNAB category groups** — YNAB organizes categories into groups (e.g. "Housing" > "Rent"). Preserve this two-level hierarchy, or flatten into a simple list?
  3. **Month-to-month behavior** — Three options: (a) each month starts empty, targets set manually; (b) new month auto-copies last month's targets; (c) unspent amounts roll over like YNAB. I'm leaning toward (b) —
   walk me through the tradeoffs before I decide.
  4. **Month navigation** — Browse and edit historical months, or current month only to start?
  5. **Reporting** — Simple spent-vs-budget overview per category, or also charts and trends over time?
  6. **UI style** — Minimal and functional, or more polished? Dark mode? MUST work on both mobile and desktop.
  7. **Recurring transactions** — Mark transactions as recurring so they pre-fill each month?
  8. **Constraints and exclusions** — Accessibility needs, specific browser targets, or features you explicitly don't want?

  ---

  ### STEP 3 — Scope confirmation

  Write a single structured summary covering:
  - Full feature list (incorporating all interview answers)
  - Architecture and data model overview
  - YNAB 4 CSV column structure to be used for the import tool (from Step 1)
  - README as a named deliverable (content spec below)
  - Definition of done (verification plan)

  **STOP here. Do not write any code, create any files, or install any dependencies until I reply with explicit go-ahead.**

  ---

  ## Stack — locked, do not deviate, do not ask about this

  - **Frontend:** React (single-page app), scaffolded with Vite
  - **Backend:** Node.js + Express REST API
  - **Database:** SQLite via `better-sqlite3` (single file)
  - **Deployment:** Docker — `Dockerfile` + `docker-compose.yml` targeting Synology NAS DS224+ (x86/Intel, Container Manager)
  - **Production:** Express serves the React build as static files on a single port (e.g. 3000)
  - **Development:** React proxies API requests to Express via Vite config — no CORS issues, no two-server setup
  - **Persistence:** SQLite file stored in a mounted Docker volume

  ## Currency and formatting — locked

  - All amounts in euros (€)
  - Dutch number formatting throughout: period as thousands separator, comma as decimal separator — e.g. `€1.234,56`

  ## Core features — locked

  1. **Budget categories** — name + monthly target amount, per profile per month, optionally in two-level groups (e.g. "Housing" > "Rent")
  2. **Spending accounts** — named per profile (e.g. "ING Betaalrekening", "Rabo Creditcard")
  3. **Transactions** — date, amount, description, account, category; all entries MUST be editable and deletable after creation
  4. **Multiple profiles** — fully isolated budgets (e.g. "Personal", "Family"), switchable from UI; no authentication — intentional, this is a private LAN-only NAS app; profiles MUST NOT share categories, groups,
  accounts, or transactions; no cross-profile view
  5. **Month-to-month behavior** — determined by interview
  6. **YNAB 4 migration** — one-time import of budget categories and monthly targets from a YNAB 4 CSV export, using the exact column structure found in Step 1; no transaction history import needed

  ## Human review triggers — STOP and ask me before:
  - Adding any npm dependency not directly required by a feature
  - Touching Docker or database schema after initial setup
  - Deleting any file
  - Deviating from any locked stack decision above

  ## Constraints — NEVER violate these
  - NEVER add authentication, session handling, or login flows
  - NEVER create files, abstractions, utilities, or helpers not directly required by a specified feature
  - NEVER scaffold boilerplate beyond what Vite and the stack require
  - NEVER proceed past a STOP point without my written confirmation

  ## Build behavior
  After go-ahead: output `✅ [what was completed]` after each meaningful step so I can follow progress.
  Only make changes directly requested. Do not refactor, reorganize, or "improve" code beyond the task at hand.

  ## README — first deliverable after go-ahead

  Produce the README before any application code. It MUST include:
  - Short app description
  - Synology NAS setup guide written for someone familiar with DSM but who has never used Docker, a terminal, or the command line — use plain language, describe UI steps as if narrating screenshots, assume zero
  technical knowledge
  - How to run the app locally for development and testing
  - How to back up the SQLite file from within Synology
  - How to run the one-time YNAB 4 category import, including where to find the export option in YNAB 4
  - How to update the app to a new version without losing data

  ## Definition of done

  Before handing over, verify all three:
  1. `docker build` completes without errors and the container starts
  2. All API endpoints respond correctly — write and run a test script that hits each endpoint and checks responses
  3. `vite build` completes without errors

  Visual and UI verification will be done manually by me and is not required from you.