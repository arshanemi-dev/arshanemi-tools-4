// Two-provider orchestrator for Listing Tools AI Auto-Fill — the only place
// either ai-fill route should import a generation function from. Gemini
// (lib/gemini.js, itself a 3-model fallback chain) is always tried first;
// the fallback AI (lib/fallbackAi.js) is only ever called after every Gemini
// model has failed, exactly as asked: "if gemini failed then used this."
import { generateListingFields as generateWithGemini } from './gemini'
import { generateListingFields as generateWithFallbackAi } from './fallbackAi'

// `fallbackImagePart` is optional and only needed when `imagePart` is
// Gemini's File API `{ fileUri }` shortcut (see gemini.js's
// uploadImageForVision) — the fallback provider can't resolve that URI, so
// callers using it must also hand over the same image as `{ base64,
// mimeType }`. When `imagePart` is already `{ base64 }` (the per-row route's
// case), omit `fallbackImagePart` and it's reused as-is.
export async function generateListingFieldsWithFallback({ systemInstruction, promptText, imagePart, fallbackImagePart, targets }) {
  if (!targets?.length) return {}
  try {
    return await generateWithGemini({ systemInstruction, promptText, imagePart, targets })
  } catch (geminiErr) {
    console.error('Gemini AI Auto-Fill failed, falling back to secondary AI:', geminiErr)
    return generateWithFallbackAi({ systemInstruction, promptText, imagePart: fallbackImagePart || imagePart, targets })
  }
}
