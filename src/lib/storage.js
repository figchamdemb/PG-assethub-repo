import config from '../config.js'

const w = config.workerUrl

// Helper to get current user ID from localStorage
function currentUserId() {
  try {
    const stored = JSON.parse(localStorage.getItem('assethub_user') || '{}')
    if (stored.provider === 'github' && stored.login) return `github_${stored.login}`
    if (stored.email) return `email_${stored.email.replace(/[^a-zA-Z0-9@._-]/g, '_')}`
  } catch {}
  return null
}

function authHeaders() {
  const uid = currentUserId()
  return uid ? { 'X-User-Id': uid } : {}
}

// ─── Projects ────────────────────────────────────────────────

export async function listProjects() {
  const res = await fetch(`${w}/projects`)
  if (!res.ok) return []
  return res.json()
}

export async function createProject(name) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  const res = await fetch(`${w}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ name, slug, createdAt: new Date().toISOString() })
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to create project')
  }
  return res.json()
}

export async function deleteProject(slug) {
  return fetch(`${w}/projects/${slug}`, { method: 'DELETE' })
}

// ─── Assets ─────────────────────────────────────────────────

export async function listAssets(projectSlug) {
  const res = await fetch(`${w}/assets/${projectSlug}`)
  if (!res.ok) return []
  return res.json()
}

export async function uploadAsset({ projectSlug, file, name, assetType, format, width, height }) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('project', projectSlug)
  formData.append('name', name)
  formData.append('assetType', assetType)
  formData.append('format', format)
  formData.append('width', width)
  formData.append('height', height)
  const uid = currentUserId()
  if (uid) formData.append('userId', uid)

  const res = await fetch(`${w}/upload`, { method: 'POST', body: formData, headers: authHeaders() })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Upload failed')
  }
  return res.json() // { url, key, size }
}

export async function deleteAsset(projectSlug, assetKey) {
  return fetch(`${w}/assets/${projectSlug}/${encodeURIComponent(assetKey)}`, { method: 'DELETE' })
}

// ─── Image processing (browser-side, no server) ──────────────

export function processImage(file, width, height, format) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      // Maintain aspect ratio if only one dimension given
      let tw = width, th = height
      if (!tw && !th) { tw = img.naturalWidth; th = img.naturalHeight }
      else if (!tw) { tw = Math.round(img.naturalWidth * (th / img.naturalHeight)) }
      else if (!th) { th = Math.round(img.naturalHeight * (tw / img.naturalWidth)) }
      canvas.width = tw
      canvas.height = th
      const ctx = canvas.getContext('2d')
      // Cover crop - center
      const srcAspect = img.naturalWidth / img.naturalHeight
      const dstAspect = tw / th
      let sx, sy, sw, sh
      if (srcAspect > dstAspect) {
        sh = img.naturalHeight; sw = sh * dstAspect
        sx = (img.naturalWidth - sw) / 2; sy = 0
      } else {
        sw = img.naturalWidth; sh = sw / dstAspect
        sx = 0; sy = (img.naturalHeight - sh) / 2
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, tw, th)
      URL.revokeObjectURL(url)
      const mimeMap = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' }
      const mime = mimeMap[format] || 'image/webp'
      const quality = format === 'png' ? undefined : 0.85
      canvas.toBlob(blob => {
        if (!blob) return reject(new Error('Canvas toBlob failed'))
        resolve(new File([blob], `${Date.now()}.${format}`, { type: mime }))
      }, mime, quality)
    }
    img.onerror = reject
    img.src = url
  })
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(2)} MB`
}

// ─── Plan & Stripe helpers ─────────────────────────────────

export async function createCheckoutSession(planId) {
  const uid = currentUserId()
  const stored = JSON.parse(localStorage.getItem('assethub_user') || '{}')
  const res = await fetch(`${w}/stripe/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ planId, userId: uid, email: stored.email }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to create checkout session')
  }
  return res.json() // { url }
}

export async function openBillingPortal() {
  const res = await fetch(`${w}/stripe/portal`, {
    method: 'POST',
    headers: authHeaders(),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to open billing portal')
  }
  return res.json() // { url }
}

export async function redeemCoupon(code) {
  const uid = currentUserId()
  const res = await fetch(`${w}/admin/redeem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ code, userId: uid }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Invalid coupon')
  }
  return res.json()
}

export async function reportContentPush() {
  const res = await fetch(`${w}/user/content-push`, {
    method: 'POST',
    headers: authHeaders(),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Content push failed')
  }
  return res.json()
}
