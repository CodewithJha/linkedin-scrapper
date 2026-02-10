import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { loadConfig, ensureOutputDir } from './config.js';
import { runSession } from './pipeline.js';
import { buildScheduler } from './scheduler.js';
import { getSeenJobsStats } from './deduplicator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = loadConfig();
const outputDir = ensureOutputDir(config.outputDir);

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/files', express.static(outputDir));

let isRunning = false;
let lastRun = null;
const sessionHistory = []; // Track all sessions with timestamps

function getSessionsToday() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return sessionHistory.filter((s) => new Date(s.at) >= todayStart).length;
}

function getTotalJobsToday() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return sessionHistory
    .filter((s) => new Date(s.at) >= todayStart)
    .reduce((sum, s) => sum + (s.count || 0), 0);
}

async function runNow(override = {}) {
  if (isRunning) {
    return { status: 'busy' };
  }

  isRunning = true;
  try {
    const runConfig = { ...config, ...override };
    const result = await runSession(runConfig);
    lastRun = {
      at: new Date().toISOString(),
      count: result.jobs.length,
      csvPath: result.csvPath
    };
    // Track this session
    sessionHistory.push({ ...lastRun });
    return { status: 'ok', ...lastRun };
  } catch (err) {
    return { status: 'error', message: err?.message || 'unknown error' };
  } finally {
    isRunning = false;
  }
}

app.get('/api/status', (_req, res) => {
  const dedupStats = getSeenJobsStats();
  const sessionsToday = getSessionsToday();
  const jobsToday = getTotalJobsToday();
  
  res.json({
    running: isRunning,
    lastRun,
    sessionsToday,
    jobsToday,
    schedule: {
      sessionsPerDay: config.sessionsPerDay,
      minGapHours: config.minGapHours,
      maxGapHours: config.maxGapHours
    },
    scraping: {
      keywords: config.keywords,
      keywordVariants: config.keywordVariants || [],
      location: config.location,
      resultsPerSession: config.resultsPerSession,
      timePosted: config.timePosted,
      enrichJobDetails: config.enrichJobDetails
    },
    deduplication: {
      totalJobsSeen: (dedupStats.totalJobIds || 0) + (dedupStats.totalLinks || 0),
      message: `${dedupStats.totalJobIds || 0} jobIds + ${dedupStats.totalLinks || 0} links tracked globally - no duplicates across sessions`
    }
  });
});

app.get('/api/files', (_req, res) => {
  const files = fs
    .readdirSync(outputDir)
    .filter((f) => f.endsWith('.csv'))
    .map((name) => {
      const full = path.join(outputDir, name);
      const stat = fs.statSync(full);
      return {
        name,
        url: `/files/${name}`,
        size: stat.size,
        modified: stat.mtime.toISOString()
      };
    })
    .sort((a, b) => new Date(b.modified) - new Date(a.modified))
    .slice(0, 20);
  res.json({ files });
});

app.post('/api/run', async (req, res) => {
  const { keywords, location, resultsPerSession } = req.body || {};
  const override = {};
  if (keywords) override.keywords = keywords;
  if (location) override.location = location;
  if (resultsPerSession) override.resultsPerSession = resultsPerSession;

  if (isRunning) {
    return res.status(409).json({ status: 'busy' });
  }

  const result = await runNow(override);
  if (result.status === 'error') {
    return res.status(500).json(result);
  }
  return res.json(result);
});

// Start scheduler for automatic sessions
const scheduler = buildScheduler(
  {
    sessionsPerDay: config.sessionsPerDay,
    minGapHours: config.minGapHours,
    maxGapHours: config.maxGapHours
  },
  runNow
);
scheduler.start();

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
  console.log(`UI and API running at http://localhost:${PORT}`);
  console.log(`CSV downloads served from /files`);
  console.log(`\n📝 DEBUG MODE: All file uploads will be logged to console\n`);
});
