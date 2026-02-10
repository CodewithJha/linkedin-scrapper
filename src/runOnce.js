import { loadConfig } from './config.js';
import { runSession } from './pipeline.js';

const config = loadConfig();

runSession(config)
  .then(({ csvPath, jobs }) => {
    console.log(`[manual] scraped ${jobs.length} jobs -> ${csvPath}`);
  })
  .catch((err) => {
    console.error('[manual] failed', err);
    process.exitCode = 1;
  });
