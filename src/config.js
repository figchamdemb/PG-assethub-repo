// ============================================================
// ASSETHUB CONFIG - Fill these in before deploying
// ============================================================

const config = {
  // Your Cloudflare Worker URL (deploy worker/index.js to get this)
  workerUrl: import.meta.env.VITE_WORKER_URL || 'https://assethub-worker.YOUR-SUBDOMAIN.workers.dev',

  // Your R2 public bucket URL (set up public access in Cloudflare dashboard)
  r2PublicUrl: import.meta.env.VITE_R2_PUBLIC_URL || 'https://assets.yourdomain.com',

  // GitHub OAuth App credentials (create at github.com/settings/developers)
  githubClientId: import.meta.env.VITE_GITHUB_CLIENT_ID || '',

  // App name shown in UI
  appName: 'AssetHub',

  // Asset types available for tagging uploads
  assetTypes: [
    { id: 'logo', label: 'Logo' },
    { id: 'hero-banner', label: 'Hero banner' },
    { id: 'card-image', label: 'Card image' },
    { id: 'background', label: 'Background' },
    { id: 'menu-item', label: 'Menu item' },
    { id: 'thumbnail', label: 'Thumbnail' },
    { id: 'icon', label: 'Icon' },
    { id: 'gallery', label: 'Gallery' },
    { id: 'product', label: 'Product' },
    { id: 'avatar', label: 'Avatar' },
    { id: 'banner', label: 'Banner' },
    { id: 'other', label: 'Other' },
  ],

  // Size presets
  sizePresets: [
    { id: 'logo-sm',    label: 'Logo small',   w: 200,  h: 200 },
    { id: 'logo-lg',    label: 'Logo large',   w: 400,  h: 400 },
    { id: 'hero',       label: 'Hero full',    w: 1920, h: 600 },
    { id: 'hero-md',    label: 'Hero medium',  w: 1280, h: 480 },
    { id: 'card',       label: 'Card',         w: 800,  h: 600 },
    { id: 'card-sq',    label: 'Card square',  w: 600,  h: 600 },
    { id: 'thumb',      label: 'Thumbnail',    w: 300,  h: 300 },
    { id: 'banner',     label: 'Banner wide',  w: 1200, h: 300 },
    { id: 'og',         label: 'OG image',     w: 1200, h: 630 },
    { id: 'favicon',    label: 'Favicon',      w: 32,   h: 32 },
    { id: 'custom',     label: 'Custom',       w: null, h: null },
  ],
}

export default config
