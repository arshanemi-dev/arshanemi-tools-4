// MSG91 SMS OTP delivery — optional. The OTP itself is always generated and
// persisted to user_otp by the caller BEFORE this runs (that's the source of
// truth for verification); this module only handles best-effort delivery.
//
// If MSG91_AUTH_KEY + MSG91_TEMPLATE_ID aren't set, we just log to the
// console (same dev-fallback convention as lib/mailer.js's sendEmail) so OTP
// flows keep working locally without a real SMS account. On any MSG91 API
// failure we log a warning and still resolve — a delivery hiccup should
// never fail the request, since the code is already saved and verifiable.

const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY;
const MSG91_TEMPLATE_ID = process.env.MSG91_TEMPLATE_ID;
const MSG91_OTP_VAR = process.env.MSG91_OTP_VAR_NAME || 'VAR1';
const MSG91_COUNTRY_CODE = process.env.MSG91_DEFAULT_COUNTRY_CODE || '91';

export function isMsg91Configured() {
  return !!(MSG91_AUTH_KEY && MSG91_TEMPLATE_ID);
}

// MSG91 expects mobile numbers with country code, no leading '+' or '0'.
function toMsg91Number(mobile) {
  const digits = mobile.replace(/\D/g, '');
  if (digits.length === 10) return `${MSG91_COUNTRY_CODE}${digits}`;
  return digits;
}

// Always resolves `true` — delivery failures are logged, not thrown.
export async function sendSmsOtp({ to, otpCode }) {
  if (!isMsg91Configured()) {
    console.log(`\n📱 [DEV SMS OTP — MSG91 not configured]\n  To   : ${to}\n  Code : ${otpCode}\n`);
    return true;
  }

  try {
    const res = await fetch('https://control.msg91.com/api/v5/flow', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        authkey: MSG91_AUTH_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        template_id: MSG91_TEMPLATE_ID,
        short_url: '0',
        recipients: [
          { mobiles: toMsg91Number(to), [MSG91_OTP_VAR]: otpCode },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn('MSG91 send failed:', res.status, body);
    }
  } catch (err) {
    console.warn('MSG91 send error:', err.message);
  }

  return true;
}
