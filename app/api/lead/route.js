import { NextResponse } from 'next/server';
import { buildLeadEmail, sendEmail } from '@/lib/mailer';
import { getSingleton, createItem } from '@/lib/db';
import { COMPANY_EMAIL } from '@/data/company';

export async function POST(req) {
  try {
    const { name, email, phone, interest } = await req.json();

    if (!name?.trim() || !email?.trim()) {
      return NextResponse.json({ error: 'Name and email are required.' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
    }

    const company = await getSingleton('company');
    const toEmail = company?.email || COMPANY_EMAIL;

    // Save lead to persistent JSON collection (fire-and-forget — don't block response)
    createItem('leads', {
      source: 'popup',
      name: name.trim(),
      email: email.trim(),
      phone: phone?.trim() || '',
      interest: interest || '',
      status: 'New',
      createdAt: new Date().toISOString(),
    }).catch((e) => console.error('[lead] lead save error:', e?.message));

    const { subject, html } = buildLeadEmail({ name, email, phone, interest });

    await sendEmail({
      from: `"Arshanemi Website" <${process.env.SMTP_USER}>`,
      replyTo: `"${name}" <${email}>`,
      to: toEmail,
      subject,
      html,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[lead/route] email error:', err?.code, err?.message);
    const msg = err?.code === 'EAUTH'
      ? 'Email service not configured. Please contact us directly.'
      : 'Failed to submit. Please try again.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
