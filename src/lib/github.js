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

    const labelKey = label.toLowerCase()
    if (seen.has(labelKey)) continue
    seen.add(labelKey)

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
  const isReal = (s) => {
    if (!s || s.length <= 1) return false
    if (/\s/.test(s.trim())) return true          // multi-word → real content
    if (/^[a-z_$]/.test(s)) return false           // single lowercase token → likely variable
    return true                                     // single Capitalized word → real
  }
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

  // Fallback: extract from string constants when tag-based extraction yielded nothing
  if (!result.title && ['jsx', 'tsx'].includes(ext)) {
    const m = clean.match(/<title[^>]*>(.*?)<\/title>/is)
    if (m) result.title = norm(m[1])
  }
  if (!result.heading) {
    const m = content.match(/(?:title|heading|hero)\w*\s*[:=]\s*["'`]([^"'`\n]{3,})["'`]/i)
    if (m && isReal(m[1]) && !hasCode(m[1])) result.heading = m[1].trim()
  }
  if (!result.bodyText) {
    const m = content.match(/(?:description|subtitle|subheading|body|snippet|summary)\w*\s*[:=]\s*["'`]([^"'`\n]{15,})["'`]/i)
    if (m && isReal(m[1]) && !hasCode(m[1])) result.bodyText = m[1].trim()
  }
  if (!result.bodyText) {
    const all = [...content.matchAll(/["'`]([^"'`\n]{30,})["'`]/g)]
    for (const m of all) {
      const s = m[1].trim()
      if (isReal(s) && !hasCode(s) && /\s/.test(s) && !/^[@/.\\#]/.test(s)) {
        result.bodyText = s; break
      }
    }
  }

  return result
}

// Extract ALL text and images from a source file — returns dynamic field array
export function extractAllContent(content, filePath) {
  const ext = (filePath.split('.').pop() || '').toLowerCase()
  const fields = []
  const norm = (s) => s.replace(/<[^>]+>/g, '').replace(/\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim()
  const hasCode = (s) => /\b(const |let |var |function |=>|import |require\(|\.map\(|\.filter\(|\.forEach\()/.test(s)

  let clean = content
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
  if (['jsx', 'tsx'].includes(ext)) {
    clean = clean
      .replace(/^import\s+.*$/gm, '')
      .replace(/\{(?:\/\*[\s\S]*?\*\/|[^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, ' ')
      .replace(/\/\/[^\n]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
  }

  const seen = new Set()
  let idx = 0
  const labels = { title:'Title', h1:'Heading', h2:'Subheading', h3:'Heading 3', h4:'Heading 4', p:'Paragraph', span:'Text', a:'Link text', li:'List item', button:'Button text', label:'Label', figcaption:'Caption', blockquote:'Quote', string:'Text' }
  const add = (tag, raw) => {
    const text = norm(raw)
    if (text.length < 2 || seen.has(text) || hasCode(text)) return
    seen.add(text)
    const type = (tag === 'p' || tag === 'blockquote' || text.length > 80) ? 'textarea' : 'text'
    fields.push({ key: `${tag}_${idx++}`, label: labels[tag] || 'Text', type, value: text })
  }

  // Title tag
  const titleM = content.match(/<title[^>]*>(.*?)<\/title>/is)
  if (titleM) add('title', titleM[1])

  // All headings
  for (const tag of ['h1','h2','h3','h4','h5','h6'])
    for (const m of clean.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi')))
      add(tag, m[1])

  // All paragraphs
  for (const m of clean.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi))
    add('p', m[1])

  // Spans, links, list items, buttons
  for (const tag of ['span','a','li','label','button','figcaption','blockquote'])
    for (const m of clean.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi')))
      if (norm(m[1]).length > 3) add(tag, m[1])

  // Fallback: named string constants
  if (fields.filter(f => f.type !== 'image').length < 3) {
    for (const m of content.matchAll(/(?:title|heading|description|subtitle|body|text|label|caption|hero|cta)\w*\s*[:=]\s*["'`]([^"'`\n]{3,})["'`]/gi))
      add('string', m[1])
  }
  // Fallback: any long quoted strings
  if (fields.filter(f => f.type !== 'image').length < 3) {
    for (const m of content.matchAll(/["'`]([^"'`\n]{20,})["'`]/g)) {
      const s = m[1].trim()
      if (/\s/.test(s) && !hasCode(s) && !/^[@\/.\\#{}(]/.test(s)) add('string', s)
    }
  }

  // ALL images: <img>, <Image>, CSS url()
  const imgSeen = new Set()
  let imgIdx = 0
  const addImg = (src, alt) => {
    if (imgSeen.has(src) || !src) return
    imgSeen.add(src)
    fields.push({ key: `img_${imgIdx++}`, label: alt ? `Image: ${alt}` : 'Image', type: 'image', value: src })
  }
  for (const m of content.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi))
    addImg(m[1], (m[0].match(/alt=["']([^"']*)["']/i) || [])[1] || '')
  for (const m of content.matchAll(/<Image[^>]+src=["'{]([^"'}]+)["'}][^>]*>/gi))
    addImg(m[1], '')
  for (const m of content.matchAll(/url\(["']?([^"')]+)["']?\)/gi))
    if (/\.(png|jpg|jpeg|gif|svg|webp)/i.test(m[1])) addImg(m[1], 'background')

  return fields
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
