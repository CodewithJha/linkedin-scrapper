## LinkedIn Scraper (Personal Job Pipeline)

Automated LinkedIn job scraper built with **Node.js**, **Playwright**, and **Express**.  
It runs scripted LinkedIn searches, collects job cards into CSV files, and exposes a simple UI to trigger runs and download recent exports.

This project is designed for **personal use** (your own job search), not for production / heavy multi-user traffic.

### Features

- **Playwright-based scraper** for LinkedIn job search pages (public search or logged-in with cookie).
- **Multi-keyword search** with 27 built-in job title variants (data engineer, ETL developer, Spark engineer, etc.) to catch all related roles.
- **Time filtering** - Only fetch jobs posted in the last 24 hours (`past24h`) or past week (`pastWeek`).
- **Cross-session deduplication** using LinkedIn jobId - never see the same job twice across runs (stored in `data/seen-jobs.json`).
- **Tech Stack extraction** - Automatically extracts required skills (Python, SQL, Spark, AWS, etc.) from job descriptions.
- **CSV exports** saved to an `out/` directory with timestamps, including a TechStack column.
- **Minimal web UI** (Express + static HTML/JS) to:
  - See pipeline status and sessions run today,
  - Trigger a run on demand,
  - Download recent CSV files.

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
├─ public/              # Static UI (index.html + app.js)
├─ src/                 # Application source
│  ├─ server.js         # Express server + API + scheduler bootstrap
│  ├─ main.js           # Scheduler entrypoint (automatic runs)
│  ├─ runOnce.js        # Single-session CLI entry (one scrape run)
│  ├─ scraper.js        # Playwright logic for LinkedIn jobs
│  ├─ pipeline.js       # "Business logic": runs scraper, writes CSV, sends email
│  ├─ fileWriter.js     # CSV writer (includes TechStack column)
│  ├─ techStack.js      # Tech stack extraction from job descriptions
│  ├─ mailer.js         # Email sender (optional)
│  ├─ config.js         # Config loader / defaults (.env + config.json)
│  ├─ deduplicator.js   # Cross-session dedup using jobId + link + title/company
│  └─ scheduler.js      # Simple randomised scheduler around runSession()
├─ data/
│  └─ seen-jobs.json    # Historical dedup store (safe to delete/reset)
├─ out/                 # Generated CSV exports (created at runtime)
├─ temp/                # Temporary directory for file uploads, etc.
├─ config.json          # User config (gitignored; see config.example.json)
├─ config.example.json  # Example config checked into the repo
├─ package.json
├─ package-lock.json
└─ README.md
```

---

## Getting Started (Local)

### 1. Requirements

- Node.js **18+** (recommended 20+)
- A modern browser environment (Playwright will download Chromium automatically)

### 2. Install dependencies

```bash
cd "D:\Linkedin Scrapper"  # or your cloned path
npm install
```

### 3. Create `config.json`

Copy the example and adjust for your use case:

```bash
cp config.example.json config.json
```

Then edit `config.json`:

- **keywords**: fallback search term if `keywordVariants` is empty (e.g. `"data engineer"`).
- **keywordVariants**: array of job title variations to search. The scraper cycles through all of them to find unique jobs. Default includes 27 variants like:
  - `data engineer`, `python data engineer`, `ETL developer`
  - `big data engineer`, `cloud data engineer`, `AWS data engineer`
  - `Databricks engineer`, `Spark engineer`, `Kafka engineer`
  - `analytics engineer`, `data warehouse engineer`, `SQL developer`
  - ...and more
- **location**: default location for searches (e.g. `"India"`, `"Remote"`).
- **resultsPerSession**: how many jobs you want per run (default: 40).
- **timePosted**: filter by posting time - `"past24h"`, `"pastWeek"`, or `"any"`.
- **enrichJobDetails**: set to `true` to extract tech stack from each job's description page (slower but more detailed).
- **sessionsPerDay / minGapHours / maxGapHours**: scheduler behaviour.
- **headless**: `true` to run Chromium headless, `false` to see the browser.
- **usePublicSearch**: `true` = no login; `false` = login via LinkedIn cookie.
- **includeKeywords**: only include jobs whose title/company contains these words.
- **excludeKeywords**: exclude jobs with these words in title (default excludes senior roles).
- **outputDir**: where CSVs are written (e.g. `"out"`).
- **email**: optional SMTP settings if you want email summaries.

If you want to log into LinkedIn to see more results, you can also provide a `LINKEDIN_COOKIE` in `.env` and `config.js` will pick it up.

---

## Running the Scraper

### Option A – Web UI (recommended while tuning)

Start the Express server:

```bash
npm start
```

Open the UI in your browser:

- If running locally with the current config, visit: `http://localhost:4001`

