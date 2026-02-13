// Utility for generating common corporate email patterns from a name + domain.
// This file is completely standalone and does not touch the existing job scraper.

/**
 * Normalize a name string into safe components for email generation.
 * @param {string} fullName
 * @returns {{ first: string, last: string, fi: string, li: string }}
 */
export function splitName(fullName = '') {
  const cleaned = String(fullName).trim().toLowerCase();
  if (!cleaned) {
    return { first: '', last: '', fi: '', li: '' };
  }

  const parts = cleaned
    .split(/\s+/)
    .filter(Boolean)
    // Strip common suffixes/titles if present
    .filter((p) => !['mr', 'mrs', 'ms', 'dr', 'sir'].includes(p.replace(/\./g, '')));

  if (parts.length === 0) {
    return { first: '', last: '', fi: '', li: '' };
  }

  const first = parts[0];
  const last = parts.length > 1 ? parts[parts.length - 1] : '';
  const fi = first ? first[0] : '';
  const li = last ? last[0] : '';

  return { first, last, fi, li };
}

/**
 * Generate a ranked list of candidate corporate emails for a person.
 * This is purely deterministic and does not perform any network I/O.
 *
 * @param {{ fullName?: string, firstName?: string, lastName?: string, domain: string }} input
 * @returns {string[]} ordered list of candidate emails
 */
export function generateEmailCandidates(input) {
  const domainRaw = String(input.domain || '').trim().toLowerCase();
  if (!domainRaw) return [];

  // Strip protocol and path if user accidentally passes full URL
  let domain = domainRaw;
  try {
    if (domainRaw.startsWith('http://') || domainRaw.startsWith('https://')) {
      const url = new URL(domainRaw);
      domain = url.hostname.toLowerCase();
    }
  } catch {
    // If URL parsing fails, fall back to raw
    domain = domainRaw;
  }

  const nameParts = (() => {
    const { firstName, lastName, fullName } = input;
    if (firstName || lastName) {
      const fn = String(firstName || '').trim().toLowerCase();
      const ln = String(lastName || '').trim().toLowerCase();
      const fi = fn ? fn[0] : '';
      const li = ln ? ln[0] : '';
      return { first: fn, last: ln, fi, li };
    }
    return splitName(fullName || '');
  })();

  const { first, last, fi, li } = nameParts;
  if (!first && !last) return [];

  const base = [];

  // Most common corporate patterns (rough order of likelihood)
  if (first && last) {
    base.push(`${first}.${last}`, `${first}${last}`, `${fi}${last}`, `${first}${li}`, `${last}${first}`, `${last}.${first}`);
  }

  if (first) {
    base.push(first, `${fi}${last || ''}`.trim());
  }

  if (last) {
    base.push(last);
  }

  // Remove empties / duplicates and attach domain
  const seen = new Set();
  const candidates = [];

  for (const local of base) {
    const cleanedLocal = String(local || '')
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '')
      .replace(/\.+/g, '.')
      .replace(/^\.|\.$/g, '');

    if (!cleanedLocal) continue;
    const email = `${cleanedLocal}@${domain}`;
    if (!seen.has(email)) {
      seen.add(email);
      candidates.push(email);
    }
  }

  return candidates;
}

