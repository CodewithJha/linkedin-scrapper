// Utilities for resolving a company's primary domain.
// This module is intentionally light and pure-Node so it can be reused
// both in serverless (Vercel) and in GitHub Actions workflows.

/**
 * Best-effort extraction of hostname from a URL-like string.
 * Accepts inputs like "https://acme.com", "http://acme.com/careers",
 * or just "acme.com".
 *
 * @param {string} raw
 * @returns {string | null}
 */
export function extractHostname(raw = '') {
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  // If it's already a bare domain (no protocol, no spaces), return as-is.
  if (!trimmed.includes('://') && !/\s/.test(trimmed) && trimmed.includes('.')) {
    return trimmed.toLowerCase();
  }

  try {
    const url = new URL(trimmed);
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Placeholder / first-step resolver for a company domain.
 *
 * In the first iteration we keep this simple:
 * - If a company website URL is known, we just extract the hostname.
 * - Later, we can extend this to perform a search (e.g. using a web API)
 *   when only the company name is available.
 *
 * @param {{ companyName?: string, companyWebsiteUrl?: string }} input
 * @returns {Promise<string | null>}
 */
export async function resolveCompanyDomain(input = {}) {
  const { companyWebsiteUrl, companyName } = input;

  if (companyWebsiteUrl) {
    const host = extractHostname(companyWebsiteUrl);
    if (host) return host;
  }

  // Future extension: perform a search like "ACME official website" and
  // extract the primary domain from the results using a web API.
  // For now, we just return null if we don't have a direct website URL.
  if (companyName) {
    const cleaned = String(companyName).trim();
    if (!cleaned) return null;
  }

  return null;
}

