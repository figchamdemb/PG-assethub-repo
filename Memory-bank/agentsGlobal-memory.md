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

### [2026-03-31 17:15 UTC] - copilot
Scope:
- Components: frontend (Dashboard, index.css)
- Files touched: `src/pages/Dashboard.jsx`, `src/index.css`

Summary:
- Made Dashboard fully mobile responsive. Replaced all inline `styles.xxx` with CSS classes `.dash-xxx`. Added `@media (max-width: 768px)` breakpoint: hamburger menu (MenuIcon) toggles sidebar as fixed overlay with backdrop, nav labels hidden (icons only), email hidden, reduced padding.
- Fixed GitHub Connect button: `handleOAuthCallback()` was only called in ContentTab's useEffect. After OAuth redirect, Dashboard loads with Upload tab by default → ContentTab never mounts → token never captured from URL. Fix: moved `handleOAuthCallback()` to Dashboard-level useEffect; auto-switches to content tab on success.

Anchors:
- `src/pages/Dashboard.jsx` → `handleOAuthCallback` import, `sidebarOpen` state, `.dash-*` CSS classes, `MenuIcon` component
- `src/index.css` → `.dash-*` layout classes, `@media (max-width: 768px)` responsive rules

### [2026-03-31 18:00 UTC] - copilot
Scope:
- Components: frontend (github.js) — Content Editor page detection + extraction
- Files touched: `src/lib/github.js`

Summary:
- Fixed GitHub Login button bouncing back: Worker redirects to `/` instead of `/login`, Login page now redirects to `/` if user already authenticated.
- Fixed `detectPages()` to skip React component files (PascalCase + UI suffix like Tab/Page/Modal/Card etc.), well-known app names (Dashboard, Login, Settings, etc.). Only includes files in `pages/`/`app/` dirs that are kebab-case or known content names.
- Added **Next.js App Router support**: files named `page.jsx/tsx` are kept (exception to SKIP_NAMES). Labels derived from parent directory name (`app/about/page.tsx` → "About", `app/page.tsx` → "Home").
- Fixed **JS code leaking into BODY TEXT**: Added `hasCode()` function to reject strings matching JS code patterns (`const `, `let `, `=> `, `.map(`, etc.). Enhanced `clean` pipeline strips JSX expressions `{...}`, single-line `//` comments, and multi-line `/* */` comments. Both HTML and JSX `<p>` matching loops now check `!hasCode(txt)`.
- Deployed to Cloudflare Pages. Pushed commit ed3a7f1.

Anchors:
- `src/lib/github.js` → `detectPages()` (SKIP_NAMES, SKIP_COMPONENT, SKIP_APP_NAMES, SKIP_DIRS, Next.js App Router label logic), `extractContentFromSource()` (hasCode(), enhanced clean pipeline)

### [2026-03-31 19:55 UTC] - copilot
Scope:
- Components: frontend (github.js) — Content Editor duplicate pages + empty content
- Files touched: `src/lib/github.js`

Summary:
- Fixed **duplicate pages**: Changed dedup in `detectPages()` from path-based to label-based (case-insensitive). Two files at different paths with the same label (e.g. `app/help/page.jsx` + `src/pages/help.jsx`) now only appear once.
- Fixed **isReal() rejecting all English text**: The old regex `/^[a-z_$][a-z0-9_.|\s]*$/i` with case-insensitive flag matched virtually all English words and phrases. New logic: multi-word strings → always real, single lowercase tokens → reject as variables, single Capitalized words → accept as real content.
- Added **fallback string literal extraction**: When JSX tag extraction yields empty headings/body (because content was in JSX expressions like `{title}` which get stripped), now searches for string constants: `title: "..."`, `description: "..."`, `heading = "..."` patterns. Last resort: any 30+ char quoted string with spaces.
- Deployed to Cloudflare Pages. Pushed commit 41f5c2d.

Anchors:
- `src/lib/github.js` → `isReal()` (fixed), `detectPages()` (label dedup), `extractContentFromSource()` (fallback extraction)

### [2026-03-31 20:30 UTC] - copilot
Scope:
- Components: frontend (github.js, ContentTab) — Content Editor redesign
- Files touched: `src/lib/github.js`, `src/pages/ContentTab.jsx`

Summary:
- **Redesigned content extraction**: New `extractAllContent()` function replaces fixed 5-field extraction. Extracts ALL headings (h1-h6), ALL paragraphs, ALL spans/links/buttons/list items, ALL images (<img>, <Image>, CSS url()), with fallback to named string constants and long quoted strings.
- **Source code viewer**: Added toggle button "</> Source" in field panel header. Shows raw page source in scrollable monospace panel. Users can see exactly what's in the file.
- **Dynamic fields**: Instead of hardcoded title/heading/subheading/image/body, each page now gets as many fields as there are text elements + images found. All rendered with existing FieldEditor.
- **Page sources stored**: Raw source code stored per page in `pageSources` state for source viewer display.
- Deployed to Cloudflare Pages. Pushed commit 96fe607.

Anchors:
- `src/lib/github.js` → `extractAllContent()` (new), `extractContentFromSource()` (kept for backward compat)
- `src/pages/ContentTab.jsx` → `showSource`/`pageSources` state, `buildSectionsFromSource()` rewritten