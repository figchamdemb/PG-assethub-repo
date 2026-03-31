import { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth.jsx'
import { listProjects, createProject, deleteProject } from '../lib/storage.js'
import { handleOAuthCallback } from '../lib/github.js'
import UploadTab from './UploadTab.jsx'
import AssetsTab from './AssetsTab.jsx'
import ContentTab from './ContentTab.jsx'
import PricingPage from './PricingPage.jsx'

const NAV = [
  { id: 'upload', label: 'Upload', icon: UploadIcon },
  { id: 'assets', label: 'Browse assets', icon: GridIcon },
  { id: 'content', label: 'Content editor', icon: EditIcon },
  { id: 'pricing', label: 'Pricing', icon: CreditCardIcon },
]

export default function Dashboard() {
  const { user, logout, userPlan } = useAuth()
  const [tab, setTab] = useState('upload')
  const [projects, setProjects] = useState([])
  const [activeProject, setActiveProject] = useState(null)
  const [newProjectName, setNewProjectName] = useState('')
  const [showNewProject, setShowNewProject] = useState(false)
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    // Capture GitHub OAuth callback token at top level
    // (user returns here after OAuth, not necessarily on the Content tab)
    const result = handleOAuthCallback()
    if (result?.success) setTab('content')
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
    try {
      const proj = await createProject(newProjectName.trim())
      setProjects(p => [...p, proj])
      setActiveProject(proj)
      setNewProjectName('')
      setShowNewProject(false)
    } catch (err) {
      alert(err.message)
    }
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
    <div className="dash-shell">
      {/* Topbar */}
      <header className="dash-topbar">
        <button className="dash-hamburger" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle sidebar">
          <MenuIcon size={18} />
        </button>
        <div className="dash-logo">
          <span style={{ color:'var(--accent)' }}>Asset</span>Hub
        </div>
        <nav className="dash-nav">
          {NAV.map(n => (
            <button key={n.id} onClick={() => { setTab(n.id); setSidebarOpen(false) }}
              className={`dash-nav-btn ${tab === n.id ? 'active' : ''}`}>
              <n.icon size={14} />
              <span className="dash-nav-label">{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="dash-topright">
          {userPlan && (
            <span className={`chip chip-${userPlan.plan === 'admin' ? 'purple' : userPlan.plan === 'agency' ? 'green' : userPlan.plan === 'pro' ? 'blue' : 'amber'}`}
              style={{ cursor: 'pointer' }} onClick={() => setTab('pricing')}>
              {(userPlan.plan || 'free').toUpperCase()}
            </span>
          )}
          <div className="dash-avatar" title={user?.email}>{initials}</div>
          <span className="dash-email">{user?.email}</span>
          <button className="btn-ghost" onClick={logout} style={{ fontSize:12, padding:'5px 10px' }}>Sign out</button>
        </div>
      </header>

      <div className="dash-body">
        {/* Sidebar overlay for mobile */}
        {sidebarOpen && <div className="dash-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

        {/* Sidebar */}
        <aside className={`dash-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div style={{ marginBottom:8 }}>
            <span className="label">Projects</span>
            {loadingProjects
              ? <div style={{ fontSize:12, color:'var(--text3)', padding:'8px 0' }}>Loading…</div>
              : projects.map(proj => (
                <div key={proj.slug} className={`dash-proj-item ${activeProject?.slug === proj.slug ? 'active' : ''}`}>
                  <button onClick={() => { setActiveProject(proj); setSidebarOpen(false) }} className="dash-proj-btn">
                    <FolderIcon size={13} />
                    <span style={{ flex:1, textAlign:'left', fontSize:13 }}>{proj.name}</span>
                  </button>
                  <button onClick={() => handleDeleteProject(proj)} className="dash-proj-del" title="Delete project">×</button>
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
              : <button onClick={() => setShowNewProject(true)} className="dash-new-proj">
                  <PlusIcon size={12} />
                  New project
                </button>
            }
          </div>

          {activeProject && (
            <div style={{ marginTop:8 }}>
              <span className="label">Active project</span>
              <div className="dash-proj-info">
                <div style={{ fontSize:13, fontWeight:500, color:'var(--text)', marginBottom:2 }}>{activeProject.name}</div>
                <div style={{ fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)' }}>{activeProject.slug}</div>
              </div>
            </div>
          )}
        </aside>

        {/* Main content */}
        <main className="dash-main">
          {!activeProject && tab !== 'pricing'
            ? <EmptyState onNew={() => setShowNewProject(true)} />
            : tab === 'pricing'
            ? <PricingPage />
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
function CreditCardIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
}
function MenuIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
}
