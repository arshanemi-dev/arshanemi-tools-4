import { NextResponse } from 'next/server'
import { getAuthPayload } from '@/lib/auth'
import { dummySubscription, dummyPlans } from '@/data/dummySubscription'

// ── Helpers ──────────────────────────────────────────────────────────────────

function razorpay() {
  const keyId     = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) return null
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
  return {
    async get(path) {
      const r = await fetch(`https://api.razorpay.com/v1${path}`, {
        headers: { Authorization: `Basic ${auth}` },
      })
      return r.ok ? r.json() : null
    },
    async post(path, body) {
      const r = await fetch(`https://api.razorpay.com/v1${path}`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.description ?? `Razorpay error ${r.status}`)
      }
      return r.json()
    },
  }
}

async function getSubscriptionFromDB(userId) {
  try {
    const { getSingleton } = await import('@/lib/db')
    const data = await getSingleton(`subscription_${userId}`)
    return data ?? null
  } catch {
    return null
  }
}

async function saveSubscriptionToDB(userId, data) {
  try {
    const { updateSingleton } = await import('@/lib/db')
    await updateSingleton(`subscription_${userId}`, data)
  } catch {
    // DB unavailable — no persistence
  }
}

// ── GET /api/admin/subscription ──────────────────────────────────────────────

export async function GET(req) {
  const payload = await getAuthPayload(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Try to get saved subscription from DB
  const saved = await getSubscriptionFromDB(payload.userId)
  if (saved) {
    // If we have a live Razorpay subscription ID, refresh status from Razorpay
    if (saved.razorpaySubscriptionId) {
      const rz = razorpay()
      if (rz) {
        const live = await rz.get(`/subscriptions/${saved.razorpaySubscriptionId}`)
        if (live) {
          const updated = {
            ...saved,
            status:              mapRazorpayStatus(live.status),
            currentPeriodEnd:    live.current_end   ? new Date(live.current_end * 1000).toISOString()   : saved.currentPeriodEnd,
            currentPeriodStart:  live.current_start ? new Date(live.current_start * 1000).toISOString() : saved.currentPeriodStart,
            cancelAtPeriodEnd:   live.cancel_at_cycle_end ?? false,
          }
          await saveSubscriptionToDB(payload.userId, updated)
          return NextResponse.json(withPlanDetails(updated))
        }
      }
    }
    return NextResponse.json(withPlanDetails(saved))
  }

  return NextResponse.json(dummySubscription)
}

// ── POST /api/admin/subscription — create Razorpay subscription ─────────────

export async function POST(req) {
  const payload = await getAuthPayload(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { planId, totalCount = 12, notify = { sms: true, email: true } } = await req.json()

  // Find plan by our internal ID
  const plan = dummyPlans.find(p => p.id === planId || p.razorpayPlanId === planId)
  if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })

  // Free plan — no Razorpay subscription needed
  if (plan.price === 0) {
    const sub = {
      status:                 'active',
      plan:                   plan.name,
      planId:                 plan.id,
      razorpaySubscriptionId: null,
      currentPeriodStart:     new Date().toISOString(),
      currentPeriodEnd:       null,
      cancelAtPeriodEnd:      false,
    }
    await saveSubscriptionToDB(payload.userId, sub)
    return NextResponse.json({ ok: true, subscription: sub })
  }

  if (!plan.razorpayPlanId) {
    return NextResponse.json({ error: 'This plan is not configured for payments' }, { status: 400 })
  }

  const rz = razorpay()
  if (!rz) {
    return NextResponse.json({ error: 'Payment gateway not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.' }, { status: 503 })
  }

  try {
    const rzSub = await rz.post('/subscriptions', {
      plan_id:        plan.razorpayPlanId,
      total_count:    totalCount,
      notify_info:    notify,
      notes:          { userId: payload.userId, planId: plan.id },
    })

    const sub = {
      status:                 mapRazorpayStatus(rzSub.status),
      plan:                   plan.name,
      planId:                 plan.id,
      razorpaySubscriptionId: rzSub.id,
      shortUrl:               rzSub.short_url ?? null,
      currentPeriodStart:     null,
      currentPeriodEnd:       null,
      cancelAtPeriodEnd:      false,
    }

    await saveSubscriptionToDB(payload.userId, sub)

    return NextResponse.json({
      ok:           true,
      subscription: sub,
      paymentLink:  rzSub.short_url,
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── Utils ────────────────────────────────────────────────────────────────────

function mapRazorpayStatus(s) {
  const map = { created: 'inactive', authenticated: 'inactive', active: 'active', pending: 'inactive', halted: 'past_due', cancelled: 'cancelled', completed: 'cancelled', expired: 'cancelled' }
  return map[s] ?? s
}

function withPlanDetails(sub) {
  const plan = dummyPlans.find(p => p.id === sub.planId)
  return { ...sub, planDetails: plan ?? null }
}
