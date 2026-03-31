import { createContext, useContext, useState, useEffect } from 'react'
import config from '../config.js'
import { setGitHubToken } from './github.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for GitHub OAuth login callback
    const params = new URLSearchParams(window.location.search)
    const ghUserB64 = params.get('github_user')
    const ghToken = params.get('github_token')

    if (ghUserB64 && ghToken) {
      try {
        const ghUser = JSON.parse(atob(ghUserB64))
        setUser(ghUser)
        localStorage.setItem('assethub_user', JSON.stringify(ghUser))
        // Also store the GitHub token so Content Editor is pre-connected
        setGitHubToken(ghToken)
      } catch {}
      // Clean the URL
      window.history.replaceState({}, '', window.location.pathname)
      setLoading(false)
      return
    }

    // Check if we have a stored session
    const stored = localStorage.getItem('assethub_user')
    if (stored) {
      try { setUser(JSON.parse(stored)) } catch {}
    }
    setLoading(false)
  }, [])

  // Login with Google via Cloudflare Access
  // When deployed on Cloudflare Pages with Access enabled,
  // CF injects a JWT in the Cf-Access-Jwt-Assertion header.
  // For the demo we use a simple email/password check.
  const loginWithGoogle = () => {
    window.location.href = '/.cloudflare/access/login'
  }

  const loginWithGitHub = () => {
    const workerUrl = config.workerUrl.replace(/\/$/, '')
    const appUrl = window.location.origin
    window.location.href = `${workerUrl}/auth/github?app_url=${encodeURIComponent(appUrl)}&purpose=login`
  }

  const loginDemo = (email, password) => {
    // Demo login — replace with Cloudflare Access in production
    const DEMO_ACCOUNTS = [
      { email: 'admin@assethub.io', password: 'demo1234', name: 'Admin', role: 'admin' },
      { email: 'client@example.com', password: 'client123', name: 'Client User', role: 'client' },
    ]
    const account = DEMO_ACCOUNTS.find(a => a.email === email && a.password === password)
    if (account) {
      const u = { email: account.email, name: account.name, role: account.role }
      setUser(u)
      localStorage.setItem('assethub_user', JSON.stringify(u))
      return true
    }
    return false
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('assethub_user')
    localStorage.removeItem('assethub_github_token')
  }

  return (
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, loginWithGitHub, loginDemo, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
