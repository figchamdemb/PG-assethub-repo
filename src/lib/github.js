// GitHub API helpers - all done from the browser, no backend needed

import config from '../config.js'

const GH_TOKEN_KEY = 'assethub_github_token'
const GH_REPOS_KEY = 'assethub_github_repos'

export function getGitHubToken() {
  return localStorage.getItem(GH_TOKEN_KEY)
}

export function setGitHubToken(token) {
  localStorage.setItem(GH_TOKEN_KEY, token)
}

export function clearGitHubToken() {
  localStorage.removeItem(GH_TOKEN_KEY)
  localStorage.removeItem(GH_REPOS_KEY)
}

export function isGitHubConnected() {
  return !!getGitHubToken()
}

// ── OAuth flow ─────────────────────────────────────────────────
export function startGitHubOAuth() {
  const workerUrl = config.workerUrl.replace(/\/$/, '')
  const appUrl = window.location.origin
  window.location.href = `${workerUrl}/auth/github?app_url=${encodeURIComponent(appUrl)}`
}

// Call this on app load to check for OAuth callback token in URL
export function handleOAuthCallback() {
  const params = new URLSearchParams(window.location.search)
  const token = params.get('github_token')
  const error = params.get('github_error')

  if (token) {
    setGitHubToken(token)
    // Clean the URL
    window.history.replaceState({}, '', window.location.pathname)
    return { success: true }
  }
  if (error) {
    window.history.replaceState({}, '', window.location.pathname)
    return { success: false, error }
  }
  return null // no callback happening
}

async function ghFetch(path, options = {}) {
  const token = getGitHubToken()
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      ...options.headers,
    }
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message || 'GitHub API error')
  }
  return res.json()
}

export async function getGitHubUser() {
  return ghFetch('/user')
}

export async function listRepos() {
  const data = await ghFetch('/user/repos?per_page=100&sort=updated&type=all')
  return data.map(r => ({ id: r.id, full_name: r.full_name, name: r.name, private: r.private, default_branch: r.default_branch }))
}

// Get all pages/files in a repo to detect page structure
export async function getRepoTree(repo, branch = 'main') {
  try {
    const data = await ghFetch(`/repos/${repo}/git/trees/${branch}?recursive=1`)
    return data.tree || []
  } catch {
    // try master branch
    const data = await ghFetch(`/repos/${repo}/git/trees/master?recursive=1`)
    return data.tree || []
  }
}

// Read a file from the repo
export async function getRepoFile(repo, path, branch = 'main') {
  try {
    const data = await ghFetch(`/repos/${repo}/contents/${path}?ref=${branch}`)
    const content = atob(data.content.replace(/\n/g, ''))
    return { content, sha: data.sha }
  } catch {
    return null
  }
}

