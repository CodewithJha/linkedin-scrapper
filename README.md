## LinkedIn Scraper (Personal Job Pipeline)

Automated LinkedIn job scraper built with **Node.js**, **Playwright**, and **Express**.  
It runs scripted LinkedIn searches, collects job cards into CSV files, and exposes a web UI to trigger runs and download recent exports.

This project is designed for **personal use** (your own job search), not for production or heavy multi-user traffic.

### Features

- **Playwright-based scraper** for LinkedIn job search pages (public search or logged-in with cookie).
- **Multi-keyword search** with configurable job title variants (data engineer, ETL developer, Spark engineer, etc.) to catch related roles.
- **Time filtering** – Only fetch jobs posted in the last 24 hours (`past24h`), past week (`pastWeek`), or any time (`any`).
- **Cross-session deduplication** using LinkedIn jobId – avoids duplicate jobs across runs (stored in `data/seen-jobs.json`).
- **Tech stack extraction** – Extracts required skills (Python, SQL, Spark, AWS, etc.) from job descriptions when `enrichJobDetails` is enabled.
- **CSV exports** in `out/` with timestamps, including TechStack, SeniorityHint, and IsEntryLevel columns.
- **Web UI** (single-page app in `public/`):
  - **Home** – Job scraper form (keywords, location, results, time filter), trigger a run, and **Recent Exports** list with download links.
  - **Email Scraper** – Dedicated page for email-based scraping.
  - **Exports** – Full list of recent CSV exports.
  - **About Us** – Project info and GitHub link.
  - Modern dark theme, responsive layout, and mobile bottom navigation.
- **GitHub Actions workflow** – Scheduled daily scrape and manual dispatch with optional inputs; CSVs can be committed to the repo.
- **Vercel-friendly** – Static UI in `public/` plus `api/trigger.js` to trigger the workflow from the deployed site (no Playwright on Vercel).

### Tech Stack

- **Runtime**: Node.js (ES modules)
- **Scraping**: Playwright (Chromium)
- **Web server**: Express
- **CSV export**: `csv-writer`
- **Email (optional)**: `nodemailer`

---

## Project Structure

```text
.
├── public/
│   └── index.html          # Single-page UI (job form, exports, email scraper, about)
├── api/
│   └── trigger.js          # Vercel serverless: POST to trigger GitHub Actions workflow
├── src/
│   ├── server.js           # Express server + API + scheduler bootstrap
│   ├── main.js             # Scheduler entrypoint (automatic runs)
│   ├── runOnce.js          # Single-session CLI (one scrape run)
│   ├── scraper.js          # Playwright logic for LinkedIn jobs
│   ├── pipeline.js         # Runs scraper, writes CSV, optional email
│   ├── fileWriter.js       # CSV writer (TechStack, SeniorityHint, IsEntryLevel)
│   ├── techStack.js        # Tech stack extraction from job descriptions
│   ├── mailer.js           # Email sender (optional)
│   ├── config.js           # Config loader (.env + config.json)
│   ├── deduplicator.js     # Cross-session dedup (jobId + link + title/company)
│   └── scheduler.js        # Randomized scheduler for runSession()
├── .github/workflows/
│   └── scrape.yml          # Daily cron + workflow_dispatch; runs scrape, commits CSV
├── data/
│   └── seen-jobs.json      # Dedup store (safe to delete to reset)
├── out/                    # Generated CSV exports (created at runtime)
├── config.json             # User config (gitignored; see config.example.json)
├── config.example.json     # Example config
├── package.json
└── README.md
```

---

## Getting Started (Local)

### 1. Requirements

- Node.js **18+** (recommended 20+)
- Playwright will download Chromium on first run.

### 2. Install dependencies

```bash
npm install
```

### 3. Create `config.json`

```bash
cp config.example.json config.json
```

Edit `config.json` as needed:

- **keywords** – Fallback search term (e.g. `"data engineer"`).
- **keywordVariants** – Array of job title variations to search (defaults include data engineer, ETL, Spark, etc.).
- **location** – Default location (e.g. `"India"`, `"Remote"`).
- **resultsPerSession** – Jobs per run (e.g. 40).
- **timePosted** – `"past24h"`, `"pastWeek"`, or `"any"`.
- **enrichJobDetails** – `true` to fetch each job page and extract tech stack (slower).
- **sessionsPerDay**, **minGapHours**, **maxGapHours** – Scheduler behaviour.
- **headless** – `true` for headless Chromium.
- **usePublicSearch** – `true` for no login; `false` to use LinkedIn cookie.
- **includeKeywords** / **excludeKeywords** – Filter jobs by title/company.
- **outputDir** – Where CSVs are written (e.g. `"out"`).
- **email** – Optional SMTP settings for summaries.

For logged-in scraping, set `LINKEDIN_COOKIE` in `.env`; `config.js` reads it.

---

## Running the Scraper

### Option A – Web UI (recommended)

```bash
npm start
```

Open **http://localhost:4001**. From the UI you can override keywords, location, results, and time filter, trigger a run, and download CSVs from Recent Exports (on Home or Exports page).

### Option B – Single run (CLI)

```bash
npm run scrape:once
```

Uses `config.json`, runs one session, writes CSV to `out/`.

### Option C – Scheduler (local)

```bash
npm run start:scheduler
```

Runs multiple sessions per day according to `sessionsPerDay` and gap settings. Suited to an always-on machine or cron/Task Scheduler.

---

## CSV Output Format

| Column        | Description |
|---------------|-------------|
| Title         | Job title |
| Company       | Company name |
| Location      | Job location |
| Link          | Direct link to the posting |
| ListedAt      | When the job was posted (if available) |
| ScrapedAt     | When we scraped it |
| SeniorityHint | Detected level (entry/intern, mid/unspecified, senior) |
| IsEntryLevel  | Boolean for entry-level/intern |
| TechStack     | Comma-separated technologies from description |

---

## Deduplication

- **Within a session** – In `scraper.js` via `sessionSeenLinks` and `sessionSeenJobIds`.
- **Across sessions** – In `deduplicator.js` using `data/seen-jobs.json` (LinkedIn jobId, with fallback to link + title/company).

Delete `data/seen-jobs.json` to reset history; it is recreated on the next run.

---

## Deployment (GitHub Actions + Vercel)

- **`.github/workflows/scrape.yml`** runs on a schedule (e.g. daily) and on `workflow_dispatch` with optional inputs (keywords, location, results, timePosted). It runs `npm run scrape:once` and can commit CSVs to the repo.
- **Vercel**: Deploy the repo with the static site from `public/` and the serverless function `api/trigger.js`. Set `GITHUB_TOKEN` in Vercel so the UI can trigger the workflow. The actual scraping runs in GitHub Actions, not on Vercel.

---

## License

This project is for **personal use**. Add an explicit license **(e.g. MIT)** and Give the **Credits** if You're cloning the Repo and using it for your Personal usecase :)
