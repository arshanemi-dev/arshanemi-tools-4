// Server-only fallback AI wrapper for Listing Tools AI Auto-Fill. Second
// provider for the same feature — only ever called by lib/aiProvider.js
// after every model in lib/gemini.js's MODELS chain has failed. Talks to a
// generic OpenAI-compatible chat/completions endpoint (FALLBACK_AI_BASE_URL),
// so this file has no vendor SDK dependency, just fetch.

const REQUEST_TIMEOUT_MS = 60_000

function config() {
  const baseUrl = process.env.FALLBACK_AI_BASE_URL
  const apiKey = process.env.FALLBACK_AI_API_KEY
  const model = process.env.FALLBACK_AI_MODEL || 'auto'
  if (!baseUrl) throw new Error('FALLBACK_AI_BASE_URL is not configured')
  if (!apiKey) throw new Error('FALLBACK_AI_API_KEY is not configured')
  return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey, model }
}

// json_object mode (unlike Gemini's structured responseSchema) can't declare
// per-field types/enums itself — the exact-keys and allowed-values
// constraints already live in promptText's per-field instructions (see
// buildPrompt in lib/aiFillPrompt.js), so this only needs to pin down the
// output *shape*, appended as its own system message rather than concatenated
// into the caller's systemInstruction — same prompt-injection hygiene as the
// Gemini path (systemInstruction/promptText/data never string-mashed).
function jsonShapeInstruction(targets) {
  const keys = targets.map((t) => t.id).join(', ')
  return `Respond with ONLY a single valid JSON object — no markdown, no code fences, no commentary. It must contain exactly these keys and no others: ${keys}.`
}

function stripCodeFence(text) {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return fenced ? fenced[1] : trimmed
}

function buildMessages({ systemInstruction, promptText, imagePart, targets }) {
  const messages = [
    { role: 'system', content: systemInstruction },
    { role: 'system', content: jsonShapeInstruction(targets) },
  ]
  if (imagePart?.base64) {
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: promptText },
        { type: 'image_url', image_url: { url: `data:${imagePart.mimeType};base64,${imagePart.base64}` } },
      ],
    })
  } else {
    messages.push({ role: 'user', content: promptText })
  }
  return messages
}

// Same call shape as lib/gemini.js's generateListingFields — swappable by
// lib/aiProvider.js without either caller (ai-fill/ai-fill-bulk routes)
// knowing which provider actually served the request. `imagePart` here must
// already be `{ base64, mimeType }` — Gemini's File API `fileUri` shortcut
// (see gemini.js's uploadImageForVision) is Google-internal and unusable by
// a third-party endpoint, so callers must pass the raw base64 for fallback.
export async function generateListingFields({ systemInstruction, promptText, imagePart, targets }) {
  if (!targets?.length) return {}
  const { baseUrl, apiKey, model } = config()

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  let res
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: buildMessages({ systemInstruction, promptText, imagePart, targets }),
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Fallback AI request failed (${res.status}): ${body.slice(0, 300)}`)
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new Error('Fallback AI returned no content')
  return JSON.parse(stripCodeFence(content))
}
