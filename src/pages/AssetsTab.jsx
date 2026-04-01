import { useState, useEffect } from 'react'
import { listAssets, deleteAsset, uploadAsset, formatBytes } from '../lib/storage.js'
import { isGitHubConnected, listRepos, getRepoTree, getRepoFile, putRepoFileBinary } from '../lib/github.js'
import config from '../config.js'

const IMG_EXT = /\.(png|jpg|jpeg|gif|svg|webp|ico|avif|bmp)$/i

function guessAssetType(path) {
  const lower = path.toLowerCase()
  if (/logo/i.test(lower)) return 'logo'
  if (/hero|banner/i.test(lower)) return 'hero-banner'
  if (/icon|favicon/i.test(lower)) return 'icon'
  if (/bg|background|texture/i.test(lower)) return 'background'
  if (/thumb/i.test(lower)) return 'thumbnail'
  if (/product/i.test(lower)) return 'product'
  if (/gallery/i.test(lower)) return 'gallery'
  return 'other'
}

export default function AssetsTab({ project }) {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [viewAsset, setViewAsset] = useState(null)
  const [copied, setCopied] = useState(null)
  const [replaceAsset, setReplaceAsset] = useState(null)
  const [repoAssets, setRepoAssets] = useState([])
  const [repos, setRepos] = useState([])
  const [selectedRepo, setSelectedRepo] = useState('')
  const [scanLoading, setScanLoading] = useState(false)
  const [tab, setTab] = useState('uploaded') // 'uploaded' | 'repo'
  const [replaceRepoAsset, setReplaceRepoAsset] = useState(null)
  const [imgDims, setImgDims] = useState({}) // key -> { w, h }

  useEffect(() => {
    loadAssets()
    if (isGitHubConnected()) {
      listRepos().then(r => setRepos(r)).catch(() => {})
    }
  }, [project])

  async function loadAssets() {
    setLoading(true)
    try {
      const list = await listAssets(project.slug)
      setAssets(list)
    } catch {
      // Demo data
      setAssets(DEMO_ASSETS)
    }
    setLoading(false)
  }

  async function handleScanRepo() {
    if (!selectedRepo) return
    setScanLoading(true)
    try {
      const tree = await getRepoTree(selectedRepo)
      const images = tree
        .filter(f => f.type === 'blob' && IMG_EXT.test(f.path))
        .map(f => {
          const parts = f.path.split('/')
          const filename = parts[parts.length - 1]
          const ext = (filename.split('.').pop() || '').toLowerCase()
          return {
            key: 'repo:' + f.path,
            name: filename,
            path: f.path,
            repo: selectedRepo,
            sha: f.sha || null,
            assetType: guessAssetType(f.path),
            format: ext,
            size: f.size || 0,
            url: `https://raw.githubusercontent.com/${selectedRepo}/main/${f.path}`,
            source: 'repo',
          }
        })
      setRepoAssets(images)
      setTab('repo')
    } catch (e) {
      alert('Could not scan repo: ' + e.message)
    }
    setScanLoading(false)
  }

  const filtered = assets.filter(a => {
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.assetType.toLowerCase().includes(search.toLowerCase())
    const matchType = filterType === 'all' || a.assetType === filterType
    return matchSearch && matchType
  })

  const filteredRepo = repoAssets.filter(a => {
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.path.toLowerCase().includes(search.toLowerCase())
    const matchType = filterType === 'all' || a.assetType === filterType
    return matchSearch && matchType
  })

  const displayAssets = tab === 'repo' ? filteredRepo : filtered
  const totalSize = assets.reduce((s, a) => s + (a.size || 0), 0)

  async function handleDelete(asset) {
    if (!confirm(`Delete "${asset.name}"? This cannot be undone.`)) return
    await deleteAsset(project.slug, asset.key)
    setAssets(a => a.filter(x => x.key !== asset.key))
  }

  function copyUrl(asset) {
    navigator.clipboard.writeText(asset.url)
    setCopied(asset.key)
    setTimeout(() => setCopied(null), 2000)
  }

  const typeColors = {
    'logo': 'chip-purple',
    'hero-banner': 'chip-green',
    'card-image': 'chip-amber',
    'background': 'chip-blue',
    'menu-item': 'chip-blue',
    'thumbnail': 'chip-amber',
    'icon': 'chip-purple',
    'gallery': 'chip-green',
    'product': 'chip-amber',
    'other': 'chip-blue',
  }

  return (
    <div className="fade-in" style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Assets — {project.name}</h2>
      </div>

      {/* Stats */}
      <div style={styles.statsRow}>
        {[
          { label: 'Uploaded assets', value: assets.length },
          { label: 'Repo images', value: repoAssets.length || '—' },
          { label: 'Total size', value: formatBytes(totalSize) },
        ].map(s => (
          <div key={s.label} style={styles.stat}>
            <div style={styles.statLabel}>{s.label}</div>
            <div style={styles.statVal}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs + Repo scanner */}
      <div style={{ display:'flex', gap:8, marginBottom:12, alignItems:'center', flexWrap:'wrap' }}>
        <button className={tab === 'uploaded' ? 'btn-primary' : 'btn-secondary'} onClick={() => setTab('uploaded')} style={{ fontSize:12, padding:'6px 14px' }}>
          Uploaded ({assets.length})
        </button>
        <button className={tab === 'repo' ? 'btn-primary' : 'btn-secondary'} onClick={() => setTab('repo')} style={{ fontSize:12, padding:'6px 14px' }}>
          Repo images ({repoAssets.length})
        </button>
        {isGitHubConnected() && (
          <div style={{ display:'flex', gap:6, marginLeft:'auto', alignItems:'center' }}>
            <select className="input-field" value={selectedRepo} onChange={e => setSelectedRepo(e.target.value)} style={{ width:220, fontSize:12, padding:'5px 8px' }}>
              <option value="">Select repo…</option>
              {repos.map(r => <option key={r.id} value={r.full_name}>{r.full_name}</option>)}
            </select>
            <button className="btn-secondary" onClick={handleScanRepo} disabled={!selectedRepo || scanLoading} style={{ fontSize:12, padding:'5px 12px', whiteSpace:'nowrap' }}>
              {scanLoading ? 'Scanning…' : 'Scan images'}
            </button>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div style={styles.toolbar}>
        <input
          className="input-field"
          placeholder="Search by name or type…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex:1 }}
        />
        <select
          className="input-field"
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          style={{ width:160 }}
        >
          <option value="all">All types</option>
          {config.assetTypes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </div>

      {loading
        ? <div style={{ color:'var(--text3)', fontSize:13, padding:'40px 0', textAlign:'center' }}>Loading assets…</div>
        : displayAssets.length === 0
        ? <div style={{ color:'var(--text3)', fontSize:13, padding:'40px 0', textAlign:'center' }}>
            {tab === 'repo'
              ? (repoAssets.length === 0 ? 'Select a repo and click "Scan images" to find all images' : 'No images match your search')
              : (assets.length === 0 ? 'No assets yet — upload your first image' : 'No assets match your search')}
          </div>
        : <div style={styles.grid}>
            {displayAssets.map(asset => (
              <div key={asset.key} style={styles.card}>
                <div style={styles.cardImg} onClick={() => setViewAsset(asset)}>
                  {asset.url
                    ? <img src={asset.url} alt={asset.name} style={styles.thumbImg}
                        onLoad={e => { const w = e.target.naturalWidth, h = e.target.naturalHeight; if (w && h) setImgDims(d => ({ ...d, [asset.key]: { w, h } })) }}
                        onError={e => e.target.style.display='none'} />
                    : <ImgIcon size={28} style={{ color:'var(--text3)' }} />
                  }
                  <span className={`chip ${typeColors[asset.assetType] || 'chip-blue'}`} style={styles.typeBadge}>
                    {config.assetTypes.find(t => t.id === asset.assetType)?.label || asset.assetType}
                  </span>
                </div>
                <div style={styles.cardBody}>
                  <div style={styles.cardName} title={asset.name}>{asset.name}</div>
                  <div style={styles.cardMeta}>
                    {asset.format?.toUpperCase()} · {(asset.width && asset.height) ? `${asset.width}×${asset.height}` : imgDims[asset.key] ? `${imgDims[asset.key].w}×${imgDims[asset.key].h}` : '—'} · {asset.size ? formatBytes(asset.size) : '—'}
                  </div>
                  {asset.path && <div style={{ fontSize:10, color:'var(--text3)', fontFamily:'var(--mono)', marginBottom:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={asset.path}>{asset.path}</div>}
                  <div style={styles.urlRow} title={asset.url}>
                    <span style={styles.urlText}>{asset.url}</span>
                  </div>
                  <div style={styles.cardActions}>
                    <button style={{ ...styles.actionBtn, ...styles.actionBtnGhost }} onClick={() => setViewAsset(asset)}>
                      View
                    </button>
                    <button
                      style={{ ...styles.actionBtn, ...(copied===asset.key ? styles.actionBtnCopied : styles.actionBtnBlue) }}
                      onClick={() => copyUrl(asset)}
                    >
                      {copied === asset.key ? '✓ Copied' : 'Copy URL'}
                    </button>
                    {asset.source === 'repo'
                      ? <button style={{ ...styles.actionBtn, ...styles.actionBtnAmber }} onClick={() => setReplaceRepoAsset(asset)}>Replace</button>
                      : <>
                        <button style={{ ...styles.actionBtn, ...styles.actionBtnAmber }} onClick={() => setReplaceAsset(asset)}>Replace</button>
                        <button style={{ ...styles.actionBtn, ...styles.actionBtnDanger }} onClick={() => handleDelete(asset)}>×</button>
                      </>
                    }
                  </div>
                </div>
              </div>
            ))}

            {/* Add new card */}
            <div style={styles.addCard} onClick={() => {/* switch to upload tab */}}>
              <span style={{ fontSize:22, color:'var(--text3)', marginBottom:4 }}>+</span>
              <span style={{ fontSize:12, color:'var(--text3)' }}>Upload new asset</span>
            </div>
          </div>
      }

      {/* View modal */}
      {viewAsset && (
        <div style={styles.modalOverlay} onClick={() => setViewAsset(null)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <div style={{ fontSize:15, fontWeight:500 }}>{viewAsset.name}</div>
                <div style={{ fontSize:12, color:'var(--text2)', marginTop:2 }}>
                  {viewAsset.format?.toUpperCase()} · {(viewAsset.width && viewAsset.height) ? `${viewAsset.width}×${viewAsset.height}` : imgDims[viewAsset.key] ? `${imgDims[viewAsset.key].w}×${imgDims[viewAsset.key].h}` : '—'} · {formatBytes(viewAsset.size || 0)}
                </div>
                {viewAsset.path && <div style={{ fontSize:11, fontFamily:'var(--mono)', color:'var(--text3)', marginTop:2 }}>{viewAsset.path}</div>}
              </div>
              <button className="btn-ghost" onClick={() => setViewAsset(null)} style={{ fontSize:18, padding:'4px 10px' }}>×</button>
            </div>
            <div style={styles.modalImg}>
              {viewAsset.url && <img src={viewAsset.url} alt={viewAsset.name} style={{ maxWidth:'100%', maxHeight:400, objectFit:'contain' }} />}
            </div>
            <div style={{ padding:'16px', borderTop:'1px solid var(--border)' }}>
              <div style={{ fontSize:11, fontFamily:'var(--mono)', color:'var(--text2)', background:'var(--bg3)', padding:'8px 12px', borderRadius:'var(--r)', marginBottom:12, wordBreak:'break-all' }}>
                {viewAsset.url}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn-green" onClick={() => { navigator.clipboard.writeText(viewAsset.url); setCopied(viewAsset.key) }}>
                  Copy URL
                </button>
                {viewAsset.url && <button className="btn-secondary" onClick={() => window.open(viewAsset.url, '_blank')}>Open in new tab</button>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Replace modal (CDN) */}
      {replaceAsset && (
        <ReplaceModal
          asset={replaceAsset}
          project={project}
          onClose={() => setReplaceAsset(null)}
          onReplaced={(updated) => {
            setAssets(a => a.map(x => x.key === updated.key ? updated : x))
            setReplaceAsset(null)
          }}
        />
      )}

      {/* Replace modal (Repo) */}
      {replaceRepoAsset && (
        <RepoReplaceModal
          asset={replaceRepoAsset}
          onClose={() => setReplaceRepoAsset(null)}
          onReplaced={(updated) => {
            setRepoAssets(a => a.map(x => x.key === updated.key ? { ...x, sha: updated.sha, url: updated.url } : x))
            setReplaceRepoAsset(null)
          }}
        />
      )}
    </div>
  )
}

function ReplaceModal({ asset, project, onClose, onReplaced }) {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleReplace() {
    if (!file) return
    setUploading(true)
    try {
      const result = await uploadAsset({
        projectSlug: project.slug,
        file,
        name: asset.name,
        assetType: asset.assetType,
        format: asset.format,
        width: asset.width,
        height: asset.height,
      })
      onReplaced({ ...asset, url: result.url, size: result.size })
    } catch (e) {
      setError(e.message)
    }
    setUploading(false)
  }

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={{ ...styles.modal, maxWidth:420 }} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div style={{ fontSize:14, fontWeight:500 }}>Replace — {asset.name}</div>
          <button className="btn-ghost" onClick={onClose} style={{ fontSize:18 }}>×</button>
        </div>
        <div style={{ padding:'20px' }}>
          <p style={{ fontSize:13, color:'var(--text2)', marginBottom:16 }}>
            Upload a new file. It will replace the existing asset at the <strong style={{ color:'var(--text)' }}>same URL</strong> — your live site updates immediately.
          </p>
          <input type="file" accept="image/*" className="input-field" onChange={e => setFile(e.target.files[0])} style={{ marginBottom:12 }} />
          {error && <div style={styles.errorBox}>{error}</div>}
          <div style={{ display:'flex', gap:8, marginTop:8 }}>
            <button className="btn-primary" onClick={handleReplace} disabled={!file || uploading}>
              {uploading ? 'Replacing…' : 'Replace asset'}
            </button>
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function RepoReplaceModal({ asset, onClose, onReplaced }) {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)

  function handleFileChange(e) {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  async function handleReplace() {
    if (!file || !asset.repo || !asset.path) return
    setUploading(true)
    setError('')
    try {
      // We need the current SHA. If asset.sha is from the tree, we need the blob SHA
      // from the contents API for the update to work.
      const existing = await getRepoFile(asset.repo, asset.path)
      const currentSha = existing?.sha

      // Read file as base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          // result is "data:image/png;base64,XXXX" — extract the base64 part
          const b64 = reader.result.split(',')[1]
          resolve(b64)
        }
        reader.onerror = () => reject(new Error('Could not read file'))
        reader.readAsDataURL(file)
      })

      const result = await putRepoFileBinary(
        asset.repo, asset.path, base64,
        `Replace ${asset.name} via AssetHub`,
        currentSha
      )
      // Cache-bust the thumbnail URL
      const newUrl = `https://raw.githubusercontent.com/${asset.repo}/main/${asset.path}?t=${Date.now()}`
      onReplaced({ ...asset, sha: result.content?.sha, url: newUrl })
    } catch (e) {
      setError(e.message || 'Failed to replace image in repo')
    }
    setUploading(false)
  }

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={{ ...styles.modal, maxWidth:480 }} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div style={{ fontSize:14, fontWeight:500 }}>Replace repo image — {asset.name}</div>
          <button className="btn-ghost" onClick={onClose} style={{ fontSize:18 }}>×</button>
        </div>
        <div style={{ padding:'20px' }}>
          <p style={{ fontSize:13, color:'var(--text2)', marginBottom:8 }}>
            This will <strong style={{ color:'var(--text)' }}>commit a new version</strong> of this image directly to your GitHub repo at:
          </p>
          <div style={{ fontSize:11, fontFamily:'var(--mono)', color:'var(--accent)', background:'var(--bg3)', padding:'6px 10px', borderRadius:'var(--r)', marginBottom:12, wordBreak:'break-all' }}>
            {asset.path}
          </div>

          {/* Side-by-side preview */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
            <div>
              <div style={{ fontSize:11, color:'var(--text3)', marginBottom:4 }}>Current</div>
              <div style={{ background:'var(--bg3)', borderRadius:'var(--r)', height:100, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
                <img src={asset.url} alt="current" style={{ maxWidth:'100%', maxHeight:100, objectFit:'contain' }} />
              </div>
            </div>
            <div>
              <div style={{ fontSize:11, color:'var(--text3)', marginBottom:4 }}>New</div>
              <div style={{ background:'var(--bg3)', borderRadius:'var(--r)', height:100, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
                {preview ? <img src={preview} alt="new" style={{ maxWidth:'100%', maxHeight:100, objectFit:'contain' }} /> : <span style={{ fontSize:11, color:'var(--text3)' }}>Pick a file</span>}
              </div>
            </div>
          </div>

          <input type="file" accept="image/*" className="input-field" onChange={handleFileChange} style={{ marginBottom:12 }} />
          {error && <div style={styles.errorBox}>{error}</div>}
          <div style={{ display:'flex', gap:8, marginTop:8 }}>
            <button className="btn-primary" onClick={handleReplace} disabled={!file || uploading}>
              {uploading ? 'Committing…' : 'Replace & commit'}
            </button>
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function timeAgo(iso) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const DEMO_ASSETS = [
  { key:'logo-primary.webp', name:'logo-primary', assetType:'logo', format:'webp', width:200, height:200, size:12400, url:'', uploadedAt: new Date().toISOString() },
  { key:'hero-homepage.webp', name:'hero-homepage', assetType:'hero-banner', format:'webp', width:1920, height:600, size:188000, url:'', uploadedAt: new Date().toISOString() },
  { key:'menu-latte.webp', name:'menu-latte-card', assetType:'menu-item', format:'webp', width:800, height:600, size:67000, url:'', uploadedAt: new Date().toISOString() },
  { key:'bg-texture.webp', name:'bg-texture-warm', assetType:'background', format:'webp', width:1440, height:900, size:220000, url:'', uploadedAt: new Date().toISOString() },
]

const styles = {
  container: { maxWidth:980 },
  header: { marginBottom:20 },
  title: { fontSize:20, fontWeight:500, letterSpacing:'-0.02em' },
  statsRow: { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:20 },
  stat: { background:'var(--bg2)', borderRadius:'var(--r)', border:'1px solid var(--border)', padding:'12px 16px' },
  statLabel: { fontSize:11, color:'var(--text3)', marginBottom:4 },
  statVal: { fontSize:20, fontWeight:500 },
  toolbar: { display:'flex', gap:10, marginBottom:20 },
  grid: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px,1fr))', gap:12 },
  card: { background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--r2)', overflow:'hidden', transition:'border-color .15s' },
  cardImg: { height:130, background:'var(--bg3)', display:'flex', alignItems:'center', justifyContent:'center', position:'relative', cursor:'pointer', overflow:'hidden' },
  thumbImg: { width:'100%', height:'100%', objectFit:'cover' },
  typeBadge: { position:'absolute', top:8, right:8, fontSize:10 },
  cardBody: { padding:'12px' },
  cardName: { fontSize:13, fontWeight:500, marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
  cardMeta: { fontSize:11, color:'var(--text3)', marginBottom:8 },
  urlRow: { fontSize:11, fontFamily:'var(--mono)', color:'var(--text3)', background:'var(--bg3)', padding:'5px 8px', borderRadius:'var(--r)', marginBottom:8, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
  urlText: { display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
  cardActions: { display:'flex', gap:4 },
  actionBtn: { padding:'5px 8px', borderRadius:'var(--r)', border:'1px solid', fontSize:11, fontWeight:500, cursor:'pointer', transition:'background .12s' },
  actionBtnBlue: { borderColor:'rgba(79,127,255,0.3)', background:'var(--accent-dim)', color:'var(--accent)' },
  actionBtnCopied: { borderColor:'rgba(62,207,142,0.3)', background:'var(--green-dim)', color:'var(--green)' },
  actionBtnAmber: { borderColor:'rgba(245,166,35,0.3)', background:'var(--amber-dim)', color:'var(--amber)' },
  actionBtnGhost: { borderColor:'var(--border2)', background:'transparent', color:'var(--text2)' },
  actionBtnDanger: { borderColor:'rgba(255,87,87,0.3)', background:'var(--red-dim)', color:'var(--red)' },
  addCard: {
    background:'transparent', border:'1.5px dashed var(--border2)', borderRadius:'var(--r2)',
    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
    cursor:'pointer', minHeight:200, transition:'border-color .15s',
  },
  errorBox: { fontSize:12, color:'var(--red)', background:'var(--red-dim)', borderRadius:'var(--r)', padding:'8px 12px', marginBottom:8 },
  modalOverlay: {
    position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:100,
    display:'flex', alignItems:'center', justifyContent:'center', padding:20,
  },
  modal: { background:'var(--bg2)', borderRadius:'var(--r2)', border:'1px solid var(--border2)', width:'100%', maxWidth:680, maxHeight:'90vh', overflowY:'auto' },
  modalHeader: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid var(--border)' },
  modalImg: { padding:'20px', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg3)', minHeight:200 },
}

function ImgIcon({ size=16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
}
