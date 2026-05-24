const express = require('express');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

const INSTANCES = [
  'https://searx.be',
  'https://paulgo.io',
  'https://search.sapti.me',
  'https://searx.tiekoetter.com',
  'https://search.bus-hit.me',
  'https://search.mdosch.de',
  'https://searx.lunar.icu',
];

let lastGood = 0;

// Serve your static files (index.html, results.html, style.css, app.js)
app.use(express.static(path.join(__dirname)));

// Proxy endpoint — called by app.js as /search?q=...&categories=...&pageno=...
app.get('/search', async (req, res) => {
  const qs = new URLSearchParams({ ...req.query, format: 'json' }).toString();

  for (let i = 0; i < INSTANCES.length; i++) {
    const idx  = (lastGood + i) % INSTANCES.length;
    const url  = `${INSTANCES[idx]}/search?${qs}`;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept':     'application/json',
        },
        signal: AbortSignal.timeout(9000),
      });

      if (!response.ok) continue;

      const data = await response.json();
      if (data && data.results !== undefined) {
        lastGood = idx;
        return res.json(data);
      }
    } catch (_) {
      continue;
    }
  }

  res.status(503).json({ error: 'All SearXNG instances are unavailable right now.' });
});

app.listen(PORT, () => console.log(`SearchX listening on port ${PORT}`));
