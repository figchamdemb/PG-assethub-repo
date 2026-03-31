// ============================================================
// AssetHub Plan Definitions
// Shared between frontend and worker (keep in sync with worker/index.js)
// ============================================================

export const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    projects: 1,
    storageMb: 100,
    githubRepos: 1,
    teamMembers: 1,
    contentPushes: 10, // per month
    customDomain: false,
    prioritySupport: false,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 9,
    projects: 5,
    storageMb: 5120, // 5 GB
    githubRepos: 5,
    teamMembers: 3,
    contentPushes: -1, // unlimited
    customDomain: true,
    prioritySupport: false,
  },
  agency: {
    id: 'agency',
    name: 'Agency',
    price: 29,
    projects: -1, // unlimited
    storageMb: 51200, // 50 GB
    githubRepos: -1,
    teamMembers: 10,
    contentPushes: -1,
    customDomain: true,
    prioritySupport: true,
  },
  admin: {
    id: 'admin',
    name: 'Admin',
    price: 0,
    projects: -1,
    storageMb: 51200,
    githubRepos: -1,
    teamMembers: 10,
    contentPushes: -1,
    customDomain: true,
    prioritySupport: true,
  },
}

export function getPlan(planId) {
  return PLANS[planId] || PLANS.free
}

export function formatLimit(val) {
  if (val === -1) return 'Unlimited'
  return String(val)
}

export function formatStorage(mb) {
  if (mb >= 1024) return `${(mb / 1024).toFixed(0)} GB`
  return `${mb} MB`
}
