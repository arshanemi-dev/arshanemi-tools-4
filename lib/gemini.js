// Server-only Gemini wrapper for Listing Tools AI Auto-Fill (per
// plan/gemini-ai-plan.md §2). GEMINI_API_KEY is never read outside this
// file — no NEXT_PUBLIC_ prefix, so it can't leak to the client bundle.
// Single platform key, metered per-user through the existing coin-wallet
// gate (lib/toolBilling.js) rather than per-key billing.
import { GoogleGenAI, Type, ApiError, createPartFromText, createPartFromBase64, createPartFromUri } from '@google/genai'

// Ordered fallback chain, tried in order until one succeeds. Live-tested
// against this project's own key (not just assumed from docs) after
// 'gemini-2.5-flash' and 'gemini-pro-latest' both turned out to be dead
// ends for this account specifically: 'gemini-2.5-flash' 404s ("no longer
// available to new users" — a PERMANENT rejection, every retry would fail
// identically) and 'gemini-pro-latest' 429s with the quota body reporting
// `limit: 0` (Pro has zero free-tier allowance on this account at all, not
// "exhausted for today"). 'gemini-3.5-flash' and 'gemini-3.5-flash-lite'
// both round-tripped clean JSON in that same test — confirmed-live, and a
// separate model generation from whatever 'gemini-flash-latest' currently
// resolves to, which is what actually matters here: Google buckets
// free-tier request quota separately PER MODEL (confirmed by a live 429
// body naming the specific exhausted model), so each hop is a genuinely
// separate daily allowance, not another shot at the same limit — this is
// what lets a bulk run survive one model's quota running out instead of
// failing every remaining row for the rest of the day.
const MODELS = ['gemini-flash-latest', 'gemini-3.5-flash', 'gemini-3.5-flash-lite']

// Fall forward to the next model for everything EXCEPT the error classes
// that mean "this exact request is broken and every model will reject it
// the same way": 400 (malformed request/schema — e.g. the enum bug fixed
// above) and 401/403 (bad or unauthorized API key — not model-specific).
// Everything else falls through, INCLUDING plain network failures (fetch
// timeouts/resets aren't ApiError instances at all) — a live test against
// this key hit a bare `fetch failed` on the first model, which the old
// ApiError-only allowlist would NOT have retried past.
const NON_RETRYABLE_STATUSES = new Set([400, 401, 403])

let _ai = null
function client() {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured')
  if (!_ai) _ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  return _ai
}

// Decision #12 — every dropdown target's allowed values are given to the
// model structurally (via `enum`), not just mentioned in prose. Non-dropdown
// targets get a free-text STRING with no `enum`.
//
// `format: 'enum'` MUST accompany `enum` — confirmed against @google/genai's
// own Schema type ("To mark a field as an enum, set `format` to `enum` and
// provide the list of possible values in `enum`"). Without it, Gemini
// rejects the whole request with 400 INVALID_ARGUMENT the moment ANY target
// in the call is a dropdown — which silently zeroed out every row that had
// even one dropdown field selected (a plain text-only row, e.g. just
// Title/Description, never hit this and looked fine, making it easy to miss).
function buildResponseSchema(targets) {
  const properties = {}
  for (const t of targets) {
    properties[t.id] = {
      type: Type.STRING,
      description: t.label,
      ...(t.dropdownValues?.length ? { format: 'enum', enum: t.dropdownValues } : {}),
    }
  }
  return { type: Type.OBJECT, properties, required: targets.map((t) => t.id) }
}

// A flat 800-token cap was cutting off the JSON response — and therefore
// silently dropping the ENTIRE row (JSON.parse throws on truncated JSON) —
// on any row with enough target fields for the structured output to run
// long (e.g. a Design Details row with Title + Description + Keywords + a
// handful of dropdowns selected at once). The cost-cap intent (Decision
// #3/§8) is preserved — this still caps output — but the budget now scales
// with how many fields were actually asked for, so the cap tracks the
// request instead of silently truncating larger ones. ~90 tokens covers a
// short dropdown/keyword value; description-shaped fields run longer, but
// the model shares the pool across fields rather than each getting a fixed
// slice.
function maxOutputTokensFor(targets) {
  return Math.min(3000, Math.max(500, 120 + targets.length * 220))
}

// One call, two shapes: text-only (`imagePart` omitted) or vision-informed
// (`imagePart` = { base64, mimeType } or { fileUri, mimeType } — the bulk
// route reuses an already-uploaded Gemini file via fileUri instead of
// re-inlining base64 per row, see lib/aiFillPrompt.js's bulk caller).
// `systemInstruction` and the actual row/user data are kept in separate
// config fields rather than string-concatenated — basic prompt-injection
// hygiene, so a crafted `otherRules` value or row cell can't pose as an
// instruction.
export async function generateListingFields({ systemInstruction, promptText, imagePart, targets }) {
  if (!targets?.length) return {}
  const ai = client()
  const parts = [createPartFromText(promptText)]
  if (imagePart?.base64) parts.push(createPartFromBase64(imagePart.base64, imagePart.mimeType))
  else if (imagePart?.fileUri) parts.push(createPartFromUri(imagePart.fileUri, imagePart.mimeType))

  const config = {
    systemInstruction,
    responseMimeType: 'application/json',
    responseSchema: buildResponseSchema(targets),
    maxOutputTokens: maxOutputTokensFor(targets), // cost cap — Decision #3/§8, now sized to the request
  }

  let lastErr = null
  for (const model of MODELS) {
    let response
    try {
      response = await ai.models.generateContent({ model, contents: parts, config })
    } catch (err) {
      lastErr = err
      if (err instanceof ApiError && NON_RETRYABLE_STATUSES.has(err.status)) throw err
      continue
    }
    // A truncated response still comes back as a (partial, unparsable)
    // string rather than an SDK error — surface *why* explicitly instead of
    // letting JSON.parse's generic "Unexpected end of JSON input" reach the
    // caller, so a still-too-small budget is diagnosable instead of looking
    // like a random per-row failure.
    if (response.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
      throw new Error(`AI response was cut off before completing ${targets.length} field(s) — try selecting fewer fields for this row.`)
    }
    return JSON.parse(response.text)
  }
  throw lastErr
}

// Bulk-path efficiency refinement (§12) — registers an image once with
// Gemini's File API so a row's single Brand+Highlights call can reference it
// by URI instead of re-inlining the full base64 payload, then the caller
// deletes it immediately after so nothing accumulates across a bulk run.
export async function uploadImageForVision(blob, mimeType) {
  const ai = client()
  const file = await ai.files.upload({ file: blob, config: { mimeType } })
  return { uri: file.uri, mimeType: file.mimeType, name: file.name }
}

export async function deleteUploadedFile(name) {
  if (!name) return
  try {
    await client().files.delete({ name })
  } catch {
    // best-effort cleanup only — a stray file left in Gemini's storage is
    // harmless, never worth failing the row's result over
  }
}
