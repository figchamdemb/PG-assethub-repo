// ============================================================
// AssetHub Cloudflare Worker
// Deploy this at: workers.cloudflare.com
// Bind an R2 bucket named BUCKET in your Worker settings
// ============================================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id, X-User-Email',
}

// ── Plan Definitions (keep in sync with src/lib/plans.js) ──
const PLANS = {
  free:   { id:'free',   projects:1,  storageMb:100,    contentPushes:10  },
  pro:    { id:'pro',    projects:5,  storageMb:5120,   contentPushes:-1  },
  agency: { id:'agency', projects:-1, storageMb:51200,  contentPushes:-1  },
  admin:  { id:'admin',  projects:-1, storageMb:51200,  contentPushes:-1  },
}

// ── Helpers ─────────────────────────────────────────────────

function safeUserId(rawId) {
  return (rawId || 'anonymous').replace(/[^a-zA-Z0-9@._-]/g, '_')
}

async function getUserPlan(env, userId) {
  const key = `_meta/users/${safeUserId(userId)}.json`
  const obj = await env.BUCKET.get(key)
  if (!obj) {
    return {
      id: userId,
      plan: 'free',
      storageUsed: 0,
      projectCount: 0,
      contentPushCount: 0,
      contentPushResetAt: getNextMonthReset(),
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }
  return JSON.parse(await obj.text())
}

async function saveUserPlan(env, userId, data) {
  const key = `_meta/users/${safeUserId(userId)}.json`
  data.updatedAt = new Date().toISOString()
  await env.BUCKET.put(key, JSON.stringify(data), {
    httpMetadata: { contentType: 'application/json' },
  })
}

function getNextMonthReset() {
  const d = new Date()
  d.setMonth(d.getMonth() + 1, 1)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function getPlanLimits(planId) {
  return PLANS[planId] || PLANS.free
}

async function stripeAPI(env, endpoint, params) {
  const body = new URLSearchParams(params).toString()
  const res = await fetch(`https://api.stripe.com/v1${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })
  return res.json()
}

async function stripeGET(env, endpoint) {
  const res = await fetch(`https://api.stripe.com/v1${endpoint}`, {
    headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}` },
  })
  return res.json()
}

async function verifyStripeSignature(payload, sigHeader, secret) {
  const pairs = sigHeader.split(',')
  const tsPair = pairs.find(p => p.startsWith('t='))
  const sigPair = pairs.find(p => p.startsWith('v1='))
  if (!tsPair || !sigPair) return false
  const timestamp = tsPair.slice(2)
  const signature = sigPair.slice(3)
  const signedPayload = `${timestamp}.${payload}`
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload))
  const expected = [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, '0')).join('')
  if (expected.length !== signature.length) return false
  let result = 0
  for (let i = 0; i < expected.length; i++) {
    result |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  }
  const age = Math.floor(Date.now() / 1000) - parseInt(timestamp)
  if (age > 300) return false
  return result === 0
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
      const userId = request.headers.get('X-User-Id')
      const project = await request.json()
      const obj = await env.BUCKET.get('_meta/projects.json')
      const list = obj ? JSON.parse(await obj.text()) : []
      if (list.find(p => p.slug === project.slug)) {
        return err('Project already exists')
      }

      // Plan enforcement: check project limit
      if (userId) {
        const userPlan = await getUserPlan(env, userId)
        const limits = getPlanLimits(userPlan.plan)
        if (limits.projects !== -1 && userPlan.projectCount >= limits.projects) {
          return err(`Project limit reached (${limits.projects}). Upgrade your plan.`, 403)
        }
        userPlan.projectCount = (userPlan.projectCount || 0) + 1
        await saveUserPlan(env, userId, userPlan)
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
      const userId = formData.get('userId') || request.headers.get('X-User-Id')
      const name = formData.get('name') || file.name.replace(/\.[^.]+$/, '')
      const assetType = formData.get('assetType') || 'other'
      const format = formData.get('format') || 'webp'
      const width = parseInt(formData.get('width') || '0')
      const height = parseInt(formData.get('height') || '0')

      if (!file || !project) return err('Missing file or project')

      // Plan enforcement: check storage limit
      if (userId) {
        const userPlan = await getUserPlan(env, userId)
        const limits = getPlanLimits(userPlan.plan)
        const fileSizeMb = file.size / (1024 * 1024)
        const currentMb = (userPlan.storageUsed || 0) / (1024 * 1024)
        if (currentMb + fileSizeMb > limits.storageMb) {
          return err(`Storage limit reached (${limits.storageMb} MB). Upgrade your plan.`, 403)
        }
      }

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

      // Update user storage usage
      if (userId) {
        const userPlan = await getUserPlan(env, userId)
        userPlan.storageUsed = (userPlan.storageUsed || 0) + bytes.byteLength
        await saveUserPlan(env, userId, userPlan)
      }

      return json({ url: publicUrl, key, size: bytes.byteLength })
    }

    // ── GET /user/plan ─────────────────────────────────────────
    if (request.method === 'GET' && path === '/user/plan') {
      const userId = request.headers.get('X-User-Id')
      if (!userId) return err('Missing X-User-Id header')
      const userPlan = await getUserPlan(env, userId)
      // Auto-reset content push counter monthly
      if (userPlan.contentPushResetAt && new Date() >= new Date(userPlan.contentPushResetAt)) {
        userPlan.contentPushCount = 0
        userPlan.contentPushResetAt = getNextMonthReset()
        await saveUserPlan(env, userId, userPlan)
      }
      return json({ ...userPlan, limits: getPlanLimits(userPlan.plan) })
    }

    // ── POST /user/content-push ── increment push counter ──────
    if (request.method === 'POST' && path === '/user/content-push') {
      const userId = request.headers.get('X-User-Id')
      if (!userId) return err('Missing X-User-Id header')
      const userPlan = await getUserPlan(env, userId)
      const limits = getPlanLimits(userPlan.plan)
      // Auto-reset monthly
      if (userPlan.contentPushResetAt && new Date() >= new Date(userPlan.contentPushResetAt)) {
        userPlan.contentPushCount = 0
        userPlan.contentPushResetAt = getNextMonthReset()
      }
      if (limits.contentPushes !== -1 && userPlan.contentPushCount >= limits.contentPushes) {
        return err(`Content push limit reached (${limits.contentPushes}/month). Upgrade your plan.`, 403)
      }
      userPlan.contentPushCount = (userPlan.contentPushCount || 0) + 1
      await saveUserPlan(env, userId, userPlan)
      return json({ contentPushCount: userPlan.contentPushCount, limit: limits.contentPushes })
    }

    // ── POST /stripe/setup ── create products & prices ─────────
    if (request.method === 'POST' && path === '/stripe/setup') {
      if (!env.STRIPE_SECRET_KEY) return err('STRIPE_SECRET_KEY not configured', 500)
      const adminKey = request.headers.get('X-Admin-Key')
      if (adminKey !== env.ADMIN_SECRET) return err('Unauthorized', 401)

      // Create Pro product + price
      const proProd = await stripeAPI(env, '/products', { name: 'AssetHub Pro', description: '5 projects, 5 GB storage, 5 repos, 3 team members' })
      const proPrice = await stripeAPI(env, '/prices', {
        product: proProd.id, currency: 'usd', unit_amount: '900',
        'recurring[interval]': 'month',
      })

      // Create Agency product + price
      const agencyProd = await stripeAPI(env, '/products', { name: 'AssetHub Agency', description: 'Unlimited projects, 50 GB storage, unlimited repos, 10 team members' })
      const agencyPrice = await stripeAPI(env, '/prices', {
        product: agencyProd.id, currency: 'usd', unit_amount: '2900',
        'recurring[interval]': 'month',
      })

      const config = {
        proPriceId: proPrice.id,
        agencyPriceId: agencyPrice.id,
        proProductId: proProd.id,
        agencyProductId: agencyProd.id,
        createdAt: new Date().toISOString(),
      }
      await env.BUCKET.put('_meta/config/stripe.json', JSON.stringify(config), {
        httpMetadata: { contentType: 'application/json' },
      })
      return json(config)
    }

    // ── GET /stripe/config ── get price IDs for frontend ───────
    if (request.method === 'GET' && path === '/stripe/config') {
      const obj = await env.BUCKET.get('_meta/config/stripe.json')
      if (!obj) return err('Stripe not set up. Call POST /stripe/setup first.', 404)
      return json(JSON.parse(await obj.text()))
    }

    // ── POST /stripe/checkout ── create checkout session ───────
    if (request.method === 'POST' && path === '/stripe/checkout') {
      if (!env.STRIPE_SECRET_KEY) return err('STRIPE_SECRET_KEY not configured', 500)
      const { planId, userId, email } = await request.json()
      if (!planId || !userId) return err('Missing planId or userId')

      // Get price ID from config
      const cfgObj = await env.BUCKET.get('_meta/config/stripe.json')
      if (!cfgObj) return err('Stripe not configured', 500)
      const cfg = JSON.parse(await cfgObj.text())
      const priceId = planId === 'pro' ? cfg.proPriceId : planId === 'agency' ? cfg.agencyPriceId : null
      if (!priceId) return err('Invalid plan')

      const appUrl = env.APP_URL || 'https://assethub-9pf.pages.dev'

      // Check if user already has a Stripe customer
      const userPlan = await getUserPlan(env, userId)
      const params = {
        mode: 'subscription',
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': '1',
        success_url: `${appUrl}/pricing?success=true`,
        cancel_url: `${appUrl}/pricing?canceled=true`,
        'metadata[user_id]': userId,
        'metadata[plan_id]': planId,
      }
      if (userPlan.stripeCustomerId) {
        params.customer = userPlan.stripeCustomerId
      } else if (email) {
        params.customer_email = email
      }

      const session = await stripeAPI(env, '/checkout/sessions', params)
      if (session.error) return err(session.error.message, 400)
      return json({ url: session.url })
    }

    // ── POST /stripe/portal ── customer billing portal ─────────
    if (request.method === 'POST' && path === '/stripe/portal') {
      if (!env.STRIPE_SECRET_KEY) return err('STRIPE_SECRET_KEY not configured', 500)
      const userId = request.headers.get('X-User-Id')
      if (!userId) return err('Missing X-User-Id header')

      const userPlan = await getUserPlan(env, userId)
      if (!userPlan.stripeCustomerId) return err('No billing account found', 404)

      const appUrl = env.APP_URL || 'https://assethub-9pf.pages.dev'
      const session = await stripeAPI(env, '/billing_portal/sessions', {
        customer: userPlan.stripeCustomerId,
        return_url: `${appUrl}/pricing`,
      })
      if (session.error) return err(session.error.message, 400)
      return json({ url: session.url })
    }

    // ── POST /stripe/webhook ── handle Stripe events ───────────
    if (request.method === 'POST' && path === '/stripe/webhook') {
      const payload = await request.text()
      const sig = request.headers.get('Stripe-Signature')
      if (!sig || !env.STRIPE_WEBHOOK_SECRET) return err('Missing signature', 401)

      const valid = await verifyStripeSignature(payload, sig, env.STRIPE_WEBHOOK_SECRET)
      if (!valid) return err('Invalid signature', 401)

      const event = JSON.parse(payload)

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object
        const userId = session.metadata?.user_id
        const planId = session.metadata?.plan_id
        if (userId && planId) {
          const userPlan = await getUserPlan(env, userId)
          userPlan.plan = planId
          userPlan.stripeCustomerId = session.customer
          userPlan.stripeSubscriptionId = session.subscription
          await saveUserPlan(env, userId, userPlan)
        }
      }

      if (event.type === 'customer.subscription.updated') {
        const sub = event.data.object
        // Find user by stripe customer ID
        const customerId = sub.customer
        // We need to look up user by customer ID — scan approach for small user base
        // For scale, you'd use a KV index. For now, metadata works.
        if (sub.status === 'active') {
          // Subscription renewed or changed — already handled by checkout
        }
      }

      if (event.type === 'customer.subscription.deleted') {
        const sub = event.data.object
        // Downgrade to free — find user by customer ID in sub metadata
        // For now, we rely on checkout.session metadata having userId
        // In production, maintain a customerId→userId index
      }

      if (event.type === 'invoice.payment_failed') {
        // Could send notification or downgrade after grace period
      }

      return json({ received: true })
    }

    // ── POST /admin/set-role ── set user role (admin only) ─────
    if (request.method === 'POST' && path === '/admin/set-role') {
      const adminKey = request.headers.get('X-Admin-Key')
      if (adminKey !== env.ADMIN_SECRET) return err('Unauthorized', 401)
      const { targetUserId, plan } = await request.json()
      if (!targetUserId || !plan) return err('Missing targetUserId or plan')
      if (!PLANS[plan]) return err('Invalid plan')
      const userPlan = await getUserPlan(env, targetUserId)
      userPlan.plan = plan
      await saveUserPlan(env, targetUserId, userPlan)
      return json({ userId: targetUserId, plan })
    }

    // ── POST /admin/redeem ── redeem admin/free coupon ──────────
    if (request.method === 'POST' && path === '/admin/redeem') {
      const { code, userId } = await request.json()
      if (!code || !userId) return err('Missing code or userId')

      // Load coupon codes from R2 config
      const codesObj = await env.BUCKET.get('_meta/config/coupons.json')
      const coupons = codesObj ? JSON.parse(await codesObj.text()) : []
      const coupon = coupons.find(c => c.code === code && c.active)
      if (!coupon) return err('Invalid or expired coupon code', 404)

      // Check uses
      if (coupon.maxUses !== -1 && (coupon.uses || 0) >= coupon.maxUses) {
        return err('Coupon has been fully redeemed', 400)
      }

      const userPlan = await getUserPlan(env, userId)
      userPlan.plan = coupon.plan
      userPlan.couponCode = code
      await saveUserPlan(env, userId, userPlan)

      // Increment usage
      coupon.uses = (coupon.uses || 0) + 1
      await env.BUCKET.put('_meta/config/coupons.json', JSON.stringify(coupons), {
        httpMetadata: { contentType: 'application/json' },
      })

      return json({ plan: coupon.plan, message: `Upgraded to ${coupon.plan}` })
    }

    // ── POST /admin/coupons ── create coupon (admin only) ───────
    if (request.method === 'POST' && path === '/admin/coupons') {
      const adminKey = request.headers.get('X-Admin-Key')
      if (adminKey !== env.ADMIN_SECRET) return err('Unauthorized', 401)
      const { code, plan, maxUses, expiresAt } = await request.json()
      if (!code || !plan) return err('Missing code or plan')
      if (!PLANS[plan]) return err('Invalid plan')

      const codesObj = await env.BUCKET.get('_meta/config/coupons.json')
      const coupons = codesObj ? JSON.parse(await codesObj.text()) : []
      if (coupons.find(c => c.code === code)) return err('Coupon code already exists')

      coupons.push({
        code, plan, maxUses: maxUses || -1, uses: 0, active: true,
        expiresAt: expiresAt || null, createdAt: new Date().toISOString(),
      })
      await env.BUCKET.put('_meta/config/coupons.json', JSON.stringify(coupons), {
        httpMetadata: { contentType: 'application/json' },
      })
      return json({ code, plan, maxUses: maxUses || -1 })
    }

    // ── GET /admin/users ── list all users (admin only) ─────────
    if (request.method === 'GET' && path === '/admin/users') {
      const adminKey = request.headers.get('X-Admin-Key') || url.searchParams.get('key')
      if (adminKey !== env.ADMIN_SECRET) return err('Unauthorized', 401)

      const listed = await env.BUCKET.list({ prefix: '_meta/users/' })
      const users = []
      for (const obj of listed.objects) {
        const data = await env.BUCKET.get(obj.key)
        if (data) users.push(JSON.parse(await data.text()))
      }
      return json(users)
    }

    return err('Not found', 404)
  }
}
