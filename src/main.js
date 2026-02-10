import { loadConfig } from './config.js';
import { buildScheduler } from './scheduler.js';
import { runSession } from './pipeline.js';

const config = loadConfig();

async function runOnce() {
  try {
    const { csvPath, jobs } = await runSession(config);
    console.log(`[session] scraped ${jobs.length} jobs -> ${csvPath}`);
  } catch (err) {
    console.error('[session] failed', err);
  }
}

function start() {
  console.log(
    `[scheduler] starting with ${config.sessionsPerDay} sessions/day and gaps ${config.minGapHours}-${config.maxGapHours}h`
  );
  const scheduler = buildScheduler(
    {
      sessionsPerDay: config.sessionsPerDay,
      minGapHours: config.minGapHours,
      maxGapHours: config.maxGapHours
    },
    runOnce
  );
  scheduler.start();
}

start();
