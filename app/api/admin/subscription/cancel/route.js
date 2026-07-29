import { NextResponse } from 'next/server'
import { getAuthPayload } from '@/lib/auth'

async function getSubscriptionFromDB(userId) {
  try {
    const { getSingleton } = await import('@/lib/db')
    return (await getSingleton(`subscription_${userId}`)) ?? null
  } catch { return null }
}

async function saveSubscriptionToDB(userId, data) {
  try {
    const { updateSingleton } = await import('@/lib/db')
    await updateSingleton(`subscription_${userId}`, data)
  } catch {}
}

export async function POST(req) {
  const payload = await getAuthPayload(req)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { cancelAtPeriodEnd = true } = await req.json().catch(() => ({}))

  const sub = await getSubscriptionFromDB(payload.userId)
  if (!sub?.razorpaySubscriptionId) {
    return NextResponse.json({ error: 'No active subscription found' }, { status: 404 })
  }

  const keyId     = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) {
    return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 503 })
  }

  try {
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
    const res = await fetch(
      `https://api.razorpay.com/v1/subscriptions/${sub.razorpaySubscriptionId}/cancel`,
      {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancel_at_cycle_end: cancelAtPeriodEnd ? 1 : 0 }),
      }
    )
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.error?.description ?? `Razorpay error ${res.status}`)
    }

    const updated = {
      ...sub,
      status:           cancelAtPeriodEnd ? sub.status : 'cancelled',
      cancelAtPeriodEnd,
    }
    await saveSubscriptionToDB(payload.userId, updated)

    return NextResponse.json({ ok: true, subscription: updated })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
