import fs from 'fs';
import path from 'path';

const LOG_FILE = path.resolve(process.cwd(), 'data', 'email-lookups.jsonl');

function ensureLogDir() {
  const dir = path.dirname(LOG_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Append one email lookup event as a JSON line.
 * This MUST never throw – failures are logged to console only.
 *
 * @param {{ input: any, mode: string, result: any }} payload
 */
export function logEmailLookup(payload) {
  try {
    ensureLogDir();
    const event = {
      at: new Date().toISOString(),
      mode: payload.mode || 'unknown',
      input: payload.input || {},
      result: payload.result || {}
    };
    const line = JSON.stringify(event);
    fs.appendFile(LOG_FILE, `${line}\n`, (err) => {
      if (err) {
        // Silent-ish failure, only log to server console
        console.error('[emailLogger] append failed', err.message);
      }
    });
  } catch (err) {
    console.error('[emailLogger] unexpected error', err.message);
  }
}

