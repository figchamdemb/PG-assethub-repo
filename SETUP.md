# AssetHub — Complete Setup Guide

## What you're deploying

| Piece | Where | Cost |
|---|---|---|
| React app (AssetHub UI) | Cloudflare Pages | Free |
| Image upload handler | Cloudflare Worker | Free |
| Image + metadata storage | Cloudflare R2 | Free up to 10GB |
| Login (Google) | Cloudflare Access | Free up to 50 users |
| GitHub content sync | GitHub API (browser) | Free |

---

## Step 1 — Set up Cloudflare R2

1. Log in at dash.cloudflare.com
2. Go to **Storage & Databases → R2**
3. Click **Create bucket**
4. Name it `assethub-assets` (or anything you like)
5. Once created, click the bucket → **Settings → Public access**
6. Enable public access — copy the public URL (looks like `https://pub-xxxx.r2.dev`)
7. Save this URL — you'll need it in Step 3

---

## Step 2 — Deploy the Worker

The Worker is the only "backend" piece. It's ~30 lines and lives in Cloudflare.

### Install Wrangler (Cloudflare CLI)

```bash
npm install -g wrangler
wrangler login
```

### Edit worker/wrangler.toml

Open `worker/wrangler.toml` and fill in:
- `bucket_name` — your R2 bucket name from Step 1
- `R2_PUBLIC_URL` — the public URL from Step 1

### Deploy

```bash
cd worker
wrangler deploy
```

You'll get a Worker URL like:
`https://assethub-worker.YOUR-SUBDOMAIN.workers.dev`

Copy this URL — you need it in Step 3.

---

## Step 3 — Configure the React app

Create a `.env` file in the project root:

```
VITE_WORKER_URL=https://assethub-worker.YOUR-SUBDOMAIN.workers.dev
VITE_R2_PUBLIC_URL=https://pub-xxxx.r2.dev
```

---

## Step 4 — Deploy the React app to Cloudflare Pages

### Option A: Deploy via Git (recommended)

1. Push this repo to GitHub
2. Go to Cloudflare dashboard → **Workers & Pages → Create → Pages**
3. Connect your GitHub repo
4. Set build settings:
   - **Framework preset**: Vite
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
5. Add environment variables (from your `.env` above):
   - `VITE_WORKER_URL`
   - `VITE_R2_PUBLIC_URL`
6. Click **Save and Deploy**

Your app will be live at `https://assethub.pages.dev` (or your custom domain).

### Option B: Deploy manually

```bash
npm install
npm run build
wrangler pages deploy dist --project-name=assethub
```

---

## Step 5 — Set up Google login (Cloudflare Access)

This protects your AssetHub so only your team can log in with Google.

