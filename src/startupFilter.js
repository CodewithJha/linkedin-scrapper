/**
 * Startup filter: keep jobs that are mostly from startups (exclude big companies,
 * keep those with startup-like company name or description buzzwords).
 */

// Known large companies / substrings (normalized lowercase). Job is excluded if company matches.
const BLOCKLIST = [
  'google', 'microsoft', 'amazon', 'meta', 'facebook', 'apple', 'netflix',
  'ibm', 'oracle', 'salesforce', 'adobe', 'sap', 'cisco', 'intel', 'dell',
  'hp ', 'hewlett', 'accenture', 'deloitte', 'mckinsey', 'bcg', 'bain',
  'goldman sachs', 'jpmorgan', 'jpmorgan chase', 'morgan stanley', 'bank of america',
  'walmart', 'exxon', 'chevron', 'berkshire', 'unitedhealth', 'cvs health',
  'johnson & johnson', 'jnj', 'procter & gamble', 'p&g', 'verizon', 'at&t',
  'comcast', 'disney', 'walt disney', 'nike', 'coca-cola', 'pepsi',
  'ford motor', 'general motors', 'gm ', 'toyota', 'honda', 'tesla',
  'samsung', 'sony', 'lg ', 'panasonic', 'siemens', 'ge ', 'general electric',
  'boeing', 'lockheed', 'raytheon', 'northrop', 'honeywell',
  'ubs', 'credit suisse', 'barclays', 'hsbc', 'citigroup', 'citi ',
  'wells fargo', 'american express', 'capital one', 'blackrock', 'kpmg',
  'ey ', 'ernst & young', 'pwc', 'pricewaterhouse', 'infosys', 'tcs ',
  'wipro', 'hcl tech', 'cognizant', 'capgemini', 'tata consultancy',
  'servicenow', 'workday', 'vmware', 'broadcom', 'qualcomm', 'nvidia',
  'amd ', 'paypal', 'visa', 'mastercard', 'intuit', 'zoom', 'slack',
  'spotify', 'uber', 'lyft', 'airbnb', 'twitter', 'linkedin', 'yelp',
  'ebay', 'alibaba', 'tencent', 'bytedance', 'tiktok', 'snap', 'snapchat',
  'dropbox', 'box ', 'atlassian', 'twilio', 'square', 'block inc',
  'stripe', 'coinbase', 'robinhood', 'chase', 'american airlines',
  'delta air', 'united airlines', 'fedex', 'ups ', 'state farm',
  'allstate', 'liberty mutual', 'anthem', 'cigna', 'humana',
  'abbvie', 'pfizer', 'merck', 'novartis', 'roche', 'sanofi',
  'glaxosmithkline', 'gsk ', 'astrazeneca', 'johnson & johnson',
  'bloomberg', 'reuters', 'thomson reuters', 'lexisnexis', 'moody',
  's&p global', 'nasdaq', 'nyse', 'citadel', 'jane street', 'two sigma',
  'optiver', 'imc ', 'flow traders', 'government', 'state of ', 'federal '
].map((s) => s.trim().toLowerCase());

// Company name tokens that suggest startup (keep job if name contains any)
const STARTUP_NAME_TOKENS = [
  'labs', 'ventures', 'studio', 'studio ', '.io', 'hq', 'capital',
  'startup', 'startups', 'tech', 'software', 'digital', 'innovation',
  'solutions', 'labs ', 'ventures ', 'studio ', 'io'
].map((s) => s.trim().toLowerCase());

// Description phrases that suggest startup (when we have description)
const STARTUP_DESC_PHRASES = [
  'startup', 'early stage', 'early-stage', 'series a', 'series b',
  'venture-backed', 'venture backed', 'fast-paced', 'fast paced',
  'small team', 'growing team', 'founding', 'founding team',
  'seed stage', 'pre-seed', 'preseed'
].map((s) => s.trim().toLowerCase());

function normalizeCompany(name) {
  if (!name || typeof name !== 'string') return '';
  return name.trim().toLowerCase();
}

function isBlocklisted(companyName) {
  const n = normalizeCompany(companyName);
  if (!n) return false;
  return BLOCKLIST.some((term) => n.includes(term) || n === term);
}

function hasStartupLikeName(companyName) {
  const n = normalizeCompany(companyName);
  if (!n) return false;
  return STARTUP_NAME_TOKENS.some((token) => n.includes(token));
}

function hasStartupBuzzwordsInDescription(description) {
  if (!description || typeof description !== 'string') return false;
  const text = description.trim().toLowerCase();
  return STARTUP_DESC_PHRASES.some((phrase) => text.includes(phrase));
}

/**
 * Filter jobs to those that look like startups:
 * 1. Exclude if company is in blocklist.
 * 2. Keep if company name is startup-like OR job has startup buzzwords in description.
 */
export function filterStartupJobs(jobs) {
  const result = [];
  for (const job of jobs) {
    if (isBlocklisted(job.company)) continue;
    const nameOk = hasStartupLikeName(job.company);
    const descOk = job.startupSignalsFromDescription === true;
    if (nameOk || descOk) result.push({ ...job, isLikelyStartup: true });
  }
  return result;
}

export { isBlocklisted, hasStartupLikeName, hasStartupBuzzwordsInDescription };
