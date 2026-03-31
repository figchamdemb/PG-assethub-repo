// ============================================================
// AssetHub Cloudflare Worker
// Deploy this at: workers.cloudflare.com
// Bind an R2 bucket named BUCKET in your Worker settings
// ============================================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function err(msg, status = 400) {
  return json({ error: msg }, status)
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS })
    }

    const url = new URL(request.url)
    const path = url.pathname

    // ── GET /auth/github ── start OAuth flow ───────────────────
    if (request.method === 'GET' && path === '/auth/github') {
      const clientId = env.GITHUB_CLIENT_ID
      if (!clientId) return err('GITHUB_CLIENT_ID not configured', 500)

      const appUrl = env.APP_URL || url.searchParams.get('app_url') || 'https://assethub-9pf.pages.dev'
      const purpose = url.searchParams.get('purpose') || 'connect' // 'login' or 'connect'
      const workerOrigin = url.origin

      // Random state to prevent CSRF
      const state = crypto.randomUUID()
      const redirectUri = `${workerOrigin}/auth/github/callback`

      // State payload carries: random|appUrl|purpose
      const statePayload = `${state}|${appUrl}|${purpose}`

      // Login needs user:email, connect needs repo access
      const scope = purpose === 'login' ? 'read:user,user:email,repo' : 'repo'

      const ghAuthUrl = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(statePayload)}`

      return new Response(null, {
        status: 302,
        headers: { Location: ghAuthUrl },
      })
    }

    // ── GET /auth/github/callback ── exchange code for token ───
    if (request.method === 'GET' && path === '/auth/github/callback') {
      const code = url.searchParams.get('code')
      const stateParam = url.searchParams.get('state') || ''
      if (!code) return err('Missing code parameter')

      const clientId = env.GITHUB_CLIENT_ID
      const clientSecret = env.GITHUB_CLIENT_SECRET
      if (!clientId || !clientSecret) return err('OAuth not configured', 500)

      // Parse state payload: random|appUrl|purpose
      const parts = stateParam.split('|')
      const appUrl = parts[1]
      const purpose = parts[2] || 'connect'
      const redirectTo = appUrl || env.APP_URL || 'https://assethub-9pf.pages.dev'

      // Exchange code for token
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
        }),
      })

      const tokenData = await tokenRes.json()
      if (tokenData.error) {
        return new Response(null, {
          status: 302,
          headers: { Location: `${redirectTo}?github_error=${encodeURIComponent(tokenData.error_description || tokenData.error)}` },
        })
      }

      const accessToken = tokenData.access_token

      // For login flow: fetch GitHub user profile and redirect with user info + token
      if (purpose === 'login') {
        const userRes = await fetch('https://api.github.com/user', {
          headers: {
            'Authorization': `token ${accessToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'AssetHub',
          },
        })
        const ghUser = await userRes.json()

        // Build minimal user object
        const user = JSON.stringify({
          name: ghUser.name || ghUser.login,
          email: ghUser.email || `${ghUser.login}@github`,
          avatar: ghUser.avatar_url,
          login: ghUser.login,
          provider: 'github',
          role: 'admin',
        })

        const encoded = encodeURIComponent(btoa(user))
        return new Response(null, {
          status: 302,
          headers: { Location: `${redirectTo}/login?github_user=${encoded}&github_token=${encodeURIComponent(accessToken)}` },
        })
      }

      // For connect flow: redirect with token only
      return new Response(null, {
        status: 302,
        headers: { Location: `${redirectTo}?github_token=${encodeURIComponent(accessToken)}` },
      })
    }

    // ── GET /projects ──────────────────────────────────────────
    if (request.method === 'GET' && path === '/projects') {
      const obj = await env.BUCKET.get('_meta/projects.json')
      if (!obj) return json([])
      return json(JSON.parse(await obj.text()))
    }

    // ── POST /projects ─────────────────────────────────────────
    if (request.method === 'POST' && path === '/projects') {
      const project = await request.json()
      const obj = await env.BUCKET.get('_meta/projects.json')
      const list = obj ? JSON.parse(await obj.text()) : []
      if (list.find(p => p.slug === project.slug)) {
        return err('Project already exists')
      }
      list.push(project)
      await env.BUCKET.put('_meta/projects.json', JSON.stringify(list), {
        httpMetadata: { contentType: 'application/json' }
      })
      return json(project)
    }

    // ── DELETE /projects/:slug ─────────────────────────────────
    if (request.method === 'DELETE' && path.startsWith('/projects/')) {
      const slug = path.replace('/projects/', '')
      const obj = await env.BUCKET.get('_meta/projects.json')
      const list = obj ? JSON.parse(await obj.text()) : []
      const updated = list.filter(p => p.slug !== slug)
      await env.BUCKET.put('_meta/projects.json', JSON.stringify(updated), {
        httpMetadata: { contentType: 'application/json' }
      })
      return json({ deleted: slug })
    }

    // ── GET /assets/:project ───────────────────────────────────
    if (request.method === 'GET' && path.startsWith('/assets/')) {
      const parts = path.split('/')
      const projectSlug = parts[2]
      if (!projectSlug) return err('Missing project slug')

      const metaKey = `_meta/${projectSlug}/assets.json`
      const obj = await env.BUCKET.get(metaKey)
      if (!obj) return json([])
      return json(JSON.parse(await obj.text()))
    }

    // ── DELETE /assets/:project/:key ───────────────────────────
    if (request.method === 'DELETE' && path.startsWith('/assets/')) {
      const parts = path.split('/')
      const projectSlug = parts[2]
      const assetKey = decodeURIComponent(parts.slice(3).join('/'))

      await env.BUCKET.delete(assetKey)

      const metaKey = `_meta/${projectSlug}/assets.json`
      const obj = await env.BUCKET.get(metaKey)
      const list = obj ? JSON.parse(await obj.text()) : []
      const updated = list.filter(a => a.key !== assetKey)
      await env.BUCKET.put(metaKey, JSON.stringify(updated), {
        httpMetadata: { contentType: 'application/json' }
      })
      return json({ deleted: assetKey })
    }

    // ── POST /upload ───────────────────────────────────────────
    if (request.method === 'POST' && path === '/upload') {
      const formData = await request.formData()
      const file = formData.get('file')
      const project = formData.get('project')
      const name = formData.get('name') || file.name.replace(/\.[^.]+$/, '')
      const assetType = formData.get('assetType') || 'other'
      const format = formData.get('format') || 'webp'
      const width = parseInt(formData.get('width') || '0')
      const height = parseInt(formData.get('height') || '0')

      if (!file || !project) return err('Missing file or project')

      const safeName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-')
      const key = `${project}/${safeName}.${format}`

      const bytes = await file.arrayBuffer()
      const mimeMap = { webp:'image/webp', png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', svg:'image/svg+xml', mp4:'video/mp4' }

      await env.BUCKET.put(key, bytes, {
        httpMetadata: {
          contentType: mimeMap[format] || file.type || 'application/octet-stream',
          cacheControl: 'public, max-age=31536000',
        },
        customMetadata: { assetType, width: String(width), height: String(height), uploadedAt: new Date().toISOString() }
      })

      // Build public URL - set R2_PUBLIC_URL in your Worker env vars
      const publicBase = env.R2_PUBLIC_URL || `https://pub-REPLACE.r2.dev`
      const publicUrl = `${publicBase}/${key}`

      // Update asset index
      const metaKey = `_meta/${project}/assets.json`
      const existing = await env.BUCKET.get(metaKey)
      const list = existing ? JSON.parse(await existing.text()) : []
      const asset = {
        key, name: safeName, assetType, format, width, height,
        size: bytes.byteLength, url: publicUrl,
        uploadedAt: new Date().toISOString()
      }
      // Replace if same name
      const idx = list.findIndex(a => a.name === safeName)
      if (idx >= 0) list[idx] = asset; else list.unshift(asset)
      await env.BUCKET.put(metaKey, JSON.stringify(list), {
        httpMetadata: { contentType: 'application/json' }
      })

      return json({ url: publicUrl, key, size: bytes.byteLength })
    }

    return err('Not found', 404)
  }
}
