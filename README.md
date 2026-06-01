# Budget

A personal budgeting app for private home use. Runs on your Synology NAS, accessible in your browser on any device on your home network.

**Features:**
- Multiple isolated budget profiles (e.g. Personal, Family)
- Two-level categories: groups → subcategories with monthly targets
- Income categories tracked separately (expected vs received, no rollover), shown at the top of the budget view
- YNAB-style rollover for expense categories: unspent amounts carry forward each month
- Transactions with manual entry and CSV import (ABN AMRO `.txt`/`.tab`, ASN Bank `.csv`)
- Budget-neutral transfers between accounts (both legs created atomically, excluded from budget)
- Transfers can also be assigned directly during CSV import; if you later import the other side of the statement, the matching leg is detected and pre-deselected to avoid duplicates
- Recurring transactions with configurable frequency: weekly, monthly, quarterly, or yearly
- Rules: map a keyword to a category *or* to a transfer destination so transactions are auto-assigned on entry and during CSV import
- Manual balance adjustments: post a dated, signed correction to an account when reality drifts from the ledger; excluded from budget/income totals
- Per-month budget overview: target / spent / available per expense category
- Account balances: set an initial balance per account; current balance updates automatically
- Dark mode, works on desktop and mobile

**Not included:** login, authentication, cloud sync — this is a private LAN-only app.

---

## Running locally (development)

Requirements: Node.js 20+, npm.

```bash
# Install dependencies for server and client
cd server && npm install && cd ..
cd client && npm install && cd ..

# Start server (port 3001)
cd server && node index.js

# In a separate terminal: start the dev server (port 5173)
cd client && npm run dev
```

Open `http://localhost:5173` in your browser.

The client proxies all `/api` requests to the Express server automatically — no CORS setup needed.

---

## Setting up on your Synology NAS (DS224+)

This guide assumes you are familiar with DSM (the Synology interface in your browser) but have never used Docker or the command line. Every step uses the DSM graphical interface.

### Step 1 — Install Container Manager

1. Open **DSM** in your browser (usually `http://192.168.x.x:5000`).
2. Click on **Package Center** (the shopping bag icon on the desktop).
3. In the search box at the top, type `Container Manager`.
4. Click on **Container Manager** in the results, then click **Install**.
5. Wait for the installation to finish. When it is done, you will see it appear on your DSM desktop.

### Step 2 — Create a folder for the app data

The app stores all data in a single SQLite file. You need to create a dedicated folder on your NAS where this file will live, so it is never lost when you update the app.

1. Open **File Station** from the DSM desktop.
2. In the left panel, click on your main volume (usually called `volume1`).
3. Click the **Create** button (folder icon) at the top → **Create folder**.
4. Name the folder `docker`.
5. Open the `docker` folder you just created, then create another folder inside it named `budget`.
6. Inside `budget`, create one more folder named `data`.

You should now have the path `volume1/docker/budget/data`. This is where the database file will be stored.

### Step 3 — Get the app files onto your NAS

Enable SSH on your NAS: **DSM → Control Panel → Terminal & SNMP → Enable SSH service**.

Then open a terminal on your computer and connect:

```bash
ssh your-username@your-nas-ip
```

Clone the repository directly into the docker folder:

```bash
cd /volume1/docker
git clone https://github.com/wvdberge/budget-app.git
```

This creates `/volume1/docker/budget-app/` with all the app files.

### Step 4 — Build and start the app

Still in the SSH session, run:

```bash
cd /volume1/docker/budget-app
sudo docker compose up -d --build
```

This builds and starts the app. The first build takes a few minutes. When it finishes you will see `Started` in the output.

### Step 5 — Access the app

Once the project status shows **Running**:

1. Open a browser on any device connected to your home network.
2. Go to `http://[NAS-IP-address]:3000` — for example `http://192.168.1.100:3000`.
3. The budget app will load. Start by creating a profile.

To find your NAS IP address: open DSM → click on your username (top right) → **Control Panel** → **Network** → the IP address is shown there.

---

## Backing up the database

All your data lives in a single file: `volume1/docker/budget-app/data/budget.db`.

**To back it up:**

1. Open **File Station**.
2. Navigate to `docker/budget-app/data/`.
3. Right-click on `budget.db` → **Download**.

This saves a copy to your computer. Do this regularly, or set up Hyper Backup to include this folder in your existing backup schedule.

**To restore from backup:**

1. SSH into your NAS and run: `sudo docker compose -f /volume1/docker/budget-app/docker-compose.yml stop`
2. In File Station, navigate to `docker/budget-app/data/` and delete or rename the existing `budget.db`.
3. Upload your backup file and name it `budget.db`.
4. SSH in again and run: `sudo docker compose -f /volume1/docker/budget-app/docker-compose.yml start`

---

## Updating to a new version

Updating replaces the app code but never touches the `data/` folder, so your database is safe.

SSH into your NAS and run:

```bash
cd /volume1/docker/budget-app
git pull
sudo docker compose up -d --build
```

That's it. Refresh your browser and you're on the new version.

---

## CSV import — ABN AMRO

**How to export from ABN AMRO internet banking:**

1. Log in to `www.abnamro.nl`.
2. Go to your account overview and select the account you want to export.
3. Click on **Downloaden** (Download) — the button is usually near the transaction list.
4. Select the date range you want.
5. Choose the format **TXT** or **CSV** (not MT940).
6. Download the file.

**How to import into the budget app:**

1. Open the budget app and go to the **Transactions** view.
2. Click **Import CSV**.
3. Select **ABN AMRO** as the bank.
4. Select the account you are importing into.
5. Choose the file you downloaded.
6. Review the parsed transactions. For each row, the **Toewijzing** dropdown lets you pick either a category or a transfer destination (under *Overboeking naar*). Picking a transfer destination creates both legs of the transfer in one go. Rows that already exist on the target account (e.g. because you previously imported the other side of a transfer) are flagged *(al geïmporteerd)* and pre-deselected.
7. Click **Import**.

Tip: set up rules in **Beheer → Categorieregels** so recurring items (a monthly transfer to savings, a credit-card auto-debit, your supermarket) are auto-assigned every import. A rule's target can be a category *or* an account — the latter turns matching rows into transfers automatically.

---

## CSV import — ASN Bank

**How to export from ASN Bank internet banking:**

1. Log in to `www.asnbank.nl`.
2. Go to your account and click **Downloaden** or **Exporteren**.
3. Select the date range.
4. Choose **CSV** as the format.
5. Download the file.

**How to import into the budget app:**

Same steps as ABN AMRO above — select **ASN Bank** as the bank in step 3.
