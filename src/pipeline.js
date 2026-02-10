import { ensureOutputDir } from './config.js';
import { scrapeLinkedInJobs } from './scraper.js';
import { writeCsv } from './fileWriter.js';
import { sendResults } from './mailer.js';
import { loadSeenJobs, markJobsAsSeen, filterNewJobs } from './deduplicator.js';

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
  const jobs = filterNewJobs(scraped, seenData);

  // Only save if we got jobs
  if (jobs.length > 0) {
    // Write CSV
    const targetDir = ensureOutputDir(outputDir);
    const csvPath = await writeCsv(jobs, targetDir);

    // Persist history AFTER a successful export so future sessions stay unique
    markJobsAsSeen(jobs, seenData);

    // Send email if configured
    if (email?.to && email?.from && email?.smtpHost) {
      await sendResults(email, csvPath, {
        keywords,
        location,
        count: jobs.length
      });
    }

    return { csvPath, jobs };
  } else {
    console.log(`[pipeline] No new unique jobs found this session`);
    return { csvPath: null, jobs: [] };
  }
}
