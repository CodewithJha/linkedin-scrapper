import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const CONFIG_PATH = path.resolve(process.cwd(), 'config.json');

const defaultConfig = {
  keywords: 'data engineer',
  // If provided, the scraper will try these keyword variants one by one and merge unique results.
  // This helps catch roles that aren't titled exactly "Data Engineer" (e.g. "Data Pipeline Engineer", "Python Data Engineer").
  keywordVariants: [
    'data engineer',
    'python data engineer',
    'ETL developer',
    'data pipeline engineer',
    'big data engineer',
    'cloud data engineer',
    'AWS data engineer',
    'Azure data engineer',
    'GCP data engineer',
    'Databricks engineer',
    'Spark engineer',
    'data platform engineer',
    'analytics engineer',
    'BI engineer',
    'data infrastructure engineer',
    'backend data engineer',
    'data integration engineer',
    'Snowflake engineer',
    'Airflow developer',
    'Kafka engineer',
    'streaming data engineer',
    'SQL developer',
    'database developer',
    'data warehouse engineer',
    'junior data engineer',
    'associate data engineer',
    'data engineering'
  ],
  location: 'India',
  resultsPerSession: 40,
  sessionsPerDay: 1,
  minGapHours: 24,
  maxGapHours: 24,
  // Scheduling mode:
  // - "gap": existing behavior (run sessionsPerDay with random gaps between minGapHours/maxGapHours)
  // - "daily_ist": run once per day at `dailyIstTime` in IST (Asia/Kolkata), e.g. "10:00"
  scheduleMode: 'daily_ist',
  // Used only when scheduleMode = "daily_ist"
  dailyIstTime: '10:00',
  headless: true,
  usePublicSearch: true,
  // Time filter: "any" | "past24h" | "pastWeek"
  timePosted: 'past24h',
  // Enrich each job by visiting the job page and extracting a best-effort tech stack from the description.
  enrichJobDetails: true,
  outputDir: 'out',
  // Optional keyword filters for smarter targeting
  // These can be overridden in config.json
  includeKeywords: [], // e.g. ["python", "spark", "etl"]
  excludeKeywords: ['senior', 'sr', 'lead', 'manager', 'staff', 'principal', 'director'],
  email: {
    smtpHost: process.env.SMTP_HOST || '',
    smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
    smtpUser: process.env.SMTP_USER || '',
    smtpPass: process.env.SMTP_PASS || '',
    to: process.env.MAIL_TO || '',
    from: process.env.MAIL_FROM || ''
  },
  linkedInCookie: process.env.LINKEDIN_COOKIE || ''
};

export function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    return defaultConfig;
  }

  const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
  const userConfig = JSON.parse(raw);
  const merged = {
    ...defaultConfig,
    ...userConfig,
    email: {
      ...defaultConfig.email,
      ...(userConfig.email || {})
    }
  };

  // If the user changes the main `keywords` away from the default "data engineer"
  // but does NOT explicitly provide `keywordVariants`, we should not keep using
  // the Data Engineer‑specific variants. Otherwise, searches for other roles
  // (e.g. "frontend developer") will still be dominated by data‑engineer queries.
  const userProvidedVariants = Object.prototype.hasOwnProperty.call(
    userConfig,
    'keywordVariants'
  );
  const effectiveKeywords =
    typeof merged.keywords === 'string' ? merged.keywords.trim().toLowerCase() : '';
  const defaultKeywords = defaultConfig.keywords.trim().toLowerCase();

  if (!userProvidedVariants && effectiveKeywords && effectiveKeywords !== defaultKeywords) {
    merged.keywordVariants = [];
  }

  return merged;
}

export function ensureOutputDir(dirPath) {
  const resolved = path.resolve(process.cwd(), dirPath);
  if (!fs.existsSync(resolved)) {
    fs.mkdirSync(resolved, { recursive: true });
  }
  return resolved;
}
