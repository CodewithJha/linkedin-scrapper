import fs from 'fs';
import path from 'path';

// Human-readable log file for email finder lookups.
// Each line is plain text, e.g.:
// time=... | mode=... | name=... | profile=... | company=... | domain=... | bestEmail=... | confidence=...
const LOG_FILE = path.resolve(process.cwd(), 'data', 'email-lookups.log');

function ensureLogDir() {
  const dir = path.dirname(LOG_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Append one email lookup event as a human-readable line.
 * This MUST never throw – failures are logged to console only.
 *
 * @param {{ input: any, mode: string, result: any }} payload
 */
export function logEmailLookup(payload) {
  try {
    ensureLogDir();

    const input = payload.input || {};
    const result = payload.result || {};

    const fullNameFromInput =
      input.fullName ||
      [input.firstName || '', input.lastName || ''].join(' ').trim() ||
      '';

    const domainFromInput = input.domain || input.companyWebsiteUrl || '';

    const verifications = Array.isArray(result.verifications)
      ? result.verifications
      : [];

    const bestVerification =
      verifications.find((v) => v.email === result.bestEmail) ||
      verifications[0] ||
      null;

    const confidence = bestVerification?.confidence || 'unknown';

    const fields = [
      `time=${new Date().toISOString()}`,
      `mode=${payload.mode || 'unknown'}`,
      `name=${fullNameFromInput}`,
      `profile=${input.profileUrl || ''}`,
      `company=${input.companyName || ''}`,
      `websiteOrDomain=${domainFromInput}`,
      `bestEmail=${result.bestEmail || ''}`,
      `confidence=${confidence}`
    ];

    const line = fields.join(' | ');

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

