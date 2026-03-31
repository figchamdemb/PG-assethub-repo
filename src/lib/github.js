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
  const pageFiles = tree.filter(f =>
    f.type === 'blob' &&
    (f.path.match(/\.(html|jsx|tsx|vue|astro|svelte)$/) ||
     f.path.match(/pages\//i) ||
     f.path.match(/app\//i))
  )

  const pages = []
  const seen = new Set()

  for (const f of pageFiles) {
    const parts = f.path.split('/')
    const filename = parts[parts.length - 1]
    const name = filename.replace(/\.(html|jsx|tsx|vue|astro|svelte)$/, '')

    // Normalise page name
    let label = name
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
      .replace(/^Index$/, 'Home')
      .replace(/^Page$/, 'Page')

    if (label === 'Layout' || label === 'App' || label === '_App' || label === '_Document') continue
    if (seen.has(f.path)) continue
    seen.add(f.path)

    pages.push({ path: f.path, label, name })
  }

  return pages.slice(0, 20)
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
