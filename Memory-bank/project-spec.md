# Project Spec - Intent, Actors, Flows

LAST_UPDATED_UTC: 2026-03-31 09:33
UPDATED_BY: antigravity

## Purpose
AssetHub is a full-stack image/asset management and no-code content editing platform.
It lets agencies and teams upload, compress, manage images and edit website content without code.

## Scope
- In-scope: Image upload/compression, R2 storage, asset browsing/replacement, no-code content editing via GitHub sync, Google login
- Out-of-scope: Video transcoding, complex CMS workflows, multi-tenant billing

## Actors
| Actor | Capabilities | Notes |
|---|---|---|
| Admin | Create projects, upload assets, manage content, push to GitHub | Agency team member |
| Client | Upload assets, edit website text/images via Content Editor | Non-technical user |
| System (Worker) | Handle R2 uploads, serve asset metadata, manage project lists | Cloudflare Worker |
| System (Pages) | Serve React UI, auto-rebuild on GitHub push | Cloudflare Pages |

## Core Flows
### Flow 1: Image Upload
1. User logs in and selects a project
2. Drops image in Upload tab
3. Sets asset type, size preset, output format
4. Browser compresses image (no server)
5. Clicks "Upload to R2" → Worker stores in R2 with metadata
6. Permanent public URL returned

### Flow 2: Asset Replacement
1. User goes to Browse Assets tab
2. Finds image, clicks "Replace"
3. Uploads new version → same URL key → live sites update instantly

### Flow 3: Content Editing (No-Code)
1. User connects GitHub via Personal Access Token
2. Selects website repo → loads pages automatically
3. Edits text inline, swaps images from R2 assets
4. Clicks "Push to GitHub" → content.json updated → Cloudflare Pages rebuilds → live site updates in ~30s

## Business Rules
- Asset URLs are permanent (same key on replace)
- content.json never touches code files — only data
- Up to 50 Google accounts via Cloudflare Access free tier
- All image processing happens client-side (browser)