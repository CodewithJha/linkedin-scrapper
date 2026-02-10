import fs from 'fs';
import path from 'path';

const SEEN_JOBS_FILE = path.resolve(process.cwd(), 'data', 'seen-jobs.json');

function normalizeWhitespace(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractLinkedInJobId(link) {
  if (!link) return null;
  try {
    const u = new URL(link);

    // Common form: /jobs/view/1234567890/
    const m = u.pathname.match(/\/jobs\/view\/(\d+)/);
    if (m?.[1]) return m[1];

    // Sometimes job id is in query params (e.g. currentJobId=...)
    const q =
      u.searchParams.get('currentJobId') ||
      u.searchParams.get('jobId') ||
      u.searchParams.get('jk');
    if (q && /^\d+$/.test(q)) return q;
  } catch {
    // If it's not a valid URL, fall back to regex on the raw string
    const m = String(link).match(/\/jobs\/view\/(\d+)/);
    if (m?.[1]) return m[1];
  }
  return null;
}

export function canonicalizeLinkedInJobLink(link) {
  const jobId = extractLinkedInJobId(link);
  if (jobId) {
    return `https://www.linkedin.com/jobs/view/${jobId}/`;
  }
  if (!link) return null;
  // Drop query params and fragments for stability
  return String(link).split('#')[0].split('?')[0];
}

// Ensure data directory exists
function ensureDataDir() {
  const dataDir = path.dirname(SEEN_JOBS_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

// Load all previously seen job links
export function loadSeenJobs() {
  ensureDataDir();
  
  if (!fs.existsSync(SEEN_JOBS_FILE)) {
    return { jobIds: new Set(), links: new Set(), titleCompanyKeys: new Set() };
  }

  try {
    const data = JSON.parse(fs.readFileSync(SEEN_JOBS_FILE, 'utf-8'));
    return {
      jobIds: new Set(data.jobIds || []),
      links: new Set(data.links || []),
      titleCompanyKeys: new Set(data.titleCompanyKeys || [])
    };
  } catch {
    return { jobIds: new Set(), links: new Set(), titleCompanyKeys: new Set() };
  }
}

// Save seen jobs to persistent storage
export function saveSeenJobs(seenData) {
  ensureDataDir();
  
  const data = {
    jobIds: Array.from(seenData.jobIds || []),
    links: Array.from(seenData.links),
    titleCompanyKeys: Array.from(seenData.titleCompanyKeys),
    lastUpdated: new Date().toISOString(),
    totalCount: (seenData.jobIds?.size || 0) + (seenData.links?.size || 0)
  };

  fs.writeFileSync(SEEN_JOBS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// Add new jobs to seen list
export function markJobsAsSeen(jobs, seenData) {
  for (const job of jobs) {
    const canonicalLink = canonicalizeLinkedInJobLink(job.link);
    const jobId = job.jobId || extractLinkedInJobId(job.link);

    if (jobId) {
      seenData.jobIds.add(String(jobId));
    } else if (canonicalLink) {
      seenData.links.add(canonicalLink);
    }

    const key = `${normalizeWhitespace(job.title).toLowerCase()}|${normalizeWhitespace(job.company).toLowerCase()}`;
    if (key !== '|') {
      seenData.titleCompanyKeys.add(key);
    }
  }
  saveSeenJobs(seenData);
}

// Filter out jobs we've already seen
export function filterNewJobs(jobs, seenData) {
  return jobs.filter((job) => {
    const canonicalLink = canonicalizeLinkedInJobLink(job.link);
    const jobId = job.jobId || extractLinkedInJobId(job.link);

    if (!jobId && !canonicalLink) return false;

    // Prefer stable jobId when available
    if (jobId && (seenData.jobIds?.has(String(jobId)) || false)) return false;

    // Fallback: check canonicalized link
    if (canonicalLink && seenData.links.has(canonicalLink)) return false;
    
    // Check if title+company combo was seen before
    const key = `${normalizeWhitespace(job.title).toLowerCase()}|${normalizeWhitespace(job.company).toLowerCase()}`;
    if (seenData.titleCompanyKeys.has(key)) return false;
    
    return true;
  });
}

// Get stats about seen jobs
export function getSeenJobsStats() {
  const seenData = loadSeenJobs();
  return {
    totalJobIds: seenData.jobIds?.size || 0,
    totalLinks: seenData.links.size,
    totalTitleCompanyKeys: seenData.titleCompanyKeys.size
  };
}

// Clear all seen jobs (for testing/reset)
export function clearSeenJobs() {
  ensureDataDir();
  if (fs.existsSync(SEEN_JOBS_FILE)) {
    fs.unlinkSync(SEEN_JOBS_FILE);
  }
}
