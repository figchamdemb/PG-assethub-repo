/**
 * Smoke test — Content extraction logic
 * Runs against this repo's actual files to verify extractContentFromSource + detectPages
 * Usage: node tests/smoke-content-extraction.mjs
 */
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, extname, basename } from 'path'

// ---------- Copy of extractContentFromSource from src/lib/github.js ----------
function extractContentFromSource(content, filePath) {
  const ext = (filePath.split('.').pop() || '').toLowerCase()
  const result = { title: '', heading: '', subheading: '', bodyText: '', heroImage: '' }

  const norm = (s) => s.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/[{}]/g, '').replace(/\s+/g, ' ').trim()
  const isReal = (s) => s && !/^[a-z_$][a-z0-9_.|\s]*$/i.test(s) && s.length > 1
  const isRealUrl = (s) => s && /^https?:\/\//.test(s)

  const clean = content
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')

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
      if (txt.length > 15 && isReal(txt)) { result.bodyText = txt; break }
    }

    const imgAll = [...clean.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)]
    for (const m of imgAll) {
      if (isRealUrl(m[1])) { result.heroImage = m[1]; break }
    }
  }

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
      if (txt.length > 15 && isReal(txt)) { result.bodyText = txt; break }
    }

    const imgAll = [...clean.matchAll(/<img[^>]+src=["'{]([^"'}]+)["'}][^>]*\/?>/gi)]
    for (const m of imgAll) {
      if (isRealUrl(m[1])) { result.heroImage = m[1]; break }
    }
  }

  return result
}

// ---------- Copy of detectPages from src/lib/github.js ----------
function detectPages(tree) {
  const pageExt = /\.(html|jsx|tsx|vue|astro|svelte)$/
  const SKIP_NAMES = /^(layout|_layout|_app|_document|app|main|entry|setup|provider|context|store|router|routes|utils|helpers|types|constants|config|middleware|error|loading|not-found)$/i
  const SKIP_DIRS = /\b(lib|utils|hooks|helpers|components|services|store|context|styles|assets|public|node_modules|__tests__|test)\b/i

  const pageFiles = tree.filter(f => {
    if (f.type !== 'blob') return false
    if (!pageExt.test(f.path)) return false
    const parts = f.path.split('/')
    const filename = parts[parts.length - 1]
    const name = filename.replace(pageExt, '')
    if (SKIP_NAMES.test(name)) return false
    const inPageDir = /\b(pages?|app|views?|routes?)\b/i.test(f.path.replace(filename, ''))
    if (inPageDir) return true
    if (parts.length === 1 && /\.html$/.test(filename)) return true
    if (SKIP_DIRS.test(f.path)) return false
    return true
  })

  const pages = []
  const seen = new Set()

  for (const f of pageFiles) {
    const parts = f.path.split('/')
    const filename = parts[parts.length - 1]
    const name = filename.replace(pageExt, '')
    let label = name.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).replace(/^Index$/, 'Home')
    if (seen.has(f.path)) continue
    seen.add(f.path)
    pages.push({ path: f.path, label, name })
  }

  return pages.slice(0, 20)
}

// ---------- Build a tree from the local filesystem (mimics GitHub API tree) ----------
function buildLocalTree(rootDir, prefix = '') {
  const entries = []
  for (const item of readdirSync(rootDir)) {
    if (item === 'node_modules' || item === 'dist' || item === '.git') continue
    const fullPath = join(rootDir, item)
    const relPath = prefix ? `${prefix}/${item}` : item
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      entries.push({ path: relPath, type: 'tree' })
      entries.push(...buildLocalTree(fullPath, relPath))
    } else {
      entries.push({ path: relPath, type: 'blob' })
    }
  }
  return entries
}

// ═══════════════════════ RUN TESTS ═══════════════════════

const ROOT = join(import.meta.dirname, '..')
const tree = buildLocalTree(ROOT)

console.log('═══════════════════════════════════════════════')
console.log(' SMOKE TEST: Content Extraction')
console.log('═══════════════════════════════════════════════\n')

// --- Test 1: detectPages ---
const pages = detectPages(tree)
console.log(`[TEST 1] detectPages found ${pages.length} pages:`)
let pass1 = true
for (const p of pages) {
  console.log(`  ✓ ${p.label.padEnd(20)} → ${p.path}`)
}

