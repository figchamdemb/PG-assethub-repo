import { useState, useEffect } from 'react'
import {
  isGitHubConnected, getGitHubToken, setGitHubToken, clearGitHubToken,
  getGitHubUser, listRepos, getRepoTree, detectPages,
  loadContentJson, saveContentJson, getRepoFile, extractAllContent,
  startGitHubOAuth, handleOAuthCallback
} from '../lib/github.js'
import { listAssets } from '../lib/storage.js'

export default function ContentTab({ project }) {
  const [connected, setConnected] = useState(isGitHubConnected())
  const [ghUser, setGhUser] = useState(null)
  const [token, setToken] = useState('')
  const [showPat, setShowPat] = useState(false)
  const [repos, setRepos] = useState([])
  const [selectedRepo, setSelectedRepo] = useState(project.githubRepo || '')
  const [selectedBranch, setSelectedBranch] = useState('main')
  const [pages, setPages] = useState([])
  const [activePage, setActivePage] = useState(null)
  const [sections, setSections] = useState([])
  const [contentSha, setContentSha] = useState(null)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState(null)
  const [assets, setAssets] = useState([])
  const [pickingFor, setPickingFor] = useState(null) // field key waiting for image pick
  const [dirty, setDirty] = useState(false)
  const [showSource, setShowSource] = useState(false)
  const [pageSources, setPageSources] = useState({})

  useEffect(() => {
    // Handle OAuth callback if returning from GitHub
    const result = handleOAuthCallback()
    if (result?.success) {
      setConnected(true)
    } else if (result && !result.success) {
      alert('GitHub connection failed: ' + result.error)
    }
  }, [])

  useEffect(() => {
    if (connected) loadGitHub()
    loadAssets()
  }, [connected])

  async function loadAssets() {
    try { setAssets(await listAssets(project.slug)) } catch { setAssets([]) }
  }

  async function loadGitHub() {
    try {
      const u = await getGitHubUser()
      setGhUser(u)
      const r = await listRepos()
      setRepos(r)
    } catch { clearGitHubToken(); setConnected(false) }
  }

  async function handleConnect() {
    if (!token.trim()) return
    setGitHubToken(token.trim())
    setConnected(true)
    setToken('')
  }

  async function handleLoadRepo() {
    if (!selectedRepo) return
    setLoading(true)
    try {
      const tree = await getRepoTree(selectedRepo, selectedBranch)
      const detected = detectPages(tree)
      setPages(detected)
      if (detected.length) setActivePage(detected[0])
      const { sections: s, sha } = await loadContentJson(selectedRepo, selectedBranch)
      if (s.length) {
        setSections(s)
      } else {
        // No content.json yet — extract content from actual source files
        const extracted = await buildSectionsFromSource(detected, selectedRepo, selectedBranch)
        setSections(extracted)
      }
      setContentSha(sha)
      setDirty(false)
    } catch (e) {
      alert('Could not load repo: ' + e.message)
    }
    setLoading(false)
  }

  async function buildSectionsFromSource(pages, repo, branch) {
    const sources = {}
    const results = await Promise.all(pages.map(async (p) => {
      let fields = []
      try {
        const file = await getRepoFile(repo, p.path, branch)
        if (file) {
          sources[p.name] = file.content
          fields = extractAllContent(file.content, p.path)
        }
      } catch { /* ignore fetch errors */ }
      if (fields.length === 0) fields = [{ key: 'title', label: 'Page title', type: 'text', value: p.label }]
      return { page: p.name, pageLabel: p.label, fields }
    }))
    setPageSources(sources)
    return results
  }

  function updateField(page, key, value) {
    setSections(prev => prev.map(s => s.page === page
      ? { ...s, fields: s.fields.map(f => f.key === key ? { ...f, value } : f) }
      : s
    ))
    setDirty(true)
  }

  function addField(page) {
    const key = `field_${Date.now()}`
    setSections(prev => prev.map(s => s.page === page
      ? { ...s, fields: [...s.fields, { key, label: 'New field', type: 'text', value: '' }] }
      : s
    ))
    setDirty(true)
  }

  function removeField(page, key) {
    setSections(prev => prev.map(s => s.page === page
      ? { ...s, fields: s.fields.filter(f => f.key !== key) }
      : s
    ))
    setDirty(true)
  }

  async function handleSync() {
    setSyncing(true)
    setSyncMsg(null)
    try {
      await saveContentJson(selectedRepo, sections, contentSha, selectedBranch)
      setSyncMsg({ type:'success', text:'Pushed to GitHub. Cloudflare Pages is rebuilding your site…' })
      setDirty(false)
    } catch (e) {
      setSyncMsg({ type:'error', text: 'Sync failed: ' + e.message })
    }
    setSyncing(false)
  }

  const activeSection = sections.find(s => s.page === activePage?.name)

  if (!connected) {
    return (
      <div className="fade-in" style={{ maxWidth:520 }}>
        <h2 style={styles.title}>Connect GitHub</h2>
        <p style={{ fontSize:13, color:'var(--text2)', marginBottom:24, lineHeight:1.7 }}>
          Connect your GitHub account to sync website content — text, headings, and image URLs — directly to your repo. No code editing needed.
        </p>
        <div style={styles.card}>
          <div style={{ textAlign:'center', padding:'12px 0 8px' }}>
            <button className="btn-primary" onClick={startGitHubOAuth} style={{ fontSize:14, padding:'10px 28px', gap:8 }}>
              <GitHubIcon size={18} /> Connect with GitHub
            </button>
            <p style={{ fontSize:12, color:'var(--text3)', marginTop:12, lineHeight:1.6 }}>
              You'll be redirected to GitHub to authorize AssetHub.<br/>
              We only request access to your repositories.
            </p>
          </div>

          <div style={{ borderTop:'1px solid var(--border)', marginTop:20, paddingTop:16 }}>
            <button className="btn-ghost" onClick={() => setShowPat(!showPat)} style={{ fontSize:12, color:'var(--text3)' }}>
              {showPat ? '▾' : '▸'} Connect with Personal Access Token instead
            </button>
            {showPat && (
              <div style={{ marginTop:12 }}>
                <div style={styles.cardTitle}>Create a Personal Access Token</div>
                <ol style={{ fontSize:13, color:'var(--text2)', lineHeight:2, paddingLeft:20, marginBottom:16 }}>
                  <li>Go to <a href="https://github.com/settings/tokens/new" target="_blank" rel="noreferrer" style={{ color:'var(--accent)' }}>github.com/settings/tokens/new</a></li>
                  <li>Name it <code style={styles.code}>assethub</code></li>
                  <li>Check <code style={styles.code}>repo</code> scope</li>
                  <li>Click Generate token and paste it below</li>
                </ol>
                <input
                  className="input-field"
                  type="password"
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  style={{ marginBottom:10 }}
                />
                <button className="btn-primary" onClick={handleConnect} disabled={!token.trim()}>
                  <GitHubIcon size={14} /> Connect
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fade-in" style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Content editor — {project.name}</h2>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {dirty && <span style={{ fontSize:12, color:'var(--amber)' }}>● Unsaved changes</span>}
          {sections.length > 0 && (
            <button className="btn-green" onClick={handleSync} disabled={syncing || !dirty}>
              {syncing ? <><span className="spin">↻</span> Pushing…</> : <><SyncIcon size={13} /> Push to GitHub</>}
            </button>
          )}
        </div>
      </div>

      {/* GitHub status bar */}
      <div style={styles.ghBar}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={styles.ghDot} />
          <span style={{ fontSize:13, color:'var(--text)' }}>
            {ghUser ? `Connected as ${ghUser.login}` : 'GitHub connected'}
          </span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <select
            className="input-field"
            value={selectedRepo}
            onChange={e => setSelectedRepo(e.target.value)}
            style={{ width:240, fontSize:12, padding:'5px 8px' }}
          >
            <option value="">Select repository…</option>
            {repos.map(r => <option key={r.id} value={r.full_name}>{r.full_name}</option>)}
          </select>
          <select
            className="input-field"
            value={selectedBranch}
            onChange={e => setSelectedBranch(e.target.value)}
            style={{ width:100, fontSize:12, padding:'5px 8px' }}
          >
            <option value="main">main</option>
            <option value="master">master</option>
          </select>
          <button className="btn-secondary" onClick={handleLoadRepo} disabled={!selectedRepo || loading} style={{ fontSize:12, padding:'5px 12px' }}>
            {loading ? <><span className="spin">↻</span> Loading…</> : 'Load pages'}
          </button>
          <button className="btn-ghost" onClick={() => { clearGitHubToken(); setConnected(false) }} style={{ fontSize:12 }}>
            Disconnect
          </button>
        </div>
      </div>

      {syncMsg && (
        <div style={{ ...styles.syncMsg, ...(syncMsg.type==='success' ? styles.syncSuccess : styles.syncError) }}>
          {syncMsg.text}
        </div>
      )}

      {sections.length === 0
        ? <div style={{ fontSize:13, color:'var(--text3)', padding:'40px 0', textAlign:'center' }}>
            Select a repository and click "Load pages" to begin
          </div>
        : <div style={styles.editorGrid}>
            {/* Page tabs */}
            <div style={styles.pageTabs}>
              <span className="label" style={{ padding:'0 4px' }}>Pages</span>
              {sections.map(s => (
                <button key={s.page} onClick={() => setActivePage({ name:s.page, label:s.pageLabel })} style={{
                  ...styles.pageTab, ...(activePage?.name === s.page ? styles.pageTabActive : {})
                }}>
                  <PageIcon size={13} />
                  {s.pageLabel}
                </button>
              ))}
            </div>

            {/* Field editor */}
            <div style={styles.fieldPanel}>
              {activeSection ? (
                <>
                  <div style={styles.fieldPanelHeader}>
                    <span style={{ fontSize:15, fontWeight:500 }}>{activeSection.pageLabel}</span>
                    <div style={{ display:'flex', gap:8 }}>
                      <button className={showSource ? 'btn-secondary' : 'btn-ghost'} onClick={() => setShowSource(!showSource)} style={{ fontSize:12, padding:'4px 10px' }}>
                        {showSource ? '✕ Hide source' : '</> Source'}
                      </button>
                      <button className="btn-ghost" onClick={() => addField(activeSection.page)} style={{ fontSize:12 }}>
                        + Add field
                      </button>
                    </div>
                  </div>
                  {showSource && pageSources[activeSection.page] && (
                    <div style={{ maxHeight:300, overflow:'auto', background:'#0d1117', borderBottom:'1px solid var(--border)' }}>
                      <pre style={{ color:'#c9d1d9', fontFamily:'var(--mono)', fontSize:12, lineHeight:1.6, padding:'12px 16px', margin:0, whiteSpace:'pre-wrap', wordBreak:'break-all' }}>{pageSources[activeSection.page]}</pre>
                    </div>
                  )}
                  {activeSection.fields.map(field => (
                    <FieldEditor
                      key={field.key}
                      field={field}
                      assets={assets}
                      onUpdate={val => updateField(activeSection.page, field.key, val)}
                      onRemove={() => removeField(activeSection.page, field.key)}
                      onPickImage={() => setPickingFor({ page: activeSection.page, key: field.key })}
                    />
                  ))}
                </>
              ) : (
                <div style={{ fontSize:13, color:'var(--text3)', padding:'24px' }}>Select a page</div>
              )}
            </div>
          </div>
      }

      {/* Asset picker modal */}
      {pickingFor && (
        <div style={styles.modalOverlay} onClick={() => setPickingFor(null)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <span style={{ fontSize:14, fontWeight:500 }}>Pick from assets</span>
              <button className="btn-ghost" onClick={() => setPickingFor(null)}>×</button>
            </div>
            <div style={{ padding:16, display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px,1fr))', gap:10 }}>
              {assets.length === 0
                ? <p style={{ fontSize:13, color:'var(--text3)', gridColumn:'1/-1' }}>No assets uploaded yet for this project.</p>
                : assets.map(a => (
                    <div key={a.key} style={styles.assetPickCard} onClick={() => {
                      updateField(pickingFor.page, pickingFor.key, a.url)
                      setPickingFor(null)
                    }}>
                      {a.url && <img src={a.url} alt={a.name} style={{ width:'100%', height:80, objectFit:'cover', borderRadius:'var(--r) var(--r) 0 0' }} />}
                      <div style={{ padding:'6px 8px', fontSize:11 }}>{a.name}</div>
                    </div>
                  ))
              }
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FieldEditor({ field, onUpdate, onRemove, onPickImage }) {
  const [labelEdit, setLabelEdit] = useState(false)
  const [label, setLabel] = useState(field.label)

  return (
    <div style={styles.fieldBlock}>
      <div style={styles.fieldRow}>
        <div style={{ flex:1 }}>
          {labelEdit
            ? <input className="input-field" value={label} onChange={e => setLabel(e.target.value)} onBlur={() => setLabelEdit(false)} autoFocus style={{ fontSize:11, padding:'3px 6px', marginBottom:6 }} />
            : <div style={styles.fieldLabel} onClick={() => setLabelEdit(true)} title="Click to rename">{field.label}</div>
          }
        </div>
        <div style={{ display:'flex', gap:4, alignItems:'center' }}>
          <select value={field.type} onChange={e => {}} style={{ fontSize:11, padding:'2px 4px', background:'var(--bg3)', border:'1px solid var(--border2)', color:'var(--text2)', borderRadius:'var(--r)' }}>
            <option value="text">text</option>
            <option value="textarea">textarea</option>
            <option value="image">image</option>
            <option value="url">url</option>
          </select>
          <button className="btn-danger" onClick={onRemove} style={{ fontSize:11, padding:'2px 6px' }}>×</button>
        </div>
      </div>

      {field.type === 'textarea'
        ? <textarea
            className="input-field"
            rows={3}
            value={field.value}
            onChange={e => onUpdate(e.target.value)}
            style={{ resize:'vertical' }}
          />
        : field.type === 'image'
        ? <div style={styles.imageFieldInner}>
            {field.value && <img src={field.value} alt="" style={{ height:60, maxWidth:120, objectFit:'cover', borderRadius:'var(--r)', border:'1px solid var(--border)' }} />}
            <div style={{ flex:1 }}>
              <input className="input-field" value={field.value} onChange={e => onUpdate(e.target.value)} placeholder="Image URL" style={{ marginBottom:6, fontSize:12 }} />
              <div style={{ display:'flex', gap:6 }}>
                <button className="btn-secondary" onClick={onPickImage} style={{ fontSize:11, padding:'4px 10px' }}>Pick from assets</button>
                {field.value && <button className="btn-ghost" onClick={() => window.open(field.value,'_blank')} style={{ fontSize:11, padding:'4px 8px' }}>View</button>}
              </div>
            </div>
          </div>
        : <input className="input-field" value={field.value} onChange={e => onUpdate(e.target.value)} />
      }
    </div>
  )
}

const styles = {
  container: { maxWidth:980 },
  header: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 },
  title: { fontSize:20, fontWeight:500, letterSpacing:'-0.02em' },
  card: { background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--r2)', padding:'20px' },
  cardTitle: { fontSize:14, fontWeight:500, marginBottom:12 },
  code: { fontFamily:'var(--mono)', fontSize:12, background:'var(--bg3)', padding:'1px 5px', borderRadius:4, color:'var(--text2)' },
  ghBar: { display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:'10px 14px', marginBottom:16 },
  ghDot: { width:8, height:8, borderRadius:'50%', background:'var(--green)' },
  syncMsg: { fontSize:13, padding:'10px 14px', borderRadius:'var(--r)', marginBottom:16 },
  syncSuccess: { background:'var(--green-dim)', color:'var(--green)', border:'1px solid rgba(62,207,142,0.25)' },
  syncError: { background:'var(--red-dim)', color:'var(--red)', border:'1px solid rgba(255,87,87,0.2)' },
  editorGrid: { display:'grid', gridTemplateColumns:'200px 1fr', gap:16 },
  pageTabs: { display:'flex', flexDirection:'column', gap:2 },
  pageTab: { display:'flex', alignItems:'center', gap:7, padding:'8px 10px', borderRadius:'var(--r)', fontSize:13, color:'var(--text2)', background:'none', border:'none', cursor:'pointer', textAlign:'left', transition:'background .12s' },
  pageTabActive: { background:'var(--accent-dim)', color:'var(--accent)', fontWeight:500 },
  fieldPanel: { background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--r2)', overflow:'hidden' },
  fieldPanelHeader: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', borderBottom:'1px solid var(--border)', background:'var(--bg3)' },
  fieldBlock: { padding:'14px 16px', borderBottom:'1px solid var(--border)' },
  fieldRow: { display:'flex', alignItems:'flex-start', gap:8, marginBottom:8 },
  fieldLabel: { fontSize:11, fontWeight:500, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.06em', cursor:'pointer', padding:'2px 0' },
  imageFieldInner: { display:'flex', gap:12, alignItems:'flex-start' },
  modalOverlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:20 },
  modal: { background:'var(--bg2)', borderRadius:'var(--r2)', border:'1px solid var(--border2)', width:'100%', maxWidth:680, maxHeight:'80vh', overflowY:'auto' },
  modalHeader: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px', borderBottom:'1px solid var(--border)' },
  assetPickCard: { border:'1px solid var(--border)', borderRadius:'var(--r)', cursor:'pointer', overflow:'hidden', transition:'border-color .12s' },
}

function GitHubIcon({ size=16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z"/></svg>
}
function SyncIcon({ size=16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15"/></svg>
}
function PageIcon({ size=16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
}
