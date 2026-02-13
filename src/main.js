import { loadConfig } from './config.js';
import { buildScheduler, buildDailyIstScheduler } from './scheduler.js';
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
  const useDailyIst = config.scheduleMode === 'daily_ist';

  if (useDailyIst) {
    console.log(
      `[scheduler] starting in daily_ist mode at ${config.dailyIstTime || '10:00'} IST`
    );
  } else {
    console.log(
      `[scheduler] starting in gap mode with ${config.sessionsPerDay} sessions/day and gaps ${config.minGapHours}-${config.maxGapHours}h`
    );
  }

  const scheduler = useDailyIst
    ? buildDailyIstScheduler(
        {
          istTime: config.dailyIstTime
        },
        runOnce
      )
    : buildScheduler(
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
