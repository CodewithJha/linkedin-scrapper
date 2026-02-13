// Email verification layer.
// This module keeps verification lightweight and self-contained so it can
// run in serverless environments without extra dependencies.

import dns from 'dns';

const dnsPromises = dns.promises;

/**
 * Shape of a verification result.
 * @typedef {Object} VerificationResult
 * @property {string} email
 * @property {'high' | 'medium' | 'low' | 'unknown'} confidence
 * @property {boolean} deliverable
 * @property {string[]} [reasons]
 */

/**
 * Naive verifier: simply ranks the first candidate highest and
 * marks everything as "unknown" deliverability. This is used as a
 * safe fallback when DNS checks fail or aren't available.
 *
 * @param {string[]} candidates
 * @returns {Promise<VerificationResult[]>}
 */
export async function naiveVerifyCandidates(candidates = []) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return [];
  }

  return candidates.map((email, index) => ({
    email,
    confidence: index === 0 ? 'medium' : 'low',
    deliverable: false,
    reasons: ['naive-verifier']
  }));
}

/**
 * Placeholder hook for a future "smart" verifier.
 *
 * @param {string[]} candidates
 * @returns {Promise<VerificationResult[]>}
 */
export async function verifyEmailCandidates(candidates = []) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return [];
  }

  // Try a lightweight MX check for the domain of the first candidate.
  // If anything fails, fall back to naive behaviour.
  const first = String(candidates[0] || '');
  const [, domain] = first.split('@');

  if (!domain) {
    return naiveVerifyCandidates(candidates);
  }

  let hasMx = false;

  try {
    const records = await dnsPromises.resolveMx(domain);
    hasMx = Array.isArray(records) && records.length > 0;
  } catch {
    // DNS lookup failed (network / domain); treat as unknown and fall back.
    return naiveVerifyCandidates(candidates);
  }

  if (!hasMx) {
    // Domain has no MX; very unlikely to be a valid corporate email host.
    return candidates.map((email) => ({
      email,
      confidence: 'low',
      deliverable: false,
      reasons: ['no-mx-records']
    }));
  }

  // Domain looks like it accepts mail. Mark the first pattern as high
  // confidence and others as medium/low.
  return candidates.map((email, index) => ({
    email,
    confidence: index === 0 ? 'high' : index < 3 ? 'medium' : 'low',
    deliverable: true,
    reasons: ['mx-ok']
  }));
}

