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

    // Send email if configured (skip example/placeholder values)
    const isValidEmail = email?.to && 
                        email?.from && 
                        email?.smtpHost && 
                        !email.smtpHost.includes('example.com') &&
                        !email.to.includes('example.com') &&
                        !email.from.includes('example.com');
    
    if (isValidEmail) {
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
    } else {
      console.log('[pipeline] Skipping email (no valid email config)');
    }

    return { csvPath, jobs };
  } else {
    console.log(`[pipeline] No new unique jobs found this session`);
    return { csvPath: null, jobs: [] };
  }
}
