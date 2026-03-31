# Tools & Commands

LAST_UPDATED_UTC: 2026-03-31 09:34
UPDATED_BY: antigravity
PROJECT_TYPE: fullstack

## Purpose
Single source for local run commands, tool inventory, and environment versions.
Update this whenever runtime, dependencies, or service startup commands change.

## Runtime Versions
| Tool | Version | Where Used | Notes |
|---|---|---|---|
| Node.js | v20.20.0 | frontend + tooling | |
| npm | 10.8.2 | package manager | |
| Wrangler | 4.78.0 | Cloudflare CLI | Installed globally |
| Git | 2.51.0 | version control | |
| Vite | 5.4.x | frontend build | |
| React | 18.3.x | UI framework | |

## Core Start Commands
### Project bootstrap
- Simple command (required before coding):
  - `.\pg.ps1 start -Yes`
- End shift/session:
  - `.\pg.ps1 end -Note "finished for today"`
- Session status:
  - `.\pg.ps1 status`

### Frontend
- Install dependencies:
  - `npm install`
- Run dev server:
  - `npm run dev`
- Build for production:
  - `npm run build`
- Preview production build:
  - `npm run preview`

### Worker (Cloudflare)
- Deploy worker:
  - `cd worker && wrangler deploy`
- Check login status:
  - `wrangler whoami`
- Login to Cloudflare:
  - `wrangler login`

### Cloudflare Pages
- Create Pages project:
  - `wrangler pages project create assethub --production-branch=main`
- Deploy to Pages:
  - `wrangler pages deploy dist --project-name=assethub --commit-dirty=true`

### Git + GitHub
- Initialize repo:
  - `git init && git add . && git commit -m "initial commit"`
- Push to GitHub:
  - `git remote add origin https://github.com/figchamdemb/PG-assethub-repo.git`
  - `git branch -M main`
  - `git push -u origin main`

### Memory-bank
- Build summary:
  - `python scripts/build_backend_summary.py`
- Generate/update memory bank:
  - `python scripts/generate_memory_bank.py --profile backend --keep-days 7`
- Install hooks:
  - `powershell -ExecutionPolicy Bypass -File scripts/install_memory_bank_hooks.ps1 -Mode warn`

## Tooling Inventory
| Capability | Tool | Enabled (Y/N) | Config Path |
|---|---|---|---|
| Frontend build | Vite | Y | `vite.config.js` |
| Worker deployment | Wrangler | Y | `worker/wrangler.toml` |
| Image storage | Cloudflare R2 | Y | R2 dashboard |
| App hosting | Cloudflare Pages | Y | Pages dashboard |
| Source control | Git + GitHub | Y | `.git/` |

## Update Rules
- If `package.json`, `wrangler.toml`, `.env`, or deployment configs change, update this file in the same session.
- Do not store secrets or private tokens in command examples.