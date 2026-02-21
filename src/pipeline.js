import { ensureOutputDir } from './config.js';
import { scrapeLinkedInJobs } from './scraper.js';
import { writeCsv } from './fileWriter.js';
import { sendResults } from './mailer.js';
import { loadSeenJobs, markJobsAsSeen, filterNewJobs } from './deduplicator.js';
import { filterStartupJobs } from './startupFilter.js';

export async function runSession(config) {
  const { keywords, location, resultsPerSession, outputDir, email, linkedInCookie, usePublicSearch, headless } =
    config;

  // Load cross-session history so we only return NEW jobs across days
  const seenData = loadSeenJobs();

  // Scrape jobs (session-level + cross-session dedup)
  const scraped = await scrapeLinkedInJobs(
    {
    keywords,
      keywordVariants: config.keywordVariants,
    location,
    resultsPerSession,
    linkedInCookie,
    usePublicSearch,
    headless,
    includeKeywords: config.includeKeywords,
      excludeKeywords: config.excludeKeywords,
      timePosted: config.timePosted,
      enrichJobDetails: config.enrichJobDetails
    },
    seenData
  );

  // Extra safety: filter again at pipeline level (covers any scraper edge cases)
  let jobs = filterNewJobs(scraped, seenData);

  // Optional: keep only jobs that look like startups (blocklist + name/description signals)
  if (config.startupsOnly && jobs.length > 0) {
    jobs = filterStartupJobs(jobs);
    console.log(`[pipeline] startupsOnly: filtered to ${jobs.length} startup-likely jobs`);
  }

  // Set isLikelyStartup for CSV when we applied startup filter (all kept jobs are likely startup)
  if (config.startupsOnly) {
    jobs.forEach((j) => { j.isLikelyStartup = true; });
  } else {
    jobs.forEach((j) => { j.isLikelyStartup = false; });
  }

  // Only save if we got jobs
  if (jobs.length > 0) {
    // Write CSV
    const targetDir = ensureOutputDir(outputDir);
    const csvPath = await writeCsv(jobs, targetDir);

    // Persist history AFTER a successful export so future sessions stay unique
    markJobsAsSeen(jobs, seenData);

    // Send email if configured (skip placeholder/example values)
    const hasPlaceholder = (str) => {
      if (!str) return true;
      const lower = str.toLowerCase();
      return lower.includes('example.com') || lower.includes('example_') || str === '';
    };
    
    const hasValidEmail = email?.to && email?.from && email?.smtpHost &&
      !hasPlaceholder(email.smtpHost) &&
      !hasPlaceholder(email.to) &&
      !hasPlaceholder(email.from);

    if (hasValidEmail) {
      try {
        await sendResults(email, csvPath, {
          keywords,
          location,
          count: jobs.length
        });
        console.log('[pipeline] Email sent successfully');
      } catch (err) {
        console.warn('[pipeline] Failed to send email:', err.message);
        console.log('[pipeline] Continuing despite email failure...');
      }
    } else if (email?.smtpHost) {
      console.log('[pipeline] Skipping email (placeholder config detected)');
    }

    return { csvPath, jobs };
  } else {
    console.log(`[pipeline] No new unique jobs found this session`);
    return { csvPath: null, jobs: [] };
  }
}
