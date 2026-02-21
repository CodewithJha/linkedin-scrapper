// Vercel Serverless Function - triggers GitHub Actions securely
// The GitHub token is stored in Vercel Environment Variables, not exposed to frontend

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get token from Vercel environment variable
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  
  if (!GITHUB_TOKEN) {
    return res.status(500).json({ error: 'GitHub token not configured' });
  }

  const { keywords, location, results, timePosted } = req.body || {};

  try {
    const response = await fetch(
      'https://api.github.com/repos/CodewithJha/linkedin-scrapper/actions/workflows/scrape.yml/dispatches',
      {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
          'User-Agent': 'LinkedIn-Scraper-Frontend'
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: {
            keywords: keywords || 'data engineer',
            location: location || 'India',
            results: String(results || 40),
            timePosted: timePosted || 'past24h'
          }
        })
      }
    );

    if (response.status === 204) {
      return res.status(200).json({ success: true, message: 'Scraper started!' });
    } else if (response.status === 401) {
      return res.status(401).json({ error: 'Invalid GitHub token' });
    } else {
      const data = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: data.message || 'Failed to trigger' });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
