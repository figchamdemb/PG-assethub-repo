import { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth.jsx'
import { listProjects, createProject, deleteProject } from '../lib/storage.js'
import UploadTab from './UploadTab.jsx'
import AssetsTab from './AssetsTab.jsx'
import ContentTab from './ContentTab.jsx'

const NAV = [
  { id: 'upload', label: 'Upload', icon: UploadIcon },
  { id: 'assets', label: 'Browse assets', icon: GridIcon },
  { id: 'content', label: 'Content editor', icon: EditIcon },
]

export default function Dashboard() {
  const { user, logout } = useAuth()
  const [tab, setTab] = useState('upload')
  const [projects, setProjects] = useState([])
  const [activeProject, setActiveProject] = useState(null)
  const [newProjectName, setNewProjectName] = useState('')
  const [showNewProject, setShowNewProject] = useState(false)
  const [loadingProjects, setLoadingProjects] = useState(true)

  useEffect(() => {
    loadProjects()
  }, [])

  async function loadProjects() {
    setLoadingProjects(true)
    try {
      const list = await listProjects()
      setProjects(list)
      if (list.length > 0 && !activeProject) setActiveProject(list[0])
    } catch {
      // Use demo projects if worker not configured yet
      const demo = [
        { name: 'barista-cafe.com', slug: 'barista-cafe', createdAt: new Date().toISOString() },
        { name: 'hotel-marlow.com', slug: 'hotel-marlow', createdAt: new Date().toISOString() },
      ]
      setProjects(demo)
      setActiveProject(demo[0])
    }
    setLoadingProjects(false)
  }

  async function handleCreateProject(e) {
    e.preventDefault()
    if (!newProjectName.trim()) return
    const proj = await createProject(newProjectName.trim())
    setProjects(p => [...p, proj])
    setActiveProject(proj)
    setNewProjectName('')
    setShowNewProject(false)
  }

  async function handleDeleteProject(proj) {
    if (!confirm(`Delete project "${proj.name}" and all its assets?`)) return
    await deleteProject(proj.slug)
    const updated = projects.filter(p => p.slug !== proj.slug)
    setProjects(updated)
    if (activeProject?.slug === proj.slug) setActiveProject(updated[0] || null)
  }

  const initials = user?.name?.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() || 'U'

  return (
    <div style={styles.shell}>
      {/* Topbar */}
      <header style={styles.topbar}>
        <div style={styles.topLogo}>
          <span style={{ color:'var(--accent)' }}>Asset</span>Hub
        </div>
        <nav style={styles.topNav}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setTab(n.id)} style={{
              ...styles.navBtn, ...(tab === n.id ? styles.navBtnActive : {})
            }}>
              <n.icon size={14} />
              {n.label}
            </button>
          ))}
        </nav>
        <div style={styles.topRight}>
          <div style={styles.avatar} title={user?.email}>{initials}</div>
          <span style={{ fontSize:12, color:'var(--text2)' }}>{user?.email}</span>
          <button className="btn-ghost" onClick={logout} style={{ fontSize:12, padding:'5px 10px' }}>Sign out</button>
        </div>
      </header>

      <div style={styles.body}>
        {/* Sidebar */}
        <aside style={styles.sidebar}>
          <div style={styles.sidebarSection}>
            <span className="label">Projects</span>
            {loadingProjects
              ? <div style={{ fontSize:12, color:'var(--text3)', padding:'8px 0' }}>Loading…</div>
              : projects.map(proj => (
                <div key={proj.slug} style={{
                  ...styles.projItem, ...(activeProject?.slug === proj.slug ? styles.projItemActive : {})
                }}>
                  <button onClick={() => setActiveProject(proj)} style={styles.projBtn}>
                    <FolderIcon size={13} />
                    <span style={{ flex:1, textAlign:'left', fontSize:13 }}>{proj.name}</span>
                  </button>
                  <button onClick={() => handleDeleteProject(proj)} style={styles.projDel} title="Delete project">×</button>
                </div>
              ))
            }
            {showNewProject
              ? <form onSubmit={handleCreateProject} style={{ marginTop:8 }}>
                  <input
                    className="input-field"
                    autoFocus
                    placeholder="e.g. barista-cafe.com"
                    value={newProjectName}
                    onChange={e => setNewProjectName(e.target.value)}
                    style={{ fontSize:12, padding:'7px 10px', marginBottom:6 }}
                  />
                  <div style={{ display:'flex', gap:6 }}>
                    <button type="submit" className="btn-primary" style={{ fontSize:12, padding:'5px 12px', flex:1, justifyContent:'center' }}>Create</button>
                    <button type="button" className="btn-secondary" onClick={() => setShowNewProject(false)} style={{ fontSize:12, padding:'5px 10px' }}>Cancel</button>
                  </div>
                </form>
              : <button onClick={() => setShowNewProject(true)} style={styles.newProjBtn}>
                  <PlusIcon size={12} />
                  New project
                </button>
            }
          </div>

          {activeProject && (
            <div style={{ ...styles.sidebarSection, marginTop:8 }}>
              <span className="label">Active project</span>
              <div style={styles.projectInfo}>
                <div style={{ fontSize:13, fontWeight:500, color:'var(--text)', marginBottom:2 }}>{activeProject.name}</div>
                <div style={{ fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)' }}>{activeProject.slug}</div>
              </div>
            </div>
          )}
        </aside>

        {/* Main content */}
        <main style={styles.main}>
          {!activeProject
            ? <EmptyState onNew={() => setShowNewProject(true)} />
            : tab === 'upload'
            ? <UploadTab project={activeProject} />
            : tab === 'assets'
            ? <AssetsTab project={activeProject} />
            : <ContentTab project={activeProject} />
          }
        </main>
      </div>
    </div>
  )
}

