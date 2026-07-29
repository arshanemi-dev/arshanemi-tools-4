import nodemailer from 'nodemailer';

export function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    // Port 587 is TLS/STARTTLS, which requires secure to be FALSE. 
    // Secure: true is ONLY used for Port 465 (SSL).
    secure: false, 
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    // Add this block to prevent Vercel from dropping the socket connection
    tls: {
      rejectUnauthorized: false
    }
  });
}

function emailShell({ preheader, headerLabel, bodyContent }) {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${headerLabel}</title>
</head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
  <!-- preheader -->
  <div style="display:none;font-size:1px;color:#0d0d0d;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;padding:48px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

          <!-- ── HEADER ── -->
          <tr>
            <td style="background:linear-gradient(135deg,#ea580c 0%,#f97316 50%,#fbbf24 100%);padding:36px 40px;border-radius:12px 12px 0 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <p style="margin:0 0 4px;color:rgba(255,255,255,0.7);font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">${headerLabel}</p>
                    <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:800;line-height:1.2;">Arshanemi</h1>
                    <p style="margin:6px 0 0;color:rgba(255,255,255,0.65);font-size:13px;">Smart Ecommerce Tools · support@arshanemi.com</p>
                  </td>
                  <td align="right" valign="middle">
                    <div style="width:48px;height:48px;background:rgba(255,255,255,0.15);border-radius:50%;display:inline-block;line-height:48px;text-align:center;font-size:22px;">📩</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── BODY ── -->
          <tr>
            <td style="background:#111111;border-left:1px solid #262626;border-right:1px solid #262626;padding:36px 40px;">
              ${bodyContent}
            </td>
          </tr>

          <!-- ── FOOTER ── -->
          <tr>
            <td style="background:#161616;border:1px solid #262626;border-top:0;border-radius:0 0 12px 12px;padding:24px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-bottom:12px;border-bottom:1px solid #262626;">
                    <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.6;">
                      📍 204 Nilkanth Darshan Building, Katargam, Surat, Gujarat 395004<br/>
                      📞 +91 96871 76846 &nbsp;|&nbsp; ✉️ info@santhyainfotech.com<br/>
                      🕐 Mon – Sat · 9 AM – 9 PM IST
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:12px;">
                    <p style="margin:0;color:#4b5563;font-size:11px;">This email was generated automatically by the Arshanemi website. Please do not reply directly to this address.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function row(label, value) {
  if (!value) return '';
  return `
  <tr>
    <td style="padding:12px 16px;background:#161616;border-radius:8px;margin-bottom:8px;border-left:3px solid #4f46e5;" valign="top">
      <p style="margin:0 0 4px;color:#6b7280;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">${label}</p>
      <p style="margin:0;color:#e5e7eb;font-size:14px;line-height:1.5;word-break:break-word;">${value}</p>
    </td>
  </tr>
  <tr><td style="height:8px;"></td></tr>`;
}

export function buildContactEmail({ name, email, phone, budget, service, message }) {
  const timestamp = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'full',
    timeStyle: 'short',
  });

  const bodyContent = `
    <h2 style="margin:0 0 6px;color:#ffffff;font-size:18px;font-weight:700;">New Project Enquiry</h2>
    <p style="margin:0 0 28px;color:#a3a3a3;font-size:13px;">A visitor submitted the contact form on your website. Details below:</p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      ${row('Full Name', name)}
      ${row('Email Address', `<a href="mailto:${email}" style="color:#818cf8;text-decoration:none;">${email}</a>`)}
      ${row('Phone Number', phone ? `<a href="tel:${phone}" style="color:#818cf8;text-decoration:none;">${phone}</a>` : null)}
      ${row('Budget Range', budget)}
      ${row('Service Required', service)}
      ${row('Message', message ? message.replace(/\n/g, '<br/>') : null)}
      ${row('Submitted At', timestamp)}
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">
      <tr>
        <td align="center">
          <a href="mailto:${email}?subject=Re: Your Enquiry — Arshanemi"
             style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#06b6d4);color:#ffffff;font-size:14px;font-weight:700;padding:12px 32px;border-radius:8px;text-decoration:none;letter-spacing:0.3px;">
            Reply to ${name}
          </a>
        </td>
      </tr>
    </table>`;

  return {
    subject: `📩 New Enquiry from ${name} — Arshanemi`,
    html: emailShell({
      preheader: `${name} submitted the contact form. Service: ${service || 'Not specified'}.`,
      headerLabel: 'Contact Form Submission',
      bodyContent,
    }),
  };
}