// Create or update a file in the repo
export async function putRepoFile(repo, path, content, message, sha, branch = 'main') {
  const body = {
    message,
    content: btoa(unescape(encodeURIComponent(content))),
    branch,
  }
  if (sha) body.sha = sha
  return ghFetch(`/repos/${repo}/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

// Detect pages from repo tree
export function detectPages(tree) {
  const pageExt = /\.(html|jsx|tsx|vue|astro|svelte)$/
  // Non-page filenames to skip (internal app / framework files)
  const SKIP_NAMES = /^(layout|_layout|_app|_document|app|main|entry|setup|provider|context|store|router|routes|utils|helpers|types|constants|config|middleware|error|loading|not-found)$/i
  // Component-like names to skip (PascalCase with Tab/Page/View/Modal/Card/List/Form/Panel/Widget suffix)
  const SKIP_COMPONENT = /^[A-Z].*(?:Tab|Page|View|Modal|Card|List|Form|Panel|Widget|Sidebar|Header|Footer|Nav|Layout|Provider|Context|Dialog|Drawer|Menu|Toolbar|Wrapper)$/
  // Also skip well-known dashboard/app components
  const SKIP_APP_NAMES = /^(Dashboard|Login|Signup|Register|Settings|Profile|Admin|Auth|Pricing|Upload|Assets|Content|NotFound|ErrorBoundary)$/i
  const SKIP_DIRS = /\b(lib|utils|hooks|helpers|components|services|store|context|styles|assets|public|node_modules|__tests__|test)\b/i

  const pageFiles = tree.filter(f => {
    if (f.type !== 'blob') return false
    if (!pageExt.test(f.path)) return false
    const parts = f.path.split('/')
    const filename = parts[parts.length - 1]
    const name = filename.replace(pageExt, '')
    // Always skip known non-page names (but "page" is a Next.js App Router convention — keep it)
    if (SKIP_NAMES.test(name) && name.toLowerCase() !== 'page') return false
    // Skip React/Vue component-like names (PascalCase + UI suffix)
    if (SKIP_COMPONENT.test(name)) return false
    // Skip common app dashboard names
    if (SKIP_APP_NAMES.test(name)) return false
    // Root-level HTML files are always content pages
    if (parts.length === 1 && /\.html$/.test(filename)) return true
    // Next.js App Router: app/**/page.jsx — always include
    if (name.toLowerCase() === 'page') return true
    // Files in pages/ or app/ dirs — include only if they look like content, not components
    const inPageDir = /\b(pages?|app|views?|routes?)\b/i.test(f.path.replace(filename, ''))
    if (inPageDir) {
      if (/^(index|home|about|contact|blog|faq|pricing|services|portfolio|terms|privacy|404|500)$/i.test(name)) return true
      if (/^[a-z][a-z0-9-]*$/.test(name)) return true
      if (/^[A-Z]/.test(name)) return false
      return true
    }
    // Otherwise skip files inside utility directories
    if (SKIP_DIRS.test(f.path)) return false
    return true
  })

  const pages = []
  const seen = new Set()

  for (const f of pageFiles) {
    const parts = f.path.split('/')
    const filename = parts[parts.length - 1]
    const name = filename.replace(pageExt, '')

    let label
    // Next.js App Router: app/about/page.tsx → label from parent directory
    if (name.toLowerCase() === 'page' && parts.length >= 2) {
      const parentDir = parts[parts.length - 2]
      // If parent is 'app' itself, this is the root page → Home
      label = parentDir.toLowerCase() === 'app' ? 'Home'
        : parentDir.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    } else {
      label = name
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
        .replace(/^Index$/, 'Home')
    }

    if (seen.has(f.path)) continue
    seen.add(f.path)

    pages.push({ path: f.path, label, name })
  }

  return pages.slice(0, 20)
}

// Extract text content from an HTML/JSX source file
export function extractContentFromSource(content, filePath) {
  const ext = (filePath.split('.').pop() || '').toLowerCase()
  const result = { title: '', heading: '', subheading: '', bodyText: '', heroImage: '' }

  // Collapse whitespace and strip JSX noise from extracted text
  const norm = (s) => s.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/[{}]/g, '').replace(/\s+/g, ' ').trim()
  // Reject strings that look like JS variable references rather than real content
  const isReal = (s) => s && !/^[a-z_$][a-z0-9_.|\s]*$/i.test(s) && s.length > 1
  // Reject strings that contain JS code patterns
  const hasCode = (s) => /\b(const |let |var |function |=>|import |require\(|\{\{|\}\}|\.map\(|\.filter\(|\.forEach\()/.test(s)
  const isRealUrl = (s) => s && /^https?:\/\//.test(s)

  // Strip script/style blocks and JS code to avoid false matches
  const clean = content
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // Strip JSX expressions { ... } that span code
    .replace(/\{(?:\/\*[\s\S]*?\*\/|[^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, ' ')
    // Strip single-line JS comments
    .replace(/\/\/[^\n]*/g, '')
    // Strip multi-line JS comments
    .replace(/\/\*[\s\S]*?\*\//g, '')

  // HTML-like files
  if (['html', 'astro', 'svelte', 'vue'].includes(ext)) {
    const titleMatch = content.match(/<title[^>]*>(.*?)<\/title>/is)
    if (titleMatch) result.title = norm(titleMatch[1])

    const h1 = clean.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
    if (h1) result.heading = norm(h1[1])

    const h2 = clean.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)
    if (h2) result.subheading = norm(h2[1])

    const pAll = [...clean.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    for (const m of pAll) {
      const txt = norm(m[1])
      if (txt.length > 15 && isReal(txt) && !hasCode(txt)) { result.bodyText = txt; break }
    }

    const imgAll = [...clean.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)]
    for (const m of imgAll) {
      if (isRealUrl(m[1])) { result.heroImage = m[1]; break }
    }
  }

  // JSX / TSX files
  if (['jsx', 'tsx'].includes(ext)) {
    const h1 = clean.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
    if (h1) {
      const inner = norm(h1[1])
      if (isReal(inner)) result.heading = inner
    }

    const h2 = clean.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)
    if (h2) {
      const inner = norm(h2[1])
      if (isReal(inner)) result.subheading = inner
    }

    const pAll = [...clean.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    for (const m of pAll) {
      const txt = norm(m[1])
      if (txt.length > 15 && isReal(txt) && !hasCode(txt)) { result.bodyText = txt; break }
    }

    const imgAll = [...clean.matchAll(/<img[^>]+src=["'{]([^"'}]+)["'}][^>]*\/?>/gi)]
    for (const m of imgAll) {
      if (isRealUrl(m[1])) { result.heroImage = m[1]; break }
    }
  }

  return result
}

// Read content.json from a project's repo and parse sections
export async function loadContentJson(repo, branch) {
  const file = await getRepoFile(repo, 'content.json', branch)
  if (!file) return { sections: [], sha: null }
  try {
    const parsed = JSON.parse(file.content)
    return { sections: parsed.sections || [], sha: file.sha }
  } catch {
    return { sections: [], sha: null }
  }
}

// Save content.json back to the repo
export async function saveContentJson(repo, sections, sha, branch) {
  const content = JSON.stringify({ sections, updatedAt: new Date().toISOString() }, null, 2)
  return putRepoFile(
    repo,
    'content.json',
    content,
    'chore: update content via AssetHub',
    sha,
    branch
  )
}
