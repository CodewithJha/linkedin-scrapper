// Email verification layer.
// IMPORTANT: This first iteration avoids any provider-specific APIs so we
// don't break existing deployments. It only defines the abstraction and a
// very naive "no-op" verifier that can be upgraded later.

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
 * marks everything as "unknown" deliverability. This allows us to wire
 * the feature end-to-end without introducing outbound SMTP or third-party
 * APIs yet (which can be added later with environment-based config).
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
 * In a later iteration, this function can:
 *  - Use MX record lookups + SMTP RCPT checks (where infrastructure allows),
 *  - Or call an HTTP-based verification API controlled via env vars.
 *
 * For now, we just delegate to the naive verifier so the rest of the
 * pipeline can be implemented and tested safely.
 *
 * @param {string[]} candidates
 * @returns {Promise<VerificationResult[]>}
 */
export async function verifyEmailCandidates(candidates = []) {
  return naiveVerifyCandidates(candidates);
}