function EmptyState({ onNew }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:16 }}>
      <div style={{ fontSize:13, color:'var(--text2)' }}>No project selected</div>
      <button className="btn-primary" onClick={onNew}><PlusIcon size={13} /> Create your first project</button>
    </div>
  )
}

const styles = {
  shell: { display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden' },
  topbar: {
    display:'flex', alignItems:'center', gap:20, padding:'0 20px',
    height:52, borderBottom:'1px solid var(--border)',
    background:'var(--bg2)', flexShrink:0,
  },
  topLogo: { fontSize:16, fontWeight:600, letterSpacing:'-0.02em', color:'var(--text)', marginRight:8 },
  topNav: { display:'flex', gap:2, flex:1 },
  navBtn: {
    display:'flex', alignItems:'center', gap:6,
    padding:'6px 12px', borderRadius:'var(--r)', fontSize:13,
    color:'var(--text2)', transition:'background .12s, color .12s', border:'none', background:'none',
  },
  navBtnActive: { background:'var(--bg3)', color:'var(--text)', fontWeight:500 },
  topRight: { display:'flex', alignItems:'center', gap:10 },
  avatar: {
    width:28, height:28, borderRadius:'50%',
    background:'var(--accent-dim)', color:'var(--accent)',
    display:'flex', alignItems:'center', justifyContent:'center',
    fontSize:11, fontWeight:600,
  },
  body: { display:'flex', flex:1, overflow:'hidden' },
  sidebar: {
    width:220, borderRight:'1px solid var(--border)',
    background:'var(--bg2)', padding:'16px 12px',
    overflowY:'auto', flexShrink:0,
  },
  sidebarSection: { marginBottom:8 },
  projItem: {
    display:'flex', alignItems:'center',
    borderRadius:'var(--r)', marginBottom:1,
    transition:'background .12s',
  },
  projItemActive: { background:'var(--accent-dim)' },
  projBtn: {
    display:'flex', alignItems:'center', gap:7, flex:1,
    padding:'7px 8px', color:'var(--text2)', fontSize:13,
    background:'none', border:'none', cursor:'pointer', borderRadius:'var(--r)',
  },
  projDel: {
    padding:'4px 6px', color:'var(--text3)', fontSize:15,
    background:'none', border:'none', cursor:'pointer', borderRadius:'var(--r)',
    opacity:0, transition:'opacity .12s',
    ':hover': { opacity:1 }
  },
  newProjBtn: {
    display:'flex', alignItems:'center', gap:6,
    width:'100%', padding:'7px 8px', marginTop:4,
    fontSize:12, color:'var(--text3)', borderRadius:'var(--r)',
    border:'1px dashed var(--border2)', background:'none', cursor:'pointer',
    transition:'background .12s, color .12s',
  },
  projectInfo: {
    padding:'10px 10px', background:'var(--bg3)',
    borderRadius:'var(--r)', border:'1px solid var(--border)',
  },
  main: { flex:1, overflowY:'auto', padding:'24px' },
}

// SVG icons
function UploadIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
}
function GridIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
}
function EditIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
}
function FolderIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
}
function PlusIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
}
