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
  'https://searxng.site',
  'https://search.hbubli.cc',
  'https://search.inetol.net',
  'https://etsi.me',
];

// Realistic browser headers — many instances check these
const BROWSER_HEADERS = {
  'User-Agent':       'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept':           'application/json, text/html, */*;q=0.8',
  'Accept-Language':  'en-US,en;q=0.9',
  'Accept-Encoding':  'gzip, deflate, br',
  'DNT':              '1',
  'Connection':       'keep-alive',
  'Sec-Fetch-Dest':   'document',
  'Sec-Fetch-Mode':   'navigate',
  'Sec-Fetch-Site':   'none',
  'Sec-Ch-Ua':        '"Chromium";v="124", "Google Chrome";v="124"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Cache-Control':    'no-cache',
};

let lastGood = 0;

app.use(express.static(path.join(__dirname)));

// Debug endpoint — visit /debug in browser to see which instances are alive
app.get('/debug', async (req, res) => {
  const results = await Promise.allSettled(
    INSTANCES.map(async (inst) => {
      const url = `${inst}/search?q=test&categories=general&format=json&pageno=1`;
      const start = Date.now();
      try {
        const r = await fetch(url, {
          headers: BROWSER_HEADERS,
          signal: AbortSignal.timeout(8000),
        });
        const ms = Date.now() - start;
        const body = await r.text();
        let ok = false;
        try { ok = JSON.parse(body).results !== undefined; } catch {}
        return { inst, status: r.status, ms, ok };
      } catch (e) {
        return { inst, error: e.message, ms: Date.now() - start };
      }
    })
  );
  res.json(results.map(r => r.value || r.reason));
});

app.get('/search', async (req, res) => {
  const qs = new URLSearchParams({ ...req.query, format: 'json' }).toString();
  const errors = [];

  for (let i = 0; i < INSTANCES.length; i++) {
    const idx = (lastGood + i) % INSTANCES.length;
    const url = `${INSTANCES[idx]}/search?${qs}`;

    try {
      const response = await fetch(url, {
        headers: { ...BROWSER_HEADERS, Referer: INSTANCES[idx] + '/' },
        signal: AbortSignal.timeout(9000),
      });

      if (!response.ok) {
        errors.push(`[${INSTANCES[idx]}] HTTP ${response.status}`);
        continue;
      }

      const text = await response.text();
      let data;
      try { data = JSON.parse(text); } catch {
        errors.push(`[${INSTANCES[idx]}] Not JSON: ${text.substring(0, 80)}`);
        continue;
      }

      if (data && data.results !== undefined) {
        lastGood = idx;
        return res.json(data);
      }
      errors.push(`[${INSTANCES[idx]}] Missing results key`);

    } catch (e) {
      errors.push(`[${INSTANCES[idx]}] ${e.message}`);
    }
  }

  console.error('All instances failed:\n' + errors.join('\n'));
  res.status(503).json({ error: 'All SearXNG instances failed.', details: errors });
});

app.listen(PORT, () => console.log(`SearchX on port ${PORT}`));
