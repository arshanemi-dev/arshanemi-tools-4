import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { createItem, getSingleton } from '@/lib/db'
import { buildApplicationEmail, sendEmail } from '@/lib/mailer'
import { COMPANY_HR_EMAIL } from '@/data/company'

export async function POST(req) {
  try {
    const formData = await req.formData()
    const name = formData.get('name')?.trim()
    const email = formData.get('email')?.trim()
    const phone = formData.get('phone')?.trim() || ''
    const jobTitle = formData.get('jobTitle')?.trim()
    const coverLetter = formData.get('coverLetter')?.trim() || ''
    const resume = formData.get('resume')

    if (!name || !email || !jobTitle) {
      return NextResponse.json({ error: 'Name, email, and job title are required.' }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 })
    }

    let resumeUrl = null
    let resumeFileName = null

    if (resume && resume.size > 0) {
      if (resume.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: 'Resume file too large. Maximum size is 5 MB.' }, { status: 400 })
      }
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
      if (!allowedTypes.includes(resume.type)) {
        return NextResponse.json({ error: 'Only PDF, DOC, or DOCX files are accepted.' }, { status: 400 })
      }
      const cleanName = resume.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const blobPath = `resumes/${Date.now()}-${cleanName}`
      const blob = await put(blobPath, resume.stream(), {
        access: 'public',
        contentType: resume.type,
      })
      resumeUrl = blob.url
      resumeFileName = resume.name
    }

    // Save candidate to persistent JSON collection
    await createItem('candidates', {
      name,
      email,
      phone,
      jobTitle,
      coverLetter,
      resumeUrl,
      resumeFileName,
      status: 'New',
      appliedAt: new Date().toISOString(),
    })

    // Resolve HR email from company singleton → fallback to static default
    const company = await getSingleton('company')
    const hrEmail = company?.hrEmail || company?.email || COMPANY_HR_EMAIL

    const { subject, html } = buildApplicationEmail({
      applicantName: name,
      applicantEmail: email,
      applicantPhone: phone,
      jobTitle,
      coverLetter,
      resumeUrl,
      resumeFileName,
    })

    await sendEmail({
      from: `"Arshanemi Careers" <${process.env.SMTP_USER}>`,
      replyTo: `"${name}" <${email}>`,
      to: hrEmail,
      subject,
      html,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[careers/apply] error:', err?.code, err?.message)
    return NextResponse.json({ error: 'Failed to submit application. Please try again.' }, { status: 500 })
  }
}
