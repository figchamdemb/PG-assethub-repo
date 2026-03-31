# Project Details - Scope, Plan, Feature Status

LAST_UPDATED_UTC: 2026-03-31 09:33
UPDATED_BY: antigravity

## Product Vision

AssetHub is a full-stack image/asset management + no-code content editing platform for agencies and teams. It allows non-technical clients to upload, compress, manage images and edit website text/images without touching code.

## Architecture

| Piece | Where | Cost | URL |
|---|---|---|---|
| React app (AssetHub UI) | Cloudflare Pages | Free | https://assethub-9pf.pages.dev |
| Image upload handler | Cloudflare Worker | Free | https://assethub-worker.ebrimchamdemba.workers.dev |
| Image + metadata storage | Cloudflare R2 | Free (up to 10 GB) | https://pub-63cb42e78cd948583c3974681ff3ef47.r2.dev |
| Login (Google) | Cloudflare Access | Free (up to 50 users) | — |
| GitHub content sync | GitHub API (browser) | Free | — |
| Source control | GitHub | Free | https://github.com/figchamdemb/PG-assethub-repo.git |

## Three Core Screens

### 1. Upload Tab
- Pick a project, drop an image, choose its type (logo/hero/card etc.), pick a size preset or set custom dimensions, choose output format
- Hit "Compress + upload to R2" — image is compressed in-browser (no server), then uploaded
- URL is permanent. Click "Download" for local copy, or "Upload to R2" for cloud storage

### 2. Browse Assets Tab
- Select a project, see every asset as a card: thumbnail, name, dimensions, file size, R2 URL
- Actions: Copy URL, Replace, View large, Delete
- **Replace** uploads a new image to the exact same URL — live site updates instantly, no code change needed

### 3. Content Editor Tab (GitHub Sync)
- No-code website manager
- Shows every editable section (Hero, About, Logo etc.) as a block
- Change text inline; for images pick from already-uploaded R2 assets
- Hit "Push to GitHub" → writes `content.json` to the repo → Cloudflare Pages auto-rebuilds → live site updates in ~30 seconds
- No VSCode, no terminal, no code required by the client

## Content Sync Mechanism
- AssetHub writes a `content.json` file to the client's GitHub repo
- Frontend code reads `content.json` at build time
- When AssetHub pushes an update, Cloudflare Pages sees the new commit and rebuilds (~30s)
- The client never touches code — worst case they change text to something wrong, trivially reversible

## Current Plan (Rolling)
| Plan Item | Status | Owner | Target Date | Notes |
|---|---|---|---|---|
| Initialize Memory-bank standards | Done | Platform | 2026-03-31 | Bootstrapped |
| R2 bucket setup | Done | Platform | 2026-03-31 | assethub-assets, WEUR |
| Worker deployment | Done | Platform | 2026-03-31 | v1f22de41, wrangler 4.78.0 |
| React app build + Pages deploy | Done | Platform | 2026-03-31 | dist deployed |
| Push to GitHub | In Progress | Platform | 2026-03-31 | figchamdemb/PG-assethub-repo |
| Cloudflare Access (Google login) | Planned | Team | TBD | Step 5 in SETUP.md |
| GitHub content sync per-user | Planned | Team | TBD | Step 6 in SETUP.md |

## Feature Backlog Snapshot
| Feature | Priority | Status | Components | Notes |
|---|---|---|---|---|
| Image upload + compression | High | Done | UploadTab, Worker, R2 | Browser-side compression |
| Asset browsing + replace | High | Done | AssetsTab, Worker, R2 | Same-URL replacement |
| Content editor + GitHub sync | High | Done | ContentTab, GitHub API | No-code editing |
| Google login (Cloudflare Access) | Medium | Planned | Auth, CF Access | 50 users free |
| Client project isolation | Low | Planned | Auth | Multi-tenant filtering |

## Environment Variables
```
VITE_WORKER_URL=https://assethub-worker.ebrimchamdemba.workers.dev
VITE_R2_PUBLIC_URL=https://pub-63cb42e78cd948583c3974681ff3ef47.r2.dev
```

## Change Triggers (Mandatory Updates)
Update this file whenever:
- a new feature is approved
- a plan item status changes
- scope changes (in/out)
- milestone dates shift materially
- deployment URLs change

## Next Planning Review
- Date: TBD
- Owners: Team
- Open risks: Cloudflare Access setup, GitHub token per-user flow