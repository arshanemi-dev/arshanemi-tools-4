import { NextResponse } from 'next/server'

// Public utility — no auth required, no user data involved. Proxies the
// free India Post pincode lookup (api.postalpincode.in) server-side to
// avoid CORS/rate-limit issues in the browser, and normalizes the response
// to just what the Address form needs: state + city (district).
export async function GET(req, { params }) {
  const { code } = await params
  const pincode = (code || '').trim()

  if (!/^\d{6}$/.test(pincode)) {
    return NextResponse.json({ valid: false, message: 'Enter a 6-digit pincode' }, { status: 400 })
  }

  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      return NextResponse.json({ valid: false, message: 'Could not verify pincode right now' }, { status: 502 })
    }

    const data = await res.json()
    const result = Array.isArray(data) ? data[0] : null
    const office = result?.Status === 'Success' ? result.PostOffice?.[0] : null

    if (!office) {
      return NextResponse.json({ valid: false, message: 'Invalid pincode' })
    }

    return NextResponse.json({
      valid: true,
      state: office.State || null,
      city: office.District || null,
      country: office.Country || 'India',
    })
  } catch (err) {
    console.error('Pincode lookup error:', err)
    return NextResponse.json({ valid: false, message: 'Could not verify pincode right now' }, { status: 502 })
  }
}
