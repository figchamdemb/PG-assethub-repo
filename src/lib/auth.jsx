import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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
    // Cloudflare Access redirects to Google automatically
    // when you visit your Pages URL — no code needed.
    // This button just initiates the flow.
    window.location.href = '/.cloudflare/access/login'
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
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, loginDemo, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
