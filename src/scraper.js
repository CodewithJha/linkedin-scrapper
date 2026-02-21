import { chromium } from 'playwright';
import { canonicalizeLinkedInJobLink, extractLinkedInJobId } from './deduplicator.js';
import { extractTechStack } from './techStack.js';
import { hasStartupBuzzwordsInDescription } from './startupFilter.js';

const randomInRange = (min, max) => Math.random() * (max - min) + min;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function buildSearchUrl({ keywords, location, start = 0, timePosted = 'any' }) {
  const q = new URLSearchParams({
    keywords,
    location,
    trk: 'public_jobs_jobs-search-bar_search-submit',
    position: '1',
    pageNum: '0',
    start: String(start),
    sortBy: 'DD' // Sort by date for more variety
  });

  // Time posted filter (best-effort; LinkedIn accepts f_TPR values)
  if (timePosted === 'past24h') q.set('f_TPR', 'r86400');
  if (timePosted === 'pastWeek') q.set('f_TPR', 'r604800');
  return `https://www.linkedin.com/jobs/search/?${q.toString()}`;
}

async function applyLinkedInCookie(context, cookieString) {
  if (!cookieString) return;
  const cookies = cookieString
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [name, ...rest] = item.split('=');
      return {
        name,
        value: rest.join('='),
        domain: '.linkedin.com',
        path: '/',
        httpOnly: true,
        secure: true
      };
    });
  if (cookies.length) {
    await context.addCookies(cookies);
  }
}

async function clickShowMoreButton(page) {
  try {
    // Try multiple button selectors
    const selectors = [
      'button.infinite-scroller__show-more-button',
      'button[aria-label*="more jobs"]',
      'button[aria-label*="See more"]',
      '.see-more-jobs button'
    ];
    
    for (const sel of selectors) {
      const btn = await page.$(sel);
      if (btn) {
        const isVisible = await btn.isVisible();
        if (isVisible) {
          await btn.click();
          await sleep(randomInRange(1500, 2500));
          return true;
        }
      }
    }
  } catch {
    // Button not found or not clickable
  }
  return false;
}

async function getJobCount(page) {
  // Try multiple selectors for job cards
  const selectors = [
    'ul.jobs-search__results-list li',
    '.jobs-search__results-list .job-search-card',
    '.job-search-card',
    '[data-job-id]'
  ];
  
  for (const sel of selectors) {
    try {
      const count = await page.$$eval(sel, (nodes) => nodes.length);
      if (count > 0) return { count, selector: sel };
    } catch {
      continue;
    }
  }
  return { count: 0, selector: 'ul.jobs-search__results-list li' };
}