// Check that utility files are NOT detected
const BAD_NAMES = ['App', 'main', 'config', 'auth']
for (const bad of BAD_NAMES) {
  const found = pages.find(p => p.name.toLowerCase() === bad.toLowerCase())
  if (found) {
    console.log(`  ✗ FAIL: "${bad}" should be filtered out but was detected at ${found.path}`)
    pass1 = false
  }
}
console.log(pass1 ? '  → PASS\n' : '  → FAIL\n')

// --- Test 2: extractContentFromSource on each detected page ---
console.log('[TEST 2] extractContentFromSource on each page:\n')
let pass2 = true
let anyContentFound = false

for (const p of pages) {
  const filePath = join(ROOT, p.path)
  let content
  try { content = readFileSync(filePath, 'utf-8') } catch { continue }
  const ex = extractContentFromSource(content, p.path)

  const hasContent = ex.title || ex.heading || ex.subheading || ex.bodyText || ex.heroImage
  if (hasContent) anyContentFound = true

  console.log(`  📄 ${p.label} (${p.path})`)
  console.log(`     title:       "${ex.title || '—'}"`)
  console.log(`     heading:     "${ex.heading || '—'}"`)
  console.log(`     subheading:  "${ex.subheading || '—'}"`)
  console.log(`     bodyText:    "${(ex.bodyText || '—').slice(0, 80)}${ex.bodyText && ex.bodyText.length > 80 ? '…' : ''}"`)
  console.log(`     heroImage:   "${ex.heroImage || '—'}"`)
  console.log()
}

if (!anyContentFound) {
  console.log('  ✗ FAIL: No content was extracted from any page')
  pass2 = false
} else {
  console.log('  → Content extracted successfully')
}

// --- Test 3: Specific checks on known files ---
console.log('\n[TEST 3] Specific file checks:\n')
let pass3 = true

// index.html should have title "AssetHub"
const indexHtml = readFileSync(join(ROOT, 'index.html'), 'utf-8')
const indexEx = extractContentFromSource(indexHtml, 'index.html')
if (indexEx.title === 'AssetHub') {
  console.log('  ✓ index.html → title = "AssetHub"')
} else {
  console.log(`  ✗ FAIL: index.html title expected "AssetHub", got "${indexEx.title}"`)
  pass3 = false
}

// Login.jsx should have heading with "Manage every image"
const loginJsx = readFileSync(join(ROOT, 'src/pages/Login.jsx'), 'utf-8')
const loginEx = extractContentFromSource(loginJsx, 'Login.jsx')
if (loginEx.heading && loginEx.heading.includes('Manage every image')) {
  console.log(`  ✓ Login.jsx → heading contains "Manage every image"`)
} else {
  console.log(`  ✗ FAIL: Login.jsx heading expected to contain "Manage every image", got "${loginEx.heading}"`)
  pass3 = false
}

// Login.jsx should have body text about "Upload, compress"
if (loginEx.bodyText && loginEx.bodyText.includes('Upload, compress')) {
  console.log(`  ✓ Login.jsx → bodyText contains "Upload, compress"`)
} else {
  console.log(`  ✗ FAIL: Login.jsx bodyText expected to contain "Upload, compress", got "${loginEx.bodyText}"`)
  pass3 = false
}

// content.example.html should extract "Barista Cafe" title
const exampleHtml = readFileSync(join(ROOT, 'content.example.html'), 'utf-8')
const exampleEx = extractContentFromSource(exampleHtml, 'content.example.html')
if (exampleEx.title === 'Barista Cafe') {
  console.log(`  ✓ content.example.html → title = "Barista Cafe"`)
} else {
  console.log(`  ✗ FAIL: content.example.html title expected "Barista Cafe", got "${exampleEx.title}"`)
  pass3 = false
}

// content.example.html h1 should have "Loading…"
if (exampleEx.heading === 'Loading…') {
  console.log(`  ✓ content.example.html → h1 = "Loading…"`)
} else {
  console.log(`  ✗ FAIL: content.example.html h1 expected "Loading…", got "${exampleEx.heading}"`)
  pass3 = false
}

console.log()
console.log('═══════════════════════════════════════════════')
const allPass = pass1 && pass2 && pass3
console.log(allPass ? ' ALL TESTS PASSED ✓' : ' SOME TESTS FAILED ✗')
console.log('═══════════════════════════════════════════════')
process.exit(allPass ? 0 : 1)
