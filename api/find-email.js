// Vercel Serverless Function - Email finder entry point
// This does NOT touch the existing job scraper or GitHub workflow trigger.

import { findEmailFromLinkedInProfile, findEmailWithKnownDomain } from '../src/emailFinder/index.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      profileUrl,
      fullName,
      firstName,
      lastName,
      companyName,
      companyWebsiteUrl,
      domain
    } = req.body || {};

    // Two usage modes:
    // 1) Direct: caller already knows domain (and optionally name parts)
    // 2) LinkedIn-style: caller provides profileUrl + fullName + companyName/website

    if (!fullName && !firstName && !lastName) {
      return res.status(400).json({
        error: 'Missing name information. Provide fullName or firstName/lastName.'
      });
    }

    // Mode 1: explicit domain provided
    if (domain) {
      const result = await findEmailWithKnownDomain({
        fullName,
        firstName,
        lastName,
        domain
      });

      return res.status(200).json({
        mode: 'known-domain',
        ...result
      });
    }

    // Mode 2: attempt to resolve domain from companyWebsiteUrl / companyName
    if (!companyWebsiteUrl && !companyName) {
      return res.status(400).json({
        error:
          'Missing company information. Provide either domain directly, or companyWebsiteUrl/companyName.'
      });
    }

    const result = await findEmailFromLinkedInProfile({
      profileUrl,
      fullName,
      companyName,
      companyWebsiteUrl
    });

    return res.status(200).json({
      mode: 'linkedin-style',
      ...result
    });
  } catch (err) {
    console.error('[api/find-email] error', err);
    return res.status(500).json({
      error: 'Internal server error',
      details: err?.message || 'unknown'
    });
  }
}

