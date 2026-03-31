# Structure & DB - Authoritative Snapshot

LAST_UPDATED_UTC: 2026-03-31 09:33
UPDATED_BY: antigravity
PROJECT_TYPE: fullstack

## System Inventory
| Component | Type | Responsibility | Tech | Detail Doc |
|---|---|---|---|---|
| React App | frontend | UI — upload, browse, content edit | React 18, Vite 5, react-router-dom 6 | `Memory-bank/code-tree/frontend-tree.md` |
| Cloudflare Worker | backend | R2 upload handler, project/asset CRUD | Cloudflare Workers, wrangler 4.78.0 | `worker/index.js` |
| R2 Bucket | storage | Image + metadata storage | Cloudflare R2 | `assethub-assets` |
| Cloudflare Pages | hosting | Serves built React app | Cloudflare Pages | `assethub-9pf.pages.dev` |

## High-Level Flow
- Browser → React App (Pages) → Worker API → R2 Bucket
- Browser → GitHub API → content.json → Pages auto-rebuild

## Project Structure
```
assethub/
├── src/
│   ├── App.jsx              ← Router shell
│   ├── main.jsx             ← Entry point
│   ├── index.css            ← Global styles
│   ├── config.js            ← Asset types, size presets
│   ├── lib/
│   │   ├── auth.jsx         ← Google/demo login
│   │   ├── storage.js       ← R2 uploads, image compression
│   │   └── github.js        ← GitHub API, content sync
│   └── pages/
│       ├── Login.jsx        ← Login screen
│       ├── Dashboard.jsx    ← Shell, sidebar, project list
│       ├── UploadTab.jsx    ← Upload + compress + download
│       ├── AssetsTab.jsx    ← Browse, copy URL, replace, delete
│       └── ContentTab.jsx   ← GitHub sync, text + image editor
├── worker/
│   ├── index.js             ← Cloudflare Worker (R2 handler)
│   └── wrangler.toml        ← Worker config (bucket binding, R2 URL)
├── public/
│   └── _redirects           ← SPA routing for Cloudflare Pages
├── dist/                    ← Built output (deployed to Pages)
├── .env                     ← VITE_WORKER_URL, VITE_R2_PUBLIC_URL
├── package.json             ← Dependencies and scripts
├── vite.config.js           ← Vite config with React plugin
└── SETUP.md                 ← Complete setup guide
```

## Schemas / Data Stores (Index)
| Schema or Store | Owned By | Location | Notes |
|---|---|---|---|
| `_meta/projects.json` | Worker | R2 | Array of project objects |
| `_meta/{project}/assets.json` | Worker | R2 | Array of asset metadata per project |
| `{project}/{name}.{format}` | Worker | R2 | Actual image files |
| `content.json` | ContentTab | GitHub repo | Website content data |

## Deployment URLs
| Service | URL |
|---|---|
| React App (Pages) | https://assethub-9pf.pages.dev |
| Worker API | https://assethub-worker.ebrimchamdemba.workers.dev |
| R2 Public | https://pub-63cb42e78cd948583c3974681ff3ef47.r2.dev |
| GitHub Repo | https://github.com/figchamdemb/PG-assethub-repo.git |

## Notes
- Keep this file as a compact index.
- Full details belong in `db-schema/*.md` and `code-tree/*.md`.