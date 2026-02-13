// Utilities for resolving a company's primary domain.
// This module is intentionally light and pure-Node so it can be reused
// both in serverless (Vercel) and in GitHub Actions workflows.

/**
 * Best-effort extraction of hostname from a URL-like or domain-like string.
 * Accepts inputs like "https://acme.com", "http://acme.com/careers",
 * "acme.com" or "sub.acme.com".
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
 * Resolve a company domain from various hints.
 *
 * Resolution order (first non-empty wins):
 * 1. Explicit `domain` field (e.g. "acme.com")
 * 2. `companyWebsiteUrl` (e.g. "https://acme.com/careers")
 * 3. (Future) `companyName` via web search / mapping
 *
 * @param {{ domain?: string, companyName?: string, companyWebsiteUrl?: string }} input
 * @returns {Promise<string | null>}
 */
export async function resolveCompanyDomain(input = {}) {
  const { domain, companyWebsiteUrl, companyName } = input;

  if (domain) {
    const hostFromDomain = extractHostname(domain);
    if (hostFromDomain) return hostFromDomain;
  }

  if (companyWebsiteUrl) {
    const host = extractHostname(companyWebsiteUrl);
    if (host) return host;
  }

  // Future extension: perform a search like "ACME official website" and
  // extract the primary domain from the results using a web API when only
  // companyName is available.
  if (companyName) {
    const cleaned = String(companyName).trim();
    if (!cleaned) return null;
  }

  return null;
}

