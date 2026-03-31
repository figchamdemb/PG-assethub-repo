import { useState, useRef, useCallback } from 'react'
import { processImage, uploadAsset, formatBytes } from '../lib/storage.js'
import config from '../config.js'

export default function UploadTab({ project }) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [processedFile, setProcessedFile] = useState(null)
  const [processedPreview, setProcessedPreview] = useState(null)
  const [assetName, setAssetName] = useState('')
  const [assetType, setAssetType] = useState('logo')
  const [format, setFormat] = useState('webp')
  const [preset, setPreset] = useState('logo-sm')
  const [customW, setCustomW] = useState(200)
  const [customH, setCustomH] = useState(200)
  const [processing, setProcessing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadedUrl, setUploadedUrl] = useState(null)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef()

  const selectedPreset = config.sizePresets.find(p => p.id === preset)
  const width = preset === 'custom' ? customW : selectedPreset?.w
  const height = preset === 'custom' ? customH : selectedPreset?.h

  const handleFile = (f) => {
    if (!f) return
    setFile(f)
    setProcessedFile(null)
    setProcessedPreview(null)
    setUploadedUrl(null)
    setError('')
    const name = f.name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    setAssetName(name)
    const url = URL.createObjectURL(f)
    setPreview(url)
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f && f.type.startsWith('image/')) handleFile(f)
  }, [])

  const handleProcess = async () => {
    if (!file) return
    setProcessing(true)
    setError('')
    try {
      const out = await processImage(file, width, height, format)
      setProcessedFile(out)
      const url = URL.createObjectURL(out)
      setProcessedPreview(url)
    } catch (e) {
      setError('Processing failed: ' + e.message)
    }
    setProcessing(false)
  }

  const handleDownload = () => {
    if (!processedFile) return
    const a = document.createElement('a')
    a.href = processedPreview
    a.download = `${assetName}.${format}`
    a.click()
  }

  const handleUpload = async () => {
    const uploadFile = processedFile || file
    if (!uploadFile) return
    setUploading(true)
    setError('')
    try {
      const result = await uploadAsset({
        projectSlug: project.slug,
        file: uploadFile,
        name: assetName,
        assetType,
        format,
        width,
        height,
      })
      setUploadedUrl(result.url)
    } catch (e) {
      setError('Upload failed: ' + e.message + '\n(Make sure your Worker is deployed)')
    }
    setUploading(false)
  }

  return (
    <div className="fade-in" style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Upload asset</h2>
        <p style={styles.sub}>Compress, resize and upload to <strong style={{ color:'var(--text)', fontWeight:500 }}>{project.name}</strong> → Cloudflare R2</p>
      </div>

      <div style={styles.grid}>
        {/* Left: file + settings */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Drop zone */}
          <div
            style={{ ...styles.dropZone, ...(dragging ? styles.dropZoneDrag : {}) }}
            onClick={() => fileRef.current.click()}
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
          >
            <input ref={fileRef} type="file" accept="image/*,video/*" style={{ display:'none' }} onChange={e => handleFile(e.target.files[0])} />
            {file
              ? <div style={{ textAlign:'center' }}>
                  <div style={styles.fileChip}>
                    <ImgIcon size={13} />
                    {file.name}
                    <span style={{ color:'var(--text3)' }}>· {formatBytes(file.size)}</span>
                  </div>
                  <p style={{ fontSize:12, color:'var(--text3)', marginTop:6 }}>Click to change file</p>
                </div>
              : <>
                  <div style={styles.dropIcon}><UploadBigIcon /></div>
                  <p style={styles.dropTitle}>Drop image here</p>
                  <p style={styles.dropHint}>PNG · JPG · WebP · SVG · MP4 · or click to browse</p>
                </>
            }
          </div>

          {/* Asset name + type */}
          <div style={styles.row2}>
            <div style={styles.formGroup}>
              <label className="label">Asset name</label>
              <input className="input-field" placeholder="e.g. hero-banner" value={assetName} onChange={e => setAssetName(e.target.value)} />
            </div>
            <div style={styles.formGroup}>
              <label className="label">Output format</label>
              <div style={styles.fmtRow}>
                {['webp','png','jpg','svg'].map(f => (
                  <button key={f} onClick={() => setFormat(f)} style={{ ...styles.fmtBtn, ...(format===f ? styles.fmtBtnActive : {}) }}>
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Asset type */}
          <div>
            <label className="label">Asset type</label>
            <div style={styles.typeGrid}>
              {config.assetTypes.map(t => (
                <button key={t.id} onClick={() => setAssetType(t.id)} style={{
                  ...styles.typeCard, ...(assetType === t.id ? styles.typeCardActive : {})
                }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Size presets */}
          <div>
            <label className="label">Size preset</label>
            <div style={styles.presetGrid}>
              {config.sizePresets.map(p => (
                <button key={p.id} onClick={() => {
                  setPreset(p.id)
                  if (p.w) { setCustomW(p.w); setCustomH(p.h) }
                }} style={{ ...styles.presetCard, ...(preset===p.id ? styles.presetCardActive : {}) }}>
                  <div style={{ fontSize:12, fontWeight:500 }}>{p.label}</div>
                  <div style={{ fontSize:11, opacity:.7, marginTop:1 }}>{p.w ? `${p.w}×${p.h}` : 'custom'}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom dimensions */}
          <div style={styles.row2}>
            <div style={styles.formGroup}>
              <label className="label">Width (px)</label>
              <input className="input-field" type="number" value={customW} onChange={e => { setCustomW(+e.target.value); setPreset('custom') }} />
            </div>
            <div style={styles.formGroup}>
              <label className="label">Height (px)</label>
              <input className="input-field" type="number" value={customH} onChange={e => { setCustomH(+e.target.value); setPreset('custom') }} />
            </div>
          </div>

          {error && <div style={styles.errorBox}>{error}</div>}

          <div style={styles.actionRow}>
            <button className="btn-secondary" onClick={handleProcess} disabled={!file || processing}>
              {processing ? <><span className="spin">↻</span> Processing…</> : '⚙ Compress + resize'}
            </button>
            {processedFile && (
              <button className="btn-ghost" onClick={handleDownload} title="Download compressed file">
                <DownloadIcon size={14} /> Download
              </button>
            )}
            <button className="btn-primary" onClick={handleUpload} disabled={!file || uploading} style={{ marginLeft:'auto' }}>
              {uploading ? <><span className="spin">↻</span> Uploading…</> : <><UploadIcon size={13} /> Upload to R2</>}
            </button>
          </div>
        </div>

        {/* Right: preview */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <label className="label">Preview</label>
          <div style={styles.previewBox}>
            {(processedPreview || preview)
              ? <img src={processedPreview || preview} alt="preview" style={styles.previewImg} />
              : <div style={styles.previewEmpty}><ImgIcon size={24} /><span>No file selected</span></div>
            }
          </div>

          {processedFile && (
            <div style={styles.statsBox}>
              <div style={styles.statRow}>
                <span style={{ color:'var(--text2)' }}>Original</span>
                <span style={{ fontFamily:'var(--mono)', fontSize:12 }}>{formatBytes(file.size)}</span>
              </div>
              <div style={styles.statRow}>
                <span style={{ color:'var(--text2)' }}>Compressed</span>
                <span style={{ fontFamily:'var(--mono)', fontSize:12, color:'var(--green)' }}>{formatBytes(processedFile.size)}</span>
              </div>
              <div style={styles.statRow}>
                <span style={{ color:'var(--text2)' }}>Saved</span>
                <span style={{ fontFamily:'var(--mono)', fontSize:12, color:'var(--green)' }}>
                  {Math.round((1 - processedFile.size / file.size) * 100)}%
                </span>
              </div>
              <div style={styles.statRow}>
                <span style={{ color:'var(--text2)' }}>Dimensions</span>
                <span style={{ fontFamily:'var(--mono)', fontSize:12 }}>{width}×{height}</span>
              </div>
              <div style={styles.statRow}>
                <span style={{ color:'var(--text2)' }}>Format</span>
                <span style={{ fontFamily:'var(--mono)', fontSize:12, textTransform:'uppercase' }}>{format}</span>
              </div>
            </div>
          )}

          {uploadedUrl && (
            <div style={styles.successBox}>
              <div style={{ fontSize:13, fontWeight:500, color:'var(--green)', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
                <CheckIcon size={14} /> Uploaded successfully
              </div>
              <div style={styles.urlBox}>{uploadedUrl}</div>
              <div style={{ display:'flex', gap:8, marginTop:8 }}>
                <button className="btn-green" onClick={() => navigator.clipboard.writeText(uploadedUrl)} style={{ fontSize:12 }}>
                  Copy URL
                </button>
                <button className="btn-secondary" onClick={() => window.open(uploadedUrl, '_blank')} style={{ fontSize:12 }}>
                  View
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const styles = {
  container: { maxWidth:980 },
  header: { marginBottom:24 },
  title: { fontSize:20, fontWeight:500, letterSpacing:'-0.02em', marginBottom:4 },
  sub: { fontSize:13, color:'var(--text2)' },
  grid: { display:'grid', gridTemplateColumns:'1fr 320px', gap:24 },
  dropZone: {
    border:'1.5px dashed var(--border2)', borderRadius:'var(--r2)',
    padding:'36px 24px', textAlign:'center', cursor:'pointer',
    background:'var(--bg2)', transition:'border-color .15s, background .15s',
  },
  dropZoneDrag: { borderColor:'var(--accent)', background:'var(--accent-dim)' },
  dropIcon: { width:44, height:44, borderRadius:'50%', background:'var(--bg3)', border:'1px solid var(--border2)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' },
  dropTitle: { fontSize:14, fontWeight:500, marginBottom:4 },
  dropHint: { fontSize:12, color:'var(--text3)' },
  fileChip: { display:'inline-flex', alignItems:'center', gap:6, fontSize:13, background:'var(--bg3)', padding:'6px 12px', borderRadius:'var(--r)', border:'1px solid var(--border2)', color:'var(--text)' },
  row2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 },
  formGroup: { display:'flex', flexDirection:'column', gap:6 },
  fmtRow: { display:'flex', gap:4 },
  fmtBtn: { flex:1, padding:'7px 4px', borderRadius:'var(--r)', border:'1px solid var(--border2)', background:'var(--bg3)', color:'var(--text2)', fontSize:11, fontWeight:500, cursor:'pointer', transition:'all .12s' },
  fmtBtnActive: { background:'var(--amber-dim)', borderColor:'rgba(245,166,35,0.4)', color:'var(--amber)' },
  typeGrid: { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6 },
  typeCard: { padding:'8px 4px', borderRadius:'var(--r)', border:'1px solid var(--border)', background:'var(--bg2)', fontSize:12, color:'var(--text2)', cursor:'pointer', transition:'all .12s', textAlign:'center' },
  typeCardActive: { background:'var(--accent-dim)', borderColor:'rgba(79,127,255,0.35)', color:'var(--accent)', fontWeight:500 },
  presetGrid: { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 },
  presetCard: { padding:'8px 6px', borderRadius:'var(--r)', border:'1px solid var(--border)', background:'var(--bg2)', cursor:'pointer', transition:'all .12s', textAlign:'center' },
  presetCardActive: { background:'var(--green-dim)', borderColor:'rgba(62,207,142,0.35)', color:'var(--green)' },
  actionRow: { display:'flex', gap:8, alignItems:'center', paddingTop:4 },
  errorBox: { fontSize:12, color:'var(--red)', background:'var(--red-dim)', borderRadius:'var(--r)', padding:'10px 12px', border:'1px solid rgba(255,87,87,0.2)', whiteSpace:'pre-wrap' },
  previewBox: { flex:1, background:'var(--bg2)', borderRadius:'var(--r2)', border:'1px solid var(--border)', overflow:'hidden', minHeight:200, display:'flex', alignItems:'center', justifyContent:'center' },
  previewEmpty: { display:'flex', flexDirection:'column', alignItems:'center', gap:8, color:'var(--text3)', fontSize:13 },
  previewImg: { width:'100%', height:'100%', objectFit:'contain', maxHeight:280 },
  statsBox: { background:'var(--bg2)', borderRadius:'var(--r)', border:'1px solid var(--border)', padding:'12px 14px', display:'flex', flexDirection:'column', gap:8 },
  statRow: { display:'flex', justifyContent:'space-between', fontSize:13 },
  successBox: { background:'rgba(62,207,142,0.06)', borderRadius:'var(--r)', border:'1px solid rgba(62,207,142,0.25)', padding:'14px' },
  urlBox: { fontSize:11, fontFamily:'var(--mono)', color:'var(--text2)', background:'var(--bg3)', padding:'6px 8px', borderRadius:'var(--r)', wordBreak:'break-all' },
}

function UploadBigIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
}
function UploadIcon({ size=16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
}
function ImgIcon({ size=16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
}
function DownloadIcon({ size=16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
}
function CheckIcon({ size=16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
}
