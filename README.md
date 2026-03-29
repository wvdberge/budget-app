# Budget

A personal budgeting app for private home use. Runs on your Synology NAS, accessible in your browser on any device on your home network.

**Features:**
- Multiple isolated budget profiles (e.g. Personal, Family)
- Two-level categories: groups → subcategories with monthly targets
- YNAB-style rollover: unspent amounts carry forward each month
- Transactions with manual entry and CSV import (ABN AMRO, ASN Bank)
- Recurring transactions that pre-fill each month
- Per-month budget overview: target / spent / available per category
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

### Step 3 — Copy the app files to your NAS

You need to get the app files onto your NAS. The easiest way is via File Station.

1. On your computer, download or copy the entire `budget` app folder.
2. Open **File Station** on your NAS.
3. Navigate to `docker/budget/`.
4. Click the **Upload** button at the top and upload all the app files (everything except the `data` folder — that stays empty for now).

Alternatively, if your NAS has the **Git** package installed, you can clone the repository directly into `docker/budget/`.

### Step 4 — Create the Container Manager project

1. Open **Container Manager** from the DSM desktop.
2. In the left panel, click on **Project**.
3. Click the **Create** button at the top.
4. Fill in the form:
   - **Project name:** `budget`
   - **Path:** click **Set Path** and navigate to `docker/budget` — select that folder.
   - Container Manager will automatically detect the `docker-compose.yml` file inside.
5. Click **Next**.
6. On the next screen, you will see a preview of the compose configuration. Do not change anything.
7. Click **Next**, then **Done**.

Container Manager will now build the app (this takes a few minutes the first time — it is downloading and compiling everything). You can watch the progress in the **Logs** tab.

### Step 5 — Access the app

Once the project status shows **Running**:

1. Open a browser on any device connected to your home network.
2. Go to `http://[NAS-IP-address]:3000` — for example `http://192.168.1.100:3000`.
3. The budget app will load. Start by creating a profile.

To find your NAS IP address: open DSM → click on your username (top right) → **Control Panel** → **Network** → the IP address is shown there.

---

## Backing up the database

All your data lives in a single file: `volume1/docker/budget/data/budget.db`.

**To back it up:**

1. Open **File Station**.
2. Navigate to `docker/budget/data/`.
3. Right-click on `budget.db` → **Download**.

This saves a copy to your computer. Do this regularly, or set up Hyper Backup to include this folder in your existing backup schedule.

**To restore from backup:**

1. Stop the Budget project in Container Manager (select the project → **Action** → **Stop**).
2. In File Station, navigate to `docker/budget/data/` and delete or rename the existing `budget.db`.
3. Upload your backup file and name it `budget.db`.
4. Start the project again in Container Manager.

---

## Updating to a new version

Updating replaces the app code but never touches the `data/` folder, so your database is safe.

1. In **Container Manager**, select the `budget` project → **Action** → **Stop**. Wait until it stops.
2. In **File Station**, open `docker/budget/`. Delete all files and folders **except the `data/` folder**.
3. Upload the new version's files into `docker/budget/` (same as Step 3 above).
4. In **Container Manager**, select the `budget` project → **Action** → **Build**. This rebuilds the app with the new code.
5. Once the build finishes, click **Action** → **Start**.
6. Refresh your browser. You are now on the new version.

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
6. Review the parsed transactions. You can assign a category to each one before importing.
7. Click **Import**.

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