1. In Cloudflare dashboard → **Zero Trust → Access → Applications**
2. Click **Add an application → Self-hosted**
3. Set the domain to your Pages URL (e.g. `assethub.pages.dev`)
4. Under **Authentication**, enable **Google**
5. Under **Policies**, add a rule: Email → is → `yourteam@gmail.com`
   (add each team member's Google email)
6. Save

Now when anyone visits your AssetHub, they'll be prompted to sign in with Google.
Only the emails you added will be allowed in.

> **Note**: Until you set up Cloudflare Access, the app uses demo login:
> - Email: `admin@assethub.io` / Password: `demo1234`
> - Email: `client@example.com` / Password: `client123`

---

## Step 6 — Connect GitHub (for content sync)

Each user connects their own GitHub when they open the Content Editor tab:

1. Go to github.com/settings/tokens/new
2. Name it `assethub`, check the `repo` scope
3. Click **Generate token**
4. In AssetHub → Content Editor → paste the token

---

## How to use AssetHub

### Upload an image

1. Log in → select or create a project
2. Click **Upload** tab
3. Drop your image
4. Set name, type (logo/hero/banner etc.), size, format
5. Click **Compress + resize** (processes in your browser — no server)
6. Click **Download** if you just want the compressed file
7. Click **Upload to R2** to store it permanently with a public URL

### Replace an image (live site updates automatically)

1. Go to **Browse assets**
2. Find the image → click **Replace**
3. Upload the new version
4. The URL stays the same — your live site picks it up immediately

### Edit website text and images without touching code

1. Go to **Content Editor**
2. Connect GitHub with your Personal Access Token
3. Select your website's repository
4. Click **Load pages** — it detects all your pages automatically
5. Click any page, edit the text or swap images
6. Click **Push to GitHub**
7. Cloudflare Pages auto-rebuilds — site updates in ~30 seconds

---

## How the content sync works

AssetHub writes a `content.json` file to your GitHub repo:

```json
{
  "sections": [
    {
      "page": "index",
      "pageLabel": "Home",
      "fields": [
        { "key": "hero_heading", "label": "Hero heading", "type": "text", "value": "Great coffee, every morning." },
        { "key": "hero_image", "label": "Hero image", "type": "image", "value": "https://pub-xxxx.r2.dev/barista-cafe/hero-homepage.webp" }
      ]
    }
  ]
}
```

In your website code, you read this file:

```js
// In your frontend (Astro, Next.js, plain HTML, etc.)
import content from './content.json'

const homePage = content.sections.find(s => s.page === 'index')
const heroHeading = homePage.fields.find(f => f.key === 'hero_heading').value
const heroImage = homePage.fields.find(f => f.key === 'hero_image').value
```

When AssetHub pushes an update to `content.json`, Cloudflare Pages sees the new commit and rebuilds in ~30 seconds. The client never touches code.

---

## Cloudflare Access — 50 users free

Cloudflare Access free tier allows 50 users. This means:
- Up to 50 different Google accounts can log in to your AssetHub
- Perfect for an agency managing multiple clients
- If you need more, Cloudflare Access starts at $7/month for unlimited users

---

## Project structure

```
assethub/
├── src/
│   ├── config.js          ← asset types, size presets — edit here
│   ├── lib/
│   │   ├── auth.jsx        ← Google/demo login
│   │   ├── storage.js      ← R2 uploads, image compression
│   │   └── github.js       ← GitHub API, content sync
│   └── pages/
│       ├── Login.jsx       ← login screen
│       ├── Dashboard.jsx   ← shell, sidebar, project list
│       ├── UploadTab.jsx   ← upload + compress + download
│       ├── AssetsTab.jsx   ← browse, copy URL, replace, delete
│       └── ContentTab.jsx  ← GitHub sync, text + image editor
├── worker/
│   ├── index.js           ← Cloudflare Worker (R2 handler)
│   └── wrangler.toml      ← Worker config
├── public/
│   └── _redirects         ← SPA routing for Cloudflare Pages
└── SETUP.md               ← this file
```

---

## Adding a new client

1. In Cloudflare Access → your AssetHub application → Policies
2. Add their Google email to the allowed list
3. Create a project for them in AssetHub
4. Share the AssetHub URL with them
5. They log in with Google — they only see their projects

---

## Frequently asked questions

**Q: What if I don't want to use GitHub sync?**
Just use the Upload and Browse tabs. Clients upload, get URLs, paste them wherever they need.

**Q: Can the client break the website by editing content?**
No. The content sync only updates `content.json` — it never touches any code file. The worst they can do is change a text field to something wrong, which is trivially reversible by editing it back.

**Q: How do I add more asset types or size presets?**
Edit `src/config.js` — all asset types and size presets are defined there.

**Q: Can clients only see their own project?**
Currently all logged-in users see all projects. For client isolation, you can either create separate AssetHub deployments per client (Pages is free, deploy as many as you want), or extend the auth to filter by email domain.

**Q: Will images served from R2 be fast?**
Yes. Cloudflare R2 is served from Cloudflare's global CDN — the same network that powers most of the internet. Latency is excellent worldwide.
