// Server-only Gemini wrapper for Listing Tools AI Auto-Fill (per
// plan/gemini-ai-plan.md §2). GEMINI_API_KEY is never read outside this
// file — no NEXT_PUBLIC_ prefix, so it can't leak to the client bundle.
// Single platform key, metered per-user through the existing coin-wallet
// gate (lib/toolBilling.js) rather than per-key billing.
import { GoogleGenAI, Type, createPartFromText, createPartFromBase64, createPartFromUri } from '@google/genai'

// 'gemini-flash-latest' is the SDK's rolling alias for the current
// recommended flash model — deliberately not a dated id like
// 'gemini-2.5-flash' (confirmed via Context7 that dated flash ids get
// retired from new API keys over time; the alias tracks whatever Google
// currently recommends without this file needing an update each time).
const MODEL = 'gemini-flash-latest'

let _ai = null
function client() {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured')
  if (!_ai) _ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  return _ai
}

// Decision #12 — every dropdown target's allowed values are given to the
// model structurally (via `enum`), not just mentioned in prose. Non-dropdown
// targets get a free-text STRING with no `enum`.
function buildResponseSchema(targets) {
  const properties = {}
  for (const t of targets) {
    properties[t.id] = {
      type: Type.STRING,
      description: t.label,
      ...(t.dropdownValues?.length ? { enum: t.dropdownValues } : {}),
    }
  }
  return { type: Type.OBJECT, properties, required: targets.map((t) => t.id) }
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

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: parts,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: buildResponseSchema(targets),
      maxOutputTokens: 800, // cost cap — Decision #3/§8
    },
  })
  return JSON.parse(response.text)
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
