import { NextResponse } from 'next/server'
import crypto from 'crypto'

async function saveSubscriptionToDB(userId, data) {
  try {
    const { updateSingleton } = await import('@/lib/db')
    await updateSingleton(`subscription_${userId}`, data)
  } catch {}
}

function mapRazorpayStatus(s) {
  const map = { created: 'inactive', authenticated: 'inactive', active: 'active', pending: 'inactive', halted: 'past_due', cancelled: 'cancelled', completed: 'cancelled', expired: 'cancelled' }
  return map[s] ?? s
}

export async function POST(req) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const rawBody  = await req.text()
  const signature = req.headers.get('x-razorpay-signature')

  // Verify webhook signature
  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex')

  if (expected !== signature) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const event = JSON.parse(rawBody)
  const sub   = event?.payload?.subscription?.entity

  if (!sub) return NextResponse.json({ ok: true })

  const userId = sub.notes?.userId
  if (!userId)  return NextResponse.json({ ok: true })

  const subRecord = {
    status:                 mapRazorpayStatus(sub.status),
    razorpaySubscriptionId: sub.id,
    planId:                 sub.notes?.planId ?? null,
    currentPeriodStart:     sub.current_start ? new Date(sub.current_start * 1000).toISOString() : null,
    currentPeriodEnd:       sub.current_end   ? new Date(sub.current_end   * 1000).toISOString() : null,
    cancelAtPeriodEnd:      sub.cancel_at_cycle_end ?? false,
  }

  await saveSubscriptionToDB(userId, subRecord)

  return NextResponse.json({ ok: true })
}