export function buildLeadEmail({ name, email, phone, interest }) {
  const timestamp = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'full',
    timeStyle: 'short',
  });

  const bodyContent = `
    <h2 style="margin:0 0 6px;color:#ffffff;font-size:18px;font-weight:700;">New Lead Captured 🎯</h2>
    <p style="margin:0 0 28px;color:#a3a3a3;font-size:13px;">A visitor expressed interest via the website popup. Details below:</p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      ${row('Full Name', name)}
      ${row('Email Address', `<a href="mailto:${email}" style="color:#818cf8;text-decoration:none;">${email}</a>`)}
      ${row('Phone Number', phone ? `<a href="tel:${phone}" style="color:#818cf8;text-decoration:none;">${phone}</a>` : null)}
      ${row('Service Interested In', interest)}
      ${row('Captured At', timestamp)}
    </table>

    <div style="margin-top:24px;background:#1c1c2e;border:1px solid #4f46e5;border-radius:10px;padding:16px 20px;">
      <p style="margin:0;color:#818cf8;font-size:13px;font-weight:600;">💡 Hot Lead — Act Fast</p>
      <p style="margin:6px 0 0;color:#a3a3a3;font-size:13px;line-height:1.6;">This visitor spent 30+ seconds on the website before filling the form — higher intent signal. Follow up within 1 hour for best conversion.</p>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">
      <tr>
        <td align="center">
          <a href="mailto:${email}?subject=Your Free SEO Audit — Arshanemi"
             style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#06b6d4);color:#ffffff;font-size:14px;font-weight:700;padding:12px 32px;border-radius:8px;text-decoration:none;letter-spacing:0.3px;">
            Contact ${name} Now
          </a>
        </td>
      </tr>
    </table>`;

  return {
    subject: `🎯 New Lead: ${name} — ${interest || 'SEO Audit Request'}`,
    html: emailShell({
      preheader: `${name} (${email}) requested a free SEO audit via the website popup.`,
      headerLabel: 'Lead Capture — Website Popup',
      bodyContent,
    }),
  };
}

export function buildApplicationEmail({ applicantName, applicantEmail, applicantPhone, jobTitle, coverLetter, resumeUrl, resumeFileName }) {
  const timestamp = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'full',
    timeStyle: 'short',
  });

  const bodyContent = `
    <h2 style="margin:0 0 6px;color:#ffffff;font-size:18px;font-weight:700;">New Job Application 📋</h2>
    <p style="margin:0 0 28px;color:#a3a3a3;font-size:13px;">A candidate applied via the Arshanemi careers page. Details below:</p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      ${row('Position Applied For', jobTitle)}
      ${row('Applicant Name', applicantName)}
      ${row('Email Address', `<a href="mailto:${applicantEmail}" style="color:#818cf8;text-decoration:none;">${applicantEmail}</a>`)}
      ${row('Phone Number', applicantPhone ? `<a href="tel:${applicantPhone}" style="color:#818cf8;text-decoration:none;">${applicantPhone}</a>` : null)}
      ${row('Cover Letter', coverLetter ? coverLetter.replace(/\n/g, '<br/>') : null)}
      ${row('Applied At', timestamp)}
    </table>

    ${resumeUrl ? `
    <div style="margin-top:24px;background:#1c1c2e;border:1px solid #4f46e5;border-radius:10px;padding:20px;">
      <p style="margin:0 0 4px;color:#818cf8;font-size:13px;font-weight:700;">📎 Resume Uploaded</p>
      <p style="margin:0 0 12px;color:#a3a3a3;font-size:12px;">${resumeFileName || 'resume'}</p>
      <a href="${resumeUrl}"
         style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#06b6d4);color:#ffffff;font-size:13px;font-weight:700;padding:10px 24px;border-radius:8px;text-decoration:none;">
        Download Resume
      </a>
    </div>` : ''}

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">
      <tr>
        <td align="center">
          <a href="mailto:${applicantEmail}?subject=Re: Your Application for ${encodeURIComponent(jobTitle)} — Arshanemi"
             style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#06b6d4);color:#ffffff;font-size:14px;font-weight:700;padding:12px 32px;border-radius:8px;text-decoration:none;letter-spacing:0.3px;">
            Reply to ${applicantName}
          </a>
        </td>
      </tr>
    </table>`;

  return {
    subject: `📋 New Application: ${jobTitle} — ${applicantName}`,
    html: emailShell({
      preheader: `${applicantName} applied for ${jobTitle}.`,
      headerLabel: 'Job Application',
      bodyContent,
    }),
  };
}