From there you can:

- See current status (jobs collected today, sessions run today),
- Override `keywords` / `location` / `results per session` for a single run,
- Trigger a run and then download the generated CSV from **Recent Exports**.

### Option B – Single run from CLI

To run one scrape session (no server / UI), use:

```bash
npm run scrape:once
```

This calls `src/runOnce.js`, which loads `config.json`, runs a single `runSession`, and writes a CSV to `out/`.

### Option C – Scheduled runs (local)

Use `src/main.js` as a scheduler entrypoint:

```bash
npm run start:scheduler
```

This will:

- Load your config,
- Schedule `runSession(config)` multiple times per day based on `sessionsPerDay`, `minGapHours`, and `maxGapHours`,
- Keep the process alive.

For a true "always on" scheduler, run this on an always-on machine (e.g. a small server, Raspberry Pi, or a PC that's left on), or via a cron-like system (Task Scheduler on Windows, `cron` on Linux).

---

## CSV Output Format

Each CSV export includes these columns:

| Column | Description |
|--------|-------------|
| Title | Job title |
| Company | Company name |
| Location | Job location |
| Link | Direct link to the job posting |
| ListedAt | When the job was posted (if available) |
| ScrapedAt | When we scraped this job |
| SeniorityHint | Detected seniority level (entry/intern, mid/unspecified, senior) |
| IsEntryLevel | Boolean - true for entry-level/intern roles |
| TechStack | Comma-separated list of technologies extracted from job description |

---

## Deduplication Behaviour

There are two dedup layers in this codebase:

- **Within a single session** (always active):
  - Implemented inside `scraper.js` using `sessionSeenLinks` and `sessionSeenJobIds` sets.
  - Prevents duplicate cards in the same CSV export.

- **Across multiple sessions** (always active):
  - Implemented in `deduplicator.js` using `data/seen-jobs.json`.
  - Uses **LinkedIn jobId** (numeric ID from URL) as primary key - more reliable than full URLs.
  - Falls back to link + title/company combo for edge cases.
  - If there are truly no new jobs for your query/time filter, a run can legitimately return 0 results.

If you want to "reset history" for testing, delete `data/seen-jobs.json`; it will be recreated automatically on the next run.

---

## Keyword Variants (Built-in)

The scraper comes with 27 pre-configured job title variants to catch data engineering roles with different names:

```
data engineer, python data engineer, ETL developer, data pipeline engineer,
big data engineer, cloud data engineer, AWS data engineer, Azure data engineer,
GCP data engineer, Databricks engineer, Spark engineer, data platform engineer,
analytics engineer, BI engineer, data infrastructure engineer, backend data engineer,
data integration engineer, Snowflake engineer, Airflow developer, Kafka engineer,
streaming data engineer, SQL developer, database developer, data warehouse engineer,
junior data engineer, associate data engineer, data engineering
```

You can customize this list in `config.json` by overriding `keywordVariants`.

---

## Notes on Deploying / Automation

This repo is optimised for **local use**. Some key points:

- The scraper uses **Playwright + Chromium**, which is heavier than typical serverless runtimes like Vercel Functions or Netlify Functions are comfortable with.
- The app writes CSV files to the **local filesystem** (`out/` directory).
- For fully automatic daily scraping you typically want:
  - An always-on environment (VPS / personal server / GitHub Actions runner with cron),
  - Persistence for CSVs (e.g. git commits, S3, or some other storage),
  - Optionally, a static UI (GitHub Pages, Vercel) that reads those CSVs.

Future iterations can add:

- A GitHub Actions workflow (`.github/workflows/scrape.yml`) that runs `npm run scrape:once` on a schedule and commits CSVs.
- A static version of the UI suitable for GitHub Pages, reading CSVs directly from the repo.

---

## License

This project is currently intended for **personal use only**.  
If you plan to open-source or share it publicly, consider adding an explicit license file (e.g. MIT) that matches how you want others to use it.
