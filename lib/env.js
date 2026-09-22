import Joi from 'joi'

// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for SERVER-SIDE environment variables.
//
// Server modules import `env` from here instead of reading process.env
// directly, so the app fails fast at boot with a readable list of what's
// missing/wrong, defaults live in one place, and types are coerced once.
//
// NOT covered here (must keep reading process.env directly):
//   • proxy.js  — Edge/middleware runtime, Joi is Node-only.
//   • every NEXT_PUBLIC_* var — inlined by Next at build time; used from
//     client components and shared libs that can't import a Node module.
//   • scripts/*.mjs — standalone CLIs.
// ─────────────────────────────────────────────────────────────────────────────

const bool = () => Joi.boolean().truthy('1').falsy('0')

const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),

  // Auth (JWT) — shared with the root admin panel in connect mode.
  JWT_SECRET: Joi.string().min(1).required(),
  JWT_REFRESH_SECRET: Joi.string().optional(),

  // Blob storage namespace + token.
  TOOLS_NAME: Joi.string().default('barmeto-tools-dashboard'),
  BLOB_READ_WRITE_TOKEN: Joi.string().optional(),
  BLOB_STORE_ID: Joi.string().optional(),

  // Dropbox (Listing Tools product images + source-file upload).
  DROPBOX_APP_KEY: Joi.string().optional(),
  DROPBOX_APP_SECRET: Joi.string().optional(),
  DROPBOX_REFRESH_TOKEN: Joi.string().optional(),

  // AI auto-fill — primary (Gemini) + optional fallback provider.
  GEMINI_API_KEY: Joi.string().optional(),
  FALLBACK_AI_BASE_URL: Joi.string().uri().optional(),
  FALLBACK_AI_API_KEY: Joi.string().optional(),
  FALLBACK_AI_MODEL: Joi.string().default('auto'),

  // SMTP (email).
  SMTP_HOST: Joi.string().optional(),
  SMTP_PORT: Joi.number().port().default(587),
  SMTP_SECURE: bool().default(false),
  SMTP_USER: Joi.string().optional(),
  SMTP_PASS: Joi.string().optional(),
  COMPANY_EMAIL_TO: Joi.string().optional(),

  // MSG91 (SMS OTP).
  MSG91_AUTH_KEY: Joi.string().optional(),
  MSG91_TEMPLATE_ID: Joi.string().optional(),
  MSG91_OTP_VAR_NAME: Joi.string().default('VAR1'),
  MSG91_DEFAULT_COUNTRY_CODE: Joi.string().default('91'),

  // Razorpay (legacy dummy-subscription scaffold).
  RAZORPAY_KEY_ID: Joi.string().optional(),
  RAZORPAY_KEY_SECRET: Joi.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: Joi.string().optional(),
  RAZORPAY_PLAN_ID_PRO: Joi.string().allow('').default(''),
  RAZORPAY_PLAN_ID_BUSINESS: Joi.string().allow('').default(''),

  // Consumed only by proxy.js (Edge, raw process.env) — declared here so a
  // bad value is still caught at boot.
  ALLOWED_ORIGINS: Joi.string().default('http://localhost:3001'),
})

const source = Object.fromEntries(
  Object.entries(process.env).filter(([, v]) => v !== undefined && v !== '')
)

const { value, error } = schema.validate(source, {
  abortEarly: false,
  stripUnknown: true,
  convert: true,
})

if (error) {
  const details = error.details.map((d) => `  • ${d.message}`).join('\n')
  throw new Error(`Invalid environment configuration:\n${details}\n`)
}

export const env = Object.freeze(value)
export default env
