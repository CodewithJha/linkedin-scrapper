# Startup-Filter Feature – Plan

## Goal
Add an optional **“Startups only”** checkbox (unchecked by default). When checked, the CSV export should contain jobs that are **mostly from startups** (smaller / early-stage companies) instead of large enterprises.

---

## Is It Possible? **Yes**

It is possible and can be implemented without changing how the rest of the scraper works. LinkedIn’s **public job search** does not expose a reliable “company size” or “startup” filter in the URL, so we cannot get “only startups” directly from the search. We can, however, **post-filter** the same scraped list using simple rules (and optionally later improve with description-based signals).

---

## Data We Have (No Change to Scraping)

From the current scraper, each job has:

| Field        | Example                    | Use for startup filter?     |
|-------------|----------------------------|-----------------------------|
| `title`     | "Data Engineer"            | Indirect (e.g. “startup” in title) |
| `company`   | "Acme Labs"                | **Yes** – main signal       |
| `location`  | "San Francisco, CA"        | No                          |
| `link`      | linkedin.com/jobs/view/…   | No                          |
| `techStack` | "python, sql, aws"         | No                          |
| `listedAt`  | "2026-02-10"               | No                          |
| `seniority` | "mid/unspecified"          | No                          |

We do **not** get company size, funding stage, or “startup” flag from LinkedIn on the listing page. So “startup” has to be **inferred** from what we have (mainly company name, and optionally job description if we already enrich).

---

## Proposed “Startup” Rules (Heuristic)

You can choose how strict you want to be. Below are two levels.

### Option A – Exclude known large companies (recommended baseline)

- **Rule:** Remove jobs where the **company name** matches a **blocklist** of well-known large enterprises (e.g. Fortune 500, big tech, large banks, consultancies).
- **Result:** The CSV keeps everything **except** jobs at those companies. So you get “mostly startups + mid-size + unknown”, which already skews toward startups and small companies.
- **Pros:** Simple, fast, no extra LinkedIn requests, no false negatives for weird company names.
- **Cons:** Some mid-size or non-startup companies still included; “startup” is implied by “not in blocklist”.

**Example blocklist (short):**  
Google, Microsoft, Amazon, Meta, Apple, Netflix, IBM, Oracle, Salesforce, Adobe, SAP, Cisco, Intel, Dell, HP, Accenture, Deloitte, McKinsey, Goldman Sachs, JPMorgan, etc.  
(We can maintain a configurable list in code or config.)

### Option B – Exclude large companies + prefer startup-like names (stricter)

- **Rule 1:** Same blocklist as in Option A (exclude known large companies).
- **Rule 2 (optional):** Optionally **boost** or **prefer** companies whose name contains typical startup-style tokens, e.g.:
  - "labs", "ventures", "studio", "io", "tech", "hq", "startup", "capital", "ventures"
- **Implementation:** Either (a) only keep jobs that pass Rule 1 and match Rule 2, or (b) keep all that pass Rule 1 but sort so that Rule-2 matches appear first. (a) is stricter “startups only”; (b) is “no big companies, startups first”.

You can start with **Option A** and add Option B later if you want a stricter “startup” feel.

---

## Optional: Use job description (if enrichJobDetails is on)

When **enrichJobDetails** is already true, we visit each job page and get the description (we use it for tech stack). We could:

- Parse the description text for **startup-like phrases**, e.g.  
  `"startup", "early stage", "series A", "series B", "fast-paced", "small team", "growing startup", "venture-backed"`.
- Mark the job with a flag, e.g. `isLikelyStartup: true/false`, and either:
  - **Filter:** When “Startups only” is on, keep only jobs with `isLikelyStartup === true`, or  
  - **Combine:** Require either “not in blocklist” (Option A) **or** `isLikelyStartup === true`.

This gives a better signal but:
- Only works when enrichment is on (slower, more requests).
- Can have false positives (e.g. “we’re not a startup” in text) and false negatives (no buzzwords).

Recommendation: implement **Option A first** (and optionally B), then add description-based signals as a second step if you want.

---

## Implementation Outline (No UI/Functionality Change Elsewhere)

1. **Config**
   - Add a flag, e.g. `startupsOnly: false` in `config.js` (default off).
   - Optionally: `startupCompanyBlocklist: []` (or path to a list) so you can maintain the big-company list without code changes.

2. **Backend**
   - **Blocklist:** Add a small module or array of known large company names (normalized: lowercase, trim). Match against `job.company` (e.g. “contains” or “equals” after normalizing).
   - **Filter step:** In `pipeline.js` (or a dedicated filter function used by pipeline):
     - After `filterNewJobs(scraped, seenData)` you have `jobs`.
     - If `config.startupsOnly === true`, filter `jobs` to remove entries whose company is in the blocklist (and optionally apply Option B).
   - **CSV:** Same as now; just pass the filtered list to `writeCsv`. Optionally add a column like `IsLikelyStartup` if we add description-based logic later.

3. **API / Trigger**
   - When the app triggers a scrape (e.g. from the UI or cron), pass `startupsOnly: true/false` from the checkbox into the run config so the pipeline uses it. No change to other parameters or behavior when the checkbox is off.

4. **UI**
   - Add a single checkbox “Startups only” (unchecked by default) next to the existing search parameters. On submit, send `startupsOnly: true` or `false` in the request body. No other UI or flow change.

5. **GitHub Action / workflow**
   - Optional: add an input like `startupsOnly` to the workflow so scheduled or manual runs can request startup-only CSVs. Same config flag, no new behavior when not set.

---

## Summary

| Question                         | Answer |
|----------------------------------|--------|
| Is it possible?                  | **Yes.** |
| Do we change how we scrape?      | **No.** Same search, same fields. |
| How do we define “startup”?      | **By rules:** exclude known big companies (blocklist) and optionally prefer startup-like company names; later optionally use description keywords. |
| Default behavior                 | Checkbox **unchecked** → same CSV as today (no filtering). |
| When checked                     | Apply startup filter before writing CSV; CSV contains “mostly startups” (and mid-size/unknown, depending on rules). |

If you want to proceed, the next step is to implement **Option A** (config flag + blocklist + filter in pipeline + checkbox in UI + API pass-through), then iterate with Option B or description-based rules if you want a stricter “startups only” result.
