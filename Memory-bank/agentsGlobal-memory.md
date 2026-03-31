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

### [2026-03-31 15:55 UTC] - copilot
Scope:
- Components: worker, frontend (plans, pricing, auth, storage, dashboard)
- Files touched: `worker/index.js`, `worker/wrangler.toml`, `src/lib/plans.js` (new), `src/lib/auth.jsx`, `src/lib/storage.js`, `src/pages/PricingPage.jsx` (new), `src/pages/Dashboard.jsx`, `src/config.js`

Summary:
- Implemented full monetization system: Freemium SaaS with Free/Pro ($9/mo)/Agency ($29/mo) tiers.
- Worker: Added plan storage in R2 (`_meta/users/{id}.json`), plan enforcement on upload (storage limit) and project creation (project limit), content push tracking with monthly reset.
- Stripe integration: checkout session creation, webhook handler (signature verification via HMAC-SHA256), customer billing portal, one-time product/price setup endpoint (`POST /stripe/setup`).
- Admin system: `POST /admin/set-role` to grant admin/agency plan to staff, `POST /admin/coupons` to create coupon codes, `POST /admin/redeem` public endpoint for coupon redemption.
- Frontend: Pricing page with tier cards, usage dashboard, Stripe checkout redirect, coupon code entry. Plan badge in Dashboard topbar.
- Auth: `getUserId()` utility for consistent user identification (`github_login` or `email_...`). Plan state loaded on login and exposed via `useAuth()`.
- Storage lib: All Worker API calls now send `X-User-Id` header for plan enforcement.
- Worker secrets needed: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ADMIN_SECRET`.

Anchors:
- `worker/index.js` → `/user/plan`, `/stripe/checkout`, `/stripe/webhook`, `/stripe/setup`, `/stripe/portal`, `/admin/set-role`, `/admin/redeem`, `/admin/coupons`
- `src/lib/plans.js` → plan tier definitions
- `src/pages/PricingPage.jsx` → pricing UI
- `src/lib/auth.jsx` → `getUserId()`, `userPlan` state
- `src/lib/storage.js` → `createCheckoutSession()`, `openBillingPortal()`, `redeemCoupon()`, `reportContentPush()`

### [2026-03-31 16:30 UTC] - copilot
Scope:
- Components: frontend (github.js, ContentTab)
- Files touched: `src/lib/github.js`, `src/pages/ContentTab.jsx`

Summary:
- Fixed Content Editor bug: pages loaded from GitHub but all content fields were empty.
- Root cause: When no `content.json` existed in the repo, `buildDefaultSections()` created fields with empty values. The editor never read actual content from source files.
- Fix: Added `extractContentFromSource()` to `github.js` — parses HTML/JSX files to extract `<title>`, `<h1>`, `<h2>`, `<p>`, and `<img>` content using regex.
- `handleLoadRepo()` now calls `buildSectionsFromSource()` (fetches each page file via GitHub API and pre-populates fields) when no `content.json` is found.
- Improved `detectPages()` — now skips non-page files (main, config, provider, context, etc.) and utility directories (lib, hooks, helpers, components, services, etc.). Prioritises files in `pages/`, `app/`, `views/`, `routes/` directories. Root-level HTML files always included.

Anchors:
- `src/lib/github.js` → `extractContentFromSource()`, improved `detectPages()`
- `src/pages/ContentTab.jsx` → `buildSectionsFromSource()`, `getRepoFile` + `extractContentFromSource` import