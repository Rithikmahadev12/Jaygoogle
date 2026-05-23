# SearchX

A fully functional search engine frontend powered by [SearXNG](https://searxng.github.io/searxng/) — a free, open-source metasearch engine that pulls results from Google, Bing, DuckDuckGo, and dozens of other sources.

## Features

- **Real web results** — powered by SearXNG metasearch (no API key needed)
- **Multiple search categories** — All, Images, News, Videos, Shopping, Maps
- **Autocomplete suggestions** — powered by DuckDuckGo
- **Knowledge panels** — infoboxes and sidebar cards for entities
- **Answer boxes** — direct answers when available
- **Related searches** — suggestion pills below results
- **Time filters** — filter by past day, week, month, or year
- **Pagination** — navigate through pages of results
- **Favicon display** — site icons next to each result
- **Responsive** — works on mobile and desktop
- **Multiple fallback instances** — auto-switches if one SearXNG node is down

## Files

```
index.html    — Homepage (Google-style)
results.html  — Search results page
style.css     — All styles
app.js        — Search logic, API calls, rendering
README.md     — This file
```

## Setup

### Option 1: GitHub Pages (easiest)

1. Fork or push this repo to GitHub
2. Go to **Settings → Pages**
3. Set source to `main` branch, root folder
4. Your search engine will be live at `https://yourusername.github.io/reponame`

### Option 2: Local

Just open `index.html` in any modern browser. No build step, no dependencies, no server required.

### Option 3: Any static host

Drop the files into Netlify, Vercel, Cloudflare Pages, or any static hosting service.

## How It Works

1. User types a query on `index.html`
2. Submitted to `results.html?q=query`
3. `app.js` sends the query through a CORS proxy to a SearXNG public instance
4. Results are parsed and rendered directly into the DOM
5. If one SearXNG instance is down, it automatically tries the next one

## SearXNG Instances Used

- https://searx.be
- https://search.mdosch.de
- https://searxng.site
- https://search.sapti.me
- https://paulgo.io

You can add or swap instances in `app.js` by editing the `SEARX_INSTANCES` array.

## Notes

- Results depend on which SearXNG instance responds. Quality and speed may vary.
- Some public instances may be temporarily down — the app tries all of them automatically.
- Images tab shows image results from SearXNG's image category.
- The sidebar knowledge panel only appears when SearXNG returns infobox data (usually for famous people, places, or topics).

## License

MIT — do whatever you want with it.