export async function sendOtpEmail({ to, otpCode, name = 'User' }) {
  const bodyContent = `
    <h2 style="margin:0 0 6px;color:#ffffff;font-size:18px;font-weight:700;">Password Reset OTP</h2>
    <p style="margin:0 0 24px;color:#a3a3a3;font-size:13px;">Hi ${name}, use the code below to reset your Arshanemi account password. This code expires in <strong style="color:#fb923c;">60 seconds</strong>.</p>

    <div style="background:#1a1a1a;border:2px dashed #ea580c;border-radius:12px;padding:28px;text-align:center;margin-bottom:24px;">
      <p style="margin:0 0 6px;color:#a3a3a3;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Your OTP</p>
      <p style="margin:0;color:#fb923c;font-size:40px;font-weight:900;letter-spacing:10px;">${otpCode}</p>
    </div>

    <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.6;">
      If you did not request a password reset, please ignore this email. Your account is safe.
    </p>`;

  const { subject, html } = {
    subject: `${otpCode} — Your Arshanemi Password Reset OTP`,
    html: emailShell({
      preheader: `Your Arshanemi OTP is ${otpCode}. Expires in 60 seconds.`,
      headerLabel: 'Password Reset',
      bodyContent,
    }),
  };

  return sendEmail({
    from: `Arshanemi <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });
}

export async function sendLoginOtpEmail({ to, otpCode, name = 'Master Admin' }) {
  const bodyContent = `
    <h2 style="margin:0 0 6px;color:#ffffff;font-size:18px;font-weight:700;">Admin Login Verification</h2>
    <p style="margin:0 0 24px;color:#a3a3a3;font-size:13px;">Hi ${name}, use the code below to finish signing in to the Arshanemi admin panel. This code expires in <strong style="color:#fb923c;">60 seconds</strong>.</p>

    <div style="background:#1a1a1a;border:2px dashed #ea580c;border-radius:12px;padding:28px;text-align:center;margin-bottom:24px;">
      <p style="margin:0 0 6px;color:#a3a3a3;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Your OTP</p>
      <p style="margin:0;color:#fb923c;font-size:40px;font-weight:900;letter-spacing:10px;">${otpCode}</p>
    </div>

    <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.6;">
      If you did not attempt to sign in, someone else may have your password — change it immediately.
    </p>`;

  const { subject, html } = {
    subject: `${otpCode} — Master Admin Login Verification`,
    html: emailShell({
      preheader: `Your admin login OTP is ${otpCode}. Expires in 60 seconds.`,
      headerLabel: 'Admin Login',
      bodyContent,
    }),
  };

  return sendEmail({
    from: `Arshanemi <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });
}

export async function sendContactChangeOtpEmail({ to, otpCode, name = 'User', contactType = 'email' }) {
  const label = contactType === 'mobile' ? 'mobile number' : 'email address';
  const bodyContent = `
    <h2 style="margin:0 0 6px;color:#ffffff;font-size:18px;font-weight:700;">Verify Your New ${label === 'mobile number' ? 'Mobile Number' : 'Email Address'}</h2>
    <p style="margin:0 0 24px;color:#a3a3a3;font-size:13px;">Hi ${name}, use the code below to confirm this ${label} is yours. This code expires in <strong style="color:#fb923c;">60 seconds</strong>.</p>

    <div style="background:#1a1a1a;border:2px dashed #ea580c;border-radius:12px;padding:28px;text-align:center;margin-bottom:24px;">
      <p style="margin:0 0 6px;color:#a3a3a3;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Your OTP</p>
      <p style="margin:0;color:#fb923c;font-size:40px;font-weight:900;letter-spacing:10px;">${otpCode}</p>
    </div>

    <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.6;">
      If you did not request this change, please ignore this email — your account is safe and no change was made.
    </p>`;

  const { subject, html } = {
    subject: `${otpCode} — Confirm your new ${label}`,
    html: emailShell({
      preheader: `Your Arshanemi verification code is ${otpCode}. Expires in 60 seconds.`,
      headerLabel: 'Contact Update',
      bodyContent,
    }),
  };

  return sendEmail({
    from: `Arshanemi <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });
}

export async function sendEmail({ from, replyTo, to, subject, html }) {
  // Dev fallback: if SMTP_PASS looks like a placeholder (contains @) or is missing,
  // print to console so forms still "work" during local development.
  const isDev = process.env.NODE_ENV !== 'production';
  const passLooksInvalid = !process.env.SMTP_PASS || process.env.SMTP_PASS.includes('@');

  if (isDev && passLooksInvalid) {
    console.log('\n📧 [DEV EMAIL — not sent via SMTP]\n');
    console.log('  To      :', to);
    console.log('  From    :', from);
    console.log('  ReplyTo :', replyTo);
    console.log('  Subject :', subject);
    console.log('  Body    : (HTML — check buildContactEmail / buildLeadEmail)\n');
    return { messageId: 'dev-mode' };
  }

  const transport = createTransport();
  return transport.sendMail({ from, replyTo, to, subject, html });
}