async function collectJobs(page, limit) {
  let lastCount = 0;
  let noChangeRounds = 0;

  // Scroll aggressively to load all jobs on this page.
  // IMPORTANT: LinkedIn often renders the results list inside a scrollable
  // container, not the main window, so we explicitly scroll that container.
  for (let i = 0; i < 80 && lastCount < limit; i += 1) {
    await page.evaluate(() => {
      const selectors = [
        '[data-test-reusables-search__results-list]',
        '.jobs-search-two-pane__results-list',
        '.jobs-search__results-list',
        '.jobs-search-results-list'
      ];

      let container = null;
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
          container = el;
          break;
        }
      }

      if (!container) {
        // Fallback to whole-page scroll if container is not found
        container = document.scrollingElement || document.body;
      }

      container.scrollBy(0, 600);
    });

    await sleep(randomInRange(400, 800));

    // Periodically force scroll to bottom + click "show more"
    if (i % 4 === 0) {
      await page.evaluate(() => {
        const selectors = [
          '[data-test-reusables-search__results-list]',
          '.jobs-search-two-pane__results-list',
          '.jobs-search__results-list',
          '.jobs-search-results-list'
        ];

        let container = null;
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) {
            container = el;
            break;
          }
        }

        if (!container) {
          container = document.scrollingElement || document.body;
        }

        container.scrollTo(0, container.scrollHeight);
      });

      await sleep(randomInRange(800, 1200));
      await clickShowMoreButton(page);
    }

    const { count: now } = await getJobCount(page);

    if (now === lastCount) {
      noChangeRounds++;
      if (noChangeRounds >= 8) {
        // Final attempt to load more
        await clickShowMoreButton(page);
        await sleep(2000);
        break;
      }
    } else {
      noChangeRounds = 0;
    }
    lastCount = now;
  }

  // Extract ALL job cards from the page using multiple selectors
  const rawJobs = await page.evaluate(() => {
    const results = [];
    
    // Try multiple container selectors
    const containers = [
      ...document.querySelectorAll('ul.jobs-search__results-list li'),
      ...document.querySelectorAll('.jobs-search__results-list .base-card'),
      ...document.querySelectorAll('.job-search-card'),
      ...document.querySelectorAll('[data-entity-urn*="jobPosting"]'),
      ...document.querySelectorAll('.base-search-card')
    ];
    
    const seen = new Set();
    
    for (const node of containers) {
      // Find link
      const linkEl = node.querySelector('a[href*="/jobs/view"]') || 
                     node.querySelector('a.base-card__full-link') ||
                     node.closest('a[href*="/jobs/view"]');
      
      let href = linkEl?.href || linkEl?.getAttribute('href') || null;
      if (!href || !href.includes('/jobs/view')) continue;
      // Strip query string to canonicalize in browser context
      href = href.split('?')[0];
      
      if (seen.has(href)) continue;
      seen.add(href);
      
      // Find title
      const titleEl = node.querySelector('h3') || 
                      node.querySelector('.base-search-card__title') ||
                      node.querySelector('[class*="title"]');
      
      // Find company
      const companyEl = node.querySelector('h4') || 
                        node.querySelector('.base-search-card__subtitle') ||
                        node.querySelector('a[data-tracking-control-name*="company"]');
      
      // Find location
      const locationEl = node.querySelector('.job-search-card__location') ||
                         node.querySelector('.base-search-card__metadata') ||
                         node.querySelector('[class*="location"]');
      
      const timeEl = node.querySelector('time');

      const titleText = titleEl?.innerText?.trim() || null;
      const companyText = companyEl?.innerText?.trim() || null;

      // Filter out obviously broken cards that would create duplicates
      // (missing both title and company)
      if (!titleText && !companyText) continue;

      results.push({
        title: titleText,
        company: companyText,
        location: locationEl?.innerText?.trim() || null,
        link: href,
        listedAt: timeEl?.getAttribute('datetime') || null
      });
    }
    
    return results;
  });

  // Post-process in Node.js context to canonicalize links and extract jobIds
  const jobs = rawJobs.map((job) => ({
    ...job,
    link: canonicalizeLinkedInJobLink(job.link),
    jobId: extractLinkedInJobId(job.link)
  }));

  // Deduplicate by link and title+company
  const seenLinks = new Set();
  const seenJobIds = new Set();
  const seenTitleCompany = new Set();
  const unique = [];

  for (const job of jobs) {
    if (!job.link) continue;

    const jobId = job.jobId || extractLinkedInJobId(job.link);
    if (jobId && seenJobIds.has(String(jobId))) continue;

    if (seenLinks.has(job.link)) continue;
    
    const titleCompanyKey = `${(job.title || '').toLowerCase()}|${(job.company || '').toLowerCase()}`;
    if (seenTitleCompany.has(titleCompanyKey)) continue;

    seenLinks.add(job.link);
    if (jobId) seenJobIds.add(String(jobId));
    seenTitleCompany.add(titleCompanyKey);
    unique.push(job);

    if (unique.length >= limit) break;
  }

  return unique;
}

