import { useState, useEffect } from 'react'
import { useAuth, getUserId } from '../lib/auth.jsx'
import { PLANS, getPlan, formatLimit, formatStorage } from '../lib/plans.js'
import { createCheckoutSession, openBillingPortal, redeemCoupon } from '../lib/storage.js'

const TIERS = ['free', 'pro', 'agency']

export default function PricingPage() {
  const { user, userPlan, refreshPlan } = useAuth()
  const [loading, setLoading] = useState(null) // which plan is loading
  const [couponCode, setCouponCode] = useState('')
  const [couponMsg, setCouponMsg] = useState('')
  const [couponErr, setCouponErr] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === 'true') {
      setSuccessMsg('Payment successful! Your plan has been upgraded.')
      refreshPlan()
      window.history.replaceState({}, '', window.location.pathname)
    }
    if (params.get('canceled') === 'true') {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [refreshPlan])

  const currentPlan = userPlan?.plan || 'free'

  async function handleSubscribe(planId) {
    setLoading(planId)
    try {
      const { url } = await createCheckoutSession(planId)
      window.location.href = url
    } catch (e) {
      alert(e.message)
    }
    setLoading(null)
  }

  async function handleManageBilling() {
    setLoading('portal')
    try {
      const { url } = await openBillingPortal()
      window.location.href = url
    } catch (e) {
      alert(e.message)
    }
    setLoading(null)
  }

  async function handleRedeemCoupon(e) {
    e.preventDefault()
    setCouponMsg('')
    setCouponErr('')
    if (!couponCode.trim()) return
    try {
      const result = await redeemCoupon(couponCode.trim())
      setCouponMsg(result.message || 'Coupon redeemed!')
      setCouponCode('')
      refreshPlan()
    } catch (e) {
      setCouponErr(e.message)
    }
  }

  const storagePct = userPlan
    ? Math.min(100, ((userPlan.storageUsed || 0) / (getPlan(currentPlan).storageMb * 1024 * 1024)) * 100)
    : 0

  return (
    <div style={styles.page}>
      {successMsg && (
        <div style={styles.successBanner}>
          <CheckIcon /> {successMsg}
          <button style={styles.closeBanner} onClick={() => setSuccessMsg('')}>×</button>
        </div>
      )}

      <div style={styles.header}>
        <h1 style={styles.title}>Plans & Pricing</h1>
        <p style={styles.subtitle}>
          Choose the plan that fits your needs. Upgrade or downgrade anytime.
        </p>
      </div>

      {/* Current usage */}
      {userPlan && (
        <div style={styles.usageCard}>
          <div style={styles.usageHeader}>
            <span style={styles.usageTitle}>Current usage</span>
            <span className={`chip chip-${currentPlan === 'admin' ? 'purple' : currentPlan === 'agency' ? 'green' : currentPlan === 'pro' ? 'blue' : 'amber'}`}>
              {getPlan(currentPlan).name}
            </span>
          </div>
          <div style={styles.usageGrid}>
            <UsageStat label="Storage" value={formatBytes(userPlan.storageUsed || 0)} max={formatStorage(getPlan(currentPlan).storageMb)} pct={storagePct} />
            <UsageStat label="Projects" value={userPlan.projectCount || 0} max={formatLimit(getPlan(currentPlan).projects)} />
            <UsageStat label="Content pushes" value={userPlan.contentPushCount || 0} max={`${formatLimit(getPlan(currentPlan).contentPushes)}/mo`} />
          </div>
        </div>
      )}

      {/* Pricing cards */}
      <div style={styles.cards}>
        {TIERS.map(id => {
          const plan = PLANS[id]
          const isCurrent = currentPlan === id || (currentPlan === 'admin' && id === 'agency')
          const isUpgrade = TIERS.indexOf(id) > TIERS.indexOf(currentPlan)
          return (
            <div key={id} style={{ ...styles.card, ...(id === 'pro' ? styles.cardFeatured : {}), ...(isCurrent ? styles.cardCurrent : {}) }}>
              {id === 'pro' && <div style={styles.badge}>Most popular</div>}
              <div style={styles.planName}>{plan.name}</div>
              <div style={styles.price}>
                <span style={styles.priceAmount}>${plan.price}</span>
                <span style={styles.priceUnit}>/month</span>
              </div>
              <ul style={styles.features}>
                <Feature text={`${formatLimit(plan.projects)} project${plan.projects !== 1 ? 's' : ''}`} />
                <Feature text={`${formatStorage(plan.storageMb)} storage`} />
                <Feature text={`${formatLimit(plan.githubRepos)} GitHub repo${plan.githubRepos !== 1 ? 's' : ''}`} />
                <Feature text={`${plan.teamMembers} team member${plan.teamMembers !== 1 ? 's' : ''}`} />
                <Feature text={plan.contentPushes === -1 ? 'Unlimited content pushes' : `${plan.contentPushes} content pushes/mo`} />
                <Feature text={plan.customDomain ? 'Custom domain' : 'No custom domain'} enabled={plan.customDomain} />
                <Feature text={plan.prioritySupport ? 'Priority support' : 'Community support'} enabled={plan.prioritySupport} />
              </ul>
              {isCurrent ? (
                <button className="btn-secondary" style={styles.planBtn} disabled>Current plan</button>
              ) : id === 'free' ? (
                <button className="btn-secondary" style={styles.planBtn} disabled>Free forever</button>
              ) : isUpgrade ? (
                <button className="btn-primary" style={styles.planBtn} onClick={() => handleSubscribe(id)} disabled={loading === id}>
                  {loading === id ? 'Redirecting…' : `Upgrade to ${plan.name}`}
                </button>
              ) : (
                <button className="btn-secondary" style={styles.planBtn} onClick={() => handleSubscribe(id)} disabled={loading === id}>
                  {loading === id ? 'Redirecting…' : `Switch to ${plan.name}`}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Manage billing / Coupon */}
      <div style={styles.bottomRow}>
        {userPlan?.stripeCustomerId && (
          <button className="btn-secondary" onClick={handleManageBilling} disabled={loading === 'portal'} style={{ fontSize: 13 }}>
            {loading === 'portal' ? 'Loading…' : 'Manage billing & invoices'}
          </button>
        )}

        <form onSubmit={handleRedeemCoupon} style={styles.couponForm}>
          <input
            className="input-field"
            placeholder="Coupon code"
            value={couponCode}
            onChange={e => setCouponCode(e.target.value)}
            style={{ width: 180, fontSize: 13 }}
          />
          <button type="submit" className="btn-secondary" style={{ fontSize: 13 }}>Redeem</button>
        </form>
      </div>
      {couponMsg && <p style={styles.couponSuccess}>{couponMsg}</p>}
      {couponErr && <p style={styles.couponError}>{couponErr}</p>}
    </div>
  )
}

function Feature({ text, enabled = true }) {
  return (
    <li style={{ ...styles.feature, opacity: enabled ? 1 : 0.5 }}>
      <span style={{ color: enabled ? 'var(--green)' : 'var(--text3)', marginRight: 8, fontSize: 14 }}>
        {enabled ? '✓' : '—'}
      </span>
      {text}
    </li>
  )
}

function UsageStat({ label, value, max, pct }) {
  return (
    <div style={styles.usageStat}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: 'var(--text2)' }}>{label}</span>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>{value} / {max}</span>
      </div>
      {pct !== undefined && (
        <div style={styles.progressTrack}>
          <div style={{ ...styles.progressBar, width: `${Math.max(1, pct)}%`, background: pct > 90 ? 'var(--red)' : pct > 70 ? 'var(--amber)' : 'var(--accent)' }} />
        </div>
      )}
    </div>
  )
}

function CheckIcon() {
  return <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`
  return `${(bytes / 1073741824).toFixed(2)} GB`
}

const styles = {
  page: { maxWidth: 960, margin: '0 auto' },
  successBanner: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '12px 16px', marginBottom: 24, borderRadius: 'var(--r)',
    background: 'var(--green-dim)', color: 'var(--green)',
    fontSize: 13, fontWeight: 500, border: '1px solid rgba(62,207,142,0.25)',
  },
  closeBanner: { marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--green)', fontSize: 18, cursor: 'pointer' },
  header: { textAlign: 'center', marginBottom: 32 },
  title: { fontSize: 28, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: 8 },
  subtitle: { fontSize: 14, color: 'var(--text2)' },
  usageCard: {
    background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r2)',
    padding: '20px 24px', marginBottom: 32,
  },
  usageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  usageTitle: { fontSize: 14, fontWeight: 500, color: 'var(--text)' },
  usageGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 },
  usageStat: {},
  progressTrack: { height: 4, background: 'var(--bg4)', borderRadius: 2, overflow: 'hidden' },
  progressBar: { height: '100%', borderRadius: 2, transition: 'width 0.3s' },
  cards: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 32 },
  card: {
    background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r2)',
    padding: '28px 24px', display: 'flex', flexDirection: 'column', position: 'relative',
  },
  cardFeatured: { border: '1px solid var(--accent)', boxShadow: '0 0 20px rgba(79,127,255,0.1)' },
  cardCurrent: { border: '1px solid var(--green)' },
  badge: {
    position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
    background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 600,
    padding: '3px 12px', borderRadius: 99, whiteSpace: 'nowrap',
  },
  planName: { fontSize: 18, fontWeight: 600, color: 'var(--text)', marginBottom: 4, marginTop: 8 },
  price: { marginBottom: 20 },
  priceAmount: { fontSize: 36, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' },
  priceUnit: { fontSize: 14, color: 'var(--text3)', marginLeft: 2 },
  features: { listStyle: 'none', padding: 0, flex: 1, marginBottom: 24 },
  feature: { display: 'flex', alignItems: 'center', fontSize: 13, color: 'var(--text2)', padding: '5px 0' },
  planBtn: { width: '100%', justifyContent: 'center', padding: '10px' },
  bottomRow: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 },
  couponForm: { display: 'flex', gap: 8, alignItems: 'center' },
  couponSuccess: { fontSize: 13, color: 'var(--green)', marginTop: 4 },
  couponError: { fontSize: 13, color: 'var(--red)', marginTop: 4 },
}
