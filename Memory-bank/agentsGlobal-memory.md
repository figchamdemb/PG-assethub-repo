# Agents Global Memory - Change Log (Append-Only)

LAST_UPDATED_UTC: 2026-03-31 09:08
UPDATED_BY: mb-init

## Rules
- Append-only.
- No secrets.
- Keep entries concise and anchored by file path + symbol/migration.

---

### [2026-03-31 09:08 UTC] - mb-init
Scope:
- Components: bootstrap
- Files touched: Memory-bank starter pack

Summary:
- Initialized Memory-bank baseline and enforcement templates.

Anchors:
- `AGENTS.md`
- `scripts/memory_bank_guard.py`
- `.githooks/pre-commit`
- `.github/workflows/memory-bank-guard.yml`

### [2026-03-31 11:10 UTC] - copilot
Scope:
- Components: git, deployment
- Files touched: `.gitignore` (new), `.github/workflows/memory-bank-guard.yml` (removed from tracking)

Summary:
- Created `.gitignore` to exclude `node_modules/`, `dist/`, `.env`, `Memory-bank/_generated/`.
- Removed `node_modules`, `dist`, `.env` from git tracking (were accidentally committed).
- Squashed history into single clean commit (57 files, 6222 lines).
- Pushed to GitHub `figchamdemb/PG-assethub-repo` on `main` branch (commit 246efe7).
- Workflow file `.github/workflows/memory-bank-guard.yml` excluded from push (needs `workflow` OAuth scope — can be re-added via GitHub UI or PAT with workflow scope).

Anchors:
- `.gitignore`
- `https://github.com/figchamdemb/PG-assethub-repo`

### [2026-03-31 12:10 UTC] - copilot
Scope:
- Components: worker, frontend (ContentTab, github.js)
- Files touched: `worker/index.js`, `worker/wrangler.toml`, `src/lib/github.js`, `src/pages/ContentTab.jsx`

Summary:
- Added GitHub OAuth flow to replace manual PAT entry for connecting GitHub.
- Worker now handles `/auth/github` (redirect to GitHub) and `/auth/github/callback` (code→token exchange).
- Frontend shows a "Connect with GitHub" OAuth button as primary. PAT form kept as collapsible fallback.
- Requires creating a GitHub OAuth App and setting `GITHUB_CLIENT_ID` (env var) + `GITHUB_CLIENT_SECRET` (wrangler secret).

Anchors:
- `worker/index.js` → `/auth/github`, `/auth/github/callback`
- `src/lib/github.js` → `startGitHubOAuth()`, `handleOAuthCallback()`
- `src/pages/ContentTab.jsx` → OAuth connect UI

### [2026-03-31 12:35 UTC] - copilot
Scope:
- Components: worker, auth, login page
- Files touched: `worker/index.js`, `src/lib/auth.jsx`, `src/pages/Login.jsx`

Summary:
- Added GitHub as a login provider (alongside Google and demo login).
- Worker `/auth/github` now supports `purpose=login` param — fetches GitHub user profile on callback.
- `auth.jsx` handles `?github_user=` callback, stores user + GitHub token (auto-connects Content Editor).
- Login page now shows "Continue with GitHub" button (dark #24292e style).
- Bonus: logging in with GitHub auto-stores the token, so Content Editor is pre-connected.

Anchors:
- `worker/index.js` → `purpose` param in OAuth flow
- `src/lib/auth.jsx` → `loginWithGitHub()`, GitHub callback in useEffect
- `src/pages/Login.jsx` → GitHub login button