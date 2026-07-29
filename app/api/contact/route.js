import { NextResponse } from 'next/server';
import { buildContactEmail, sendEmail } from '@/lib/mailer';
import { getSingleton, createItem } from '@/lib/db';
import { COMPANY_EMAIL } from '@/data/company';

export async function POST(req) {
  try {
    const { name, email, phone, budget, service, message } = await req.json();

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return NextResponse.json({ error: 'Name, email, and message are required.' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
    }

    const company = await getSingleton('company');
    const toEmail = company?.email || COMPANY_EMAIL;

    // Save lead to persistent JSON collection (fire-and-forget — don't block response)
    createItem('leads', {
      source: 'contact',
      name: name.trim(),
      email: email.trim(),
      phone: phone?.trim() || '',
      budget: budget || '',
      service: service || '',
      message: message?.trim() || '',
      status: 'New',
      createdAt: new Date().toISOString(),
    }).catch((e) => console.error('[contact] lead save error:', e?.message));

    const { subject, html } = buildContactEmail({ name, email, phone, budget, service, message });

    await sendEmail({
      from: `"Arshanemi Website" <${process.env.SMTP_USER}>`,
      replyTo: `"${name}" <${email}>`,
      to: toEmail,
      subject,
      html,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[contact/route] email error:', err?.code, err?.message);
    const msg = err?.code === 'EAUTH'
      ? 'Email service not configured. Please contact us directly.'
      : 'Failed to send message. Please try again.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
