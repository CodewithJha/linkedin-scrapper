// High-level orchestrator for the email finder logic.
// This module is intentionally standalone and does NOT modify or import
// any of the existing job-scraping pipeline.

import { generateEmailCandidates } from './patterns.js';
import { resolveCompanyDomain } from './domain.js';
import { verifyEmailCandidates } from './verifier.js';

/**
 * Core function for when we already know the person's name and the
 * company domain. This is useful for testing and for scenarios where
 * LinkedIn is only used as a hint source.
 *
 * @param {{ fullName?: string, firstName?: string, lastName?: string, domain: string }} input
 * @returns {Promise<{ bestEmail: string | null, candidates: string[], verifications: any[] }>}
 */
export async function findEmailWithKnownDomain(input) {
  const candidates = generateEmailCandidates(input);
  if (!candidates.length) {
    return {
      bestEmail: null,
      candidates: [],
      verifications: []
    };
  }

  const verifications = await verifyEmailCandidates(candidates);

  // For now, "best" is simply the first candidate with the highest confidence.
  let bestEmail = null;
  let bestScore = -1;

  for (const v of verifications) {
    const score =
      v.confidence === 'high'
        ? 3
        : v.confidence === 'medium'
        ? 2
        : v.confidence === 'low'
        ? 1
        : 0;

    if (score > bestScore) {
      bestScore = score;
      bestEmail = v.email;
    }
  }

  if (!bestEmail) {
    bestEmail = candidates[0] || null;
  }

  return {
    bestEmail,
    candidates,
    verifications
  };
}

/**
 * High-level entry point for the future: given a LinkedIn profile URL,
 * resolve name + company + domain, then compute email.
 *
 * This is intentionally left as a thin stub so we can decide together
 * how much LinkedIn HTML parsing vs. manual user input we want.
 *
 * @param {{ profileUrl: string, fullName?: string, companyName?: string, companyWebsiteUrl?: string }} input
 * @returns {Promise<{ bestEmail: string | null, candidates: string[], verifications: any[], meta: any }>}
 */
export async function findEmailFromLinkedInProfile(input) {
  const { profileUrl, fullName, companyName, companyWebsiteUrl } = input || {};

  // In the first iteration we rely on caller to provide at least
  // fullName + companyWebsiteUrl or fullName + resolved domain.
  const domain = await resolveCompanyDomain({ companyName, companyWebsiteUrl });

  if (!domain) {
    return {
      bestEmail: null,
      candidates: [],
      verifications: [],
      meta: {
        profileUrl: profileUrl || null,
        reason: 'missing-domain',
        fullName: fullName || null,
        companyName: companyName || null
      }
    };
  }

  const coreResult = await findEmailWithKnownDomain({
    fullName,
    domain
  });

  return {
    ...coreResult,
    meta: {
      profileUrl: profileUrl || null,
      fullName: fullName || null,
      companyName: companyName || null,
      domain
    }
  };
}