async function scrapeOnePage(page, limit) {
  // Wait for job list to appear (try multiple selectors)
  try {
    await page.waitForSelector('ul.jobs-search__results-list li, .jobs-search__results-list .job-search-card, .base-card', { timeout: 20_000 });
  } catch {
    // Try alternate selector for newer LinkedIn layout
    try {
      await page.waitForSelector('.job-search-card, .base-card', { timeout: 10_000 });
    } catch {
      // Last resort
      await sleep(3000);
    }
  }

  return await collectJobs(page, limit);
}

export async function scrapeLinkedInJobs(options, globalSeenData = null) {
  const {
    keywords,
    keywordVariants = [],
    location,
    resultsPerSession,
    headless,
    linkedInCookie,
    usePublicSearch,
    includeKeywords = [],
    excludeKeywords = [],
    timePosted = 'any',
    enrichJobDetails = false
  } = options;

  const browser = await chromium.launch({
    headless,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    viewport: {
      width: 1366 + Math.floor(Math.random() * 50),
      height: 768 + Math.floor(Math.random() * 50)
    },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
  });

  if (!usePublicSearch && linkedInCookie) {
    await applyLinkedInCookie(context, linkedInCookie);
  }

  const page = await context.newPage();
  
  // Normalized keyword filters
  const includeKw = (includeKeywords || []).map((k) => String(k).toLowerCase().trim()).filter(Boolean);
  const excludeKw = (excludeKeywords || []).map((k) => String(k).toLowerCase().trim()).filter(Boolean);

  const queries =
    Array.isArray(keywordVariants) && keywordVariants.filter((k) => String(k).trim()).length > 0
      ? keywordVariants.map((k) => String(k).trim())
      : [String(keywords || '').trim()];

  // Collect jobs from multiple queries and pages
  const allJobs = [];
  const sessionSeenLinks = new Set();
  const sessionSeenJobIds = new Set();
  const sessionSeenTitleCompany = new Set();
  const jobsPerPage = 25; // LinkedIn shows ~25 jobs per page

  const desiredLocation = (location || '').toLowerCase().trim();
  const isRemoteSearch = /remote|anywhere|global|worldwide/.test(desiredLocation);

  for (const query of queries) {
    if (!query) continue;
    if (allJobs.length >= resultsPerSession) break;

    // Increase max pages to ensure we get enough unique jobs (buffer for duplicates)
    const maxPages = Math.ceil(resultsPerSession / jobsPerPage) * 3;
    const maxAttempts = 10;
    let noNewJobsCount = 0;

    for (let pageNum = 0; pageNum < maxPages && allJobs.length < resultsPerSession; pageNum++) {
      const startOffset = pageNum * jobsPerPage;
      const targetUrl = buildSearchUrl({
        keywords: query,
        location,
        start: startOffset,
        timePosted
      });

      try {
        await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 60_000 });
      } catch {
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      }
      await sleep(randomInRange(2000, 3500));

      const pageJobs = await scrapeOnePage(page, 100);

      // Filter jobs by location to better respect the requested city/country.
      let filteredPageJobs = pageJobs;
      if (desiredLocation && !isRemoteSearch) {
        filteredPageJobs = pageJobs.filter((job) => {
          const loc = (job.location || '').toLowerCase();
          if (!loc) return false;

          const tokens = desiredLocation
            .replace(/[,-]/g, ' ')
            .split(/\s+/)
            .filter(Boolean);

          const matchesToken =
            tokens.length === 0 ? true : tokens.some((t) => t && loc.includes(t));

          const asksBangalore = /bangalore|banglore|bengaluru/.test(desiredLocation);
          if (asksBangalore && !/bangalore|banglore|bengaluru/.test(loc)) return false;

          const asksIndia = desiredLocation.includes('india');
          if (asksIndia && !loc.includes('india')) return false;

          return matchesToken;
        });
      }

      const jobsBeforeThisPage = allJobs.length;

      const keywordFilteredJobs = filteredPageJobs.filter((job) => {
        const text = `${job.title || ''} ${job.company || ''}`.toLowerCase();

        if (includeKw.length > 0 && !includeKw.some((kw) => text.includes(kw))) return false;
        if (excludeKw.length > 0 && excludeKw.some((kw) => text.includes(kw))) return false;
        return true;
      });

      for (const job of keywordFilteredJobs) {
        if (!job.link) continue;
        job.link = canonicalizeLinkedInJobLink(job.link);
        job.jobId = job.jobId || extractLinkedInJobId(job.link);

        const jobId = job.jobId ? String(job.jobId) : null;

        if (jobId && sessionSeenJobIds.has(jobId)) continue;
        if (sessionSeenLinks.has(job.link)) continue;

        const titleCompanyKey = `${(job.title || '').toLowerCase()}|${(job.company || '').toLowerCase()}`;
        if (sessionSeenTitleCompany.has(titleCompanyKey)) continue;

        // Skip if seen in previous sessions (global deduplication)
        if (globalSeenData) {
          if (jobId && globalSeenData.jobIds?.has(jobId)) continue;
          if (globalSeenData.links?.has(job.link)) continue;
          if (globalSeenData.titleCompanyKeys?.has(titleCompanyKey)) continue;
        }

        if (jobId) sessionSeenJobIds.add(jobId);
        sessionSeenLinks.add(job.link);
        sessionSeenTitleCompany.add(titleCompanyKey);
        allJobs.push(job);

        if (allJobs.length >= resultsPerSession) break;
      }

      if (allJobs.length === jobsBeforeThisPage) {
        noNewJobsCount++;
        if (noNewJobsCount >= maxAttempts) {
          console.log(`[scraper] No new unique jobs after ${maxAttempts} pages for query "${query}", stopping pagination`);
          break;
        }
      } else {
        noNewJobsCount = 0;
      }

      if (pageJobs.length === 0) break;

      if (allJobs.length < resultsPerSession) {
        await sleep(randomInRange(2500, 4500));
      }
    }
  }

  console.log(`[scraper] Collected ${allJobs.length} unique jobs (requested: ${resultsPerSession})`);

  const nowIso = new Date().toISOString();

  // Optionally enrich with description -> tech stack (best-effort, can fail silently)
  if (enrichJobDetails && allJobs.length > 0) {
    for (const job of allJobs) {
      try {
        await page.goto(job.link, { waitUntil: 'domcontentloaded', timeout: 60_000 });
        await sleep(randomInRange(900, 1500));

        const descriptionText = await page.evaluate(() => {
          const selectors = [
            '.show-more-less-html__markup',
            '.description__text',
            '.jobs-description__content',
            '[data-test-job-description]'
          ];
          for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el && el.textContent) return el.textContent;
          }
          return '';
        });

        const stack = extractTechStack(descriptionText);
        job.techStack = stack.join(', ');
        job.startupSignalsFromDescription = hasStartupBuzzwordsInDescription(descriptionText);
      } catch {
        job.techStack = job.techStack || '';
        job.startupSignalsFromDescription = false;
      }

      // Small delay between job pages to reduce blocking risk
      await sleep(randomInRange(800, 1400));
    }
  } else {
    for (const job of allJobs) {
      job.techStack = job.techStack || '';
      job.startupSignalsFromDescription = false;
    }
  }

  await browser.close();

  // Add simple seniority hints based on job title
  return allJobs.map((job) => {
    const title = (job.title || '').toLowerCase();

    let seniority = 'mid/unspecified';
    let isEntryLevel = false;

    if (/(intern|internship|entry level|graduate|fresher|junior)/.test(title)) {
      seniority = 'entry/intern';
      isEntryLevel = true;
    } else if (/(senior|sr\.?|lead|manager|staff|principal|director|head)/.test(title)) {
      seniority = 'senior';
    }

    return {
      ...job,
      scrapedAt: nowIso,
      seniority,
      isEntryLevel
    };
  });
}
