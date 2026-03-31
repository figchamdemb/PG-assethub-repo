import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'

export default function LoginPage() {
  const { user, loginDemo, loginWithGoogle, loginWithGitHub } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')

  // Redirect to dashboard if already authenticated (e.g. after GitHub OAuth callback)
  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const ok = loginDemo(email, password)
    if (ok) navigate('/')
    else { setError('Invalid email or password.'); setLoading(false) }
  }

  return (
    <div style={styles.page}>
      <div style={styles.left}>
        <div style={styles.leftContent}>
          <div style={styles.brand}>AssetHub</div>
          <h1 style={styles.headline}>
            Manage every image,<br />
            banner and icon<br />
            <span style={styles.headlineAccent}>without a backend.</span>
          </h1>
          <p style={styles.tagline}>
            Upload, compress, organise and sync your website assets<br />
            directly to Cloudflare R2. No servers. No cost.
          </p>
          <div style={styles.featureList}>
            {['Compress + resize in browser', 'Permanent R2 URLs', 'GitHub content sync', 'Replace images without changing code'].map(f => (
              <div key={f} style={styles.feature}>
                <span style={styles.featureDot} />
                {f}
              </div>
            ))}
          </div>
        </div>
        <div style={styles.gridBg} />
      </div>

      <div style={styles.right}>
        <div style={styles.loginCard}>
          <div style={styles.loginLogo}>AssetHub</div>
          <p style={styles.loginSub}>Sign in to your workspace</p>

          <button onClick={loginWithGoogle} style={styles.googleBtn}>
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <button onClick={loginWithGitHub} style={styles.githubBtn}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z"/>
            </svg>
            Continue with GitHub
          </button>

          <div style={styles.divider}>
            <div style={styles.dividerLine} />
            <span style={styles.dividerText}>or sign in with email</span>
            <div style={styles.dividerLine} />
          </div>

          <form onSubmit={handleLogin} style={styles.form}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Email address</label>
              <input
                className="input-field"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Password</label>
              <input
                className="input-field"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p style={styles.error}>{error}</p>}
            <button type="submit" className="btn-primary" style={{ width:'100%', justifyContent:'center', padding:'10px' }} disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p style={styles.demoHint}>
            Demo: <code style={styles.code}>admin@assethub.io</code> / <code style={styles.code}>demo1234</code>
          </p>
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: { display:'flex', minHeight:'100vh', background:'var(--bg)' },
  left: {
    flex:1, display:'flex', alignItems:'center', justifyContent:'center',
    padding:'60px', position:'relative', overflow:'hidden',
    borderRight:'1px solid var(--border)',
  },
  gridBg: {
    position:'absolute', inset:0, zIndex:0,
    backgroundImage:`linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)`,
    backgroundSize:'40px 40px',
    maskImage:'radial-gradient(ellipse at center, black 30%, transparent 80%)',
  },
  leftContent: { position:'relative', zIndex:1, maxWidth:440 },
  brand: { fontSize:12, fontWeight:600, letterSpacing:'.15em', textTransform:'uppercase', color:'var(--text3)', marginBottom:32 },
  headline: { fontSize:42, fontWeight:300, lineHeight:1.2, color:'var(--text)', marginBottom:20, letterSpacing:'-0.02em' },
  headlineAccent: { color:'var(--accent)', fontWeight:500 },
  tagline: { fontSize:15, color:'var(--text2)', lineHeight:1.7, marginBottom:32 },
  featureList: { display:'flex', flexDirection:'column', gap:12 },
  feature: { display:'flex', alignItems:'center', gap:10, fontSize:14, color:'var(--text2)' },
  featureDot: { width:6, height:6, borderRadius:'50%', background:'var(--accent)', flexShrink:0 },
  right: { width:440, display:'flex', alignItems:'center', justifyContent:'center', padding:'40px 48px' },
  loginCard: { width:'100%' },
  loginLogo: { fontSize:22, fontWeight:600, color:'var(--text)', marginBottom:6, letterSpacing:'-0.02em' },
  loginSub: { fontSize:14, color:'var(--text2)', marginBottom:28 },
  googleBtn: {
    display:'flex', alignItems:'center', justifyContent:'center', gap:10,
    width:'100%', padding:'10px 16px', borderRadius:'var(--r)',
    background:'var(--bg3)', border:'1px solid var(--border2)',
    color:'var(--text)', fontSize:14, fontWeight:500, cursor:'pointer',
    transition:'background .15s', marginBottom:10,
  },
  githubBtn: {
    display:'flex', alignItems:'center', justifyContent:'center', gap:10,
    width:'100%', padding:'10px 16px', borderRadius:'var(--r)',
    background:'#24292e', border:'1px solid #444',
    color:'#fff', fontSize:14, fontWeight:500, cursor:'pointer',
    transition:'opacity .15s', marginBottom:20,
  },
  divider: { display:'flex', alignItems:'center', gap:12, marginBottom:20 },
  dividerLine: { flex:1, height:1, background:'var(--border)' },
  dividerText: { fontSize:12, color:'var(--text3)', whiteSpace:'nowrap' },
  form: { display:'flex', flexDirection:'column', gap:14 },
  formGroup: { display:'flex', flexDirection:'column', gap:6 },
  label: { fontSize:12, fontWeight:500, color:'var(--text2)' },
  error: { fontSize:13, color:'var(--red)', padding:'8px 12px', background:'var(--red-dim)', borderRadius:'var(--r)' },
  demoHint: { marginTop:20, fontSize:12, color:'var(--text3)', textAlign:'center' },
  code: { fontFamily:'var(--mono)', color:'var(--text2)', background:'var(--bg3)', padding:'1px 5px', borderRadius:4 },
}
