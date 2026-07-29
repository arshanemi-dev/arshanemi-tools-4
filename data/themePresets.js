// Curated brand-accent presets for the Theme Settings page.
// Only the accent/brand family varies between presets — background, surface,
// card, border and text tokens stay on the same well-tuned neutral scale
// (see data/defaultTheme.js) in both modes, so switching presets never
// breaks legibility, and picking a preset is really "pick your brand color."

export const themePresets = [
  {
    id: 'amethyst',
    name: 'Amethyst',
    swatch: '#6e02d9',
    dark:  { accent: '#6e02d9', 'accent-hover': '#9333ea', 'accent-light': '#d8b4fe', 'accent-vivid': '#c084fc', cyan: '#e879f9', 'link-hover': '#d8b4fe' },
    light: { accent: '#6e02d9', 'accent-hover': '#7e22ce', 'accent-light': '#c084fc', 'accent-vivid': '#9333ea', cyan: '#c026d3', 'link-hover': '#6e02d9' },
  },
  {
    id: 'sunset',
    name: 'Sunset Orange',
    swatch: '#f97316',
    dark:  { accent: '#f97316', 'accent-hover': '#ea580c', 'accent-light': '#fdba74', 'accent-vivid': '#fb923c', cyan: '#fbbf24', 'link-hover': '#fdba74' },
    light: { accent: '#ea580c', 'accent-hover': '#c2410c', 'accent-light': '#f97316', 'accent-vivid': '#fb923c', cyan: '#d97706', 'link-hover': '#ea580c' },
  },
  {
    id: 'ocean',
    name: 'Ocean Blue',
    swatch: '#3b82f6',
    dark:  { accent: '#3b82f6', 'accent-hover': '#2563eb', 'accent-light': '#93c5fd', 'accent-vivid': '#60a5fa', cyan: '#22d3ee', 'link-hover': '#93c5fd' },
    light: { accent: '#2563eb', 'accent-hover': '#1d4ed8', 'accent-light': '#3b82f6', 'accent-vivid': '#60a5fa', cyan: '#0891b2', 'link-hover': '#2563eb' },
  },
  {
    id: 'emerald',
    name: 'Emerald Green',
    swatch: '#10b981',
    dark:  { accent: '#10b981', 'accent-hover': '#059669', 'accent-light': '#6ee7b7', 'accent-vivid': '#34d399', cyan: '#2dd4bf', 'link-hover': '#6ee7b7' },
    light: { accent: '#059669', 'accent-hover': '#047857', 'accent-light': '#10b981', 'accent-vivid': '#34d399', cyan: '#0d9488', 'link-hover': '#059669' },
  },
  {
    id: 'violet',
    name: 'Royal Violet',
    swatch: '#8b5cf6',
    dark:  { accent: '#8b5cf6', 'accent-hover': '#7c3aed', 'accent-light': '#c4b5fd', 'accent-vivid': '#a78bfa', cyan: '#e879f9', 'link-hover': '#c4b5fd' },
    light: { accent: '#7c3aed', 'accent-hover': '#6d28d9', 'accent-light': '#8b5cf6', 'accent-vivid': '#a78bfa', cyan: '#c026d3', 'link-hover': '#7c3aed' },
  },
  {
    id: 'crimson',
    name: 'Crimson Red',
    swatch: '#ef4444',
    dark:  { accent: '#ef4444', 'accent-hover': '#dc2626', 'accent-light': '#fca5a5', 'accent-vivid': '#f87171', cyan: '#fb7185', 'link-hover': '#fca5a5' },
    light: { accent: '#dc2626', 'accent-hover': '#b91c1c', 'accent-light': '#ef4444', 'accent-vivid': '#f87171', cyan: '#e11d48', 'link-hover': '#dc2626' },
  },
  {
    id: 'slate',
    name: 'Slate Mono',
    swatch: '#64748b',
    dark:  { accent: '#64748b', 'accent-hover': '#475569', 'accent-light': '#cbd5e1', 'accent-vivid': '#94a3b8', cyan: '#38bdf8', 'link-hover': '#cbd5e1' },
    light: { accent: '#475569', 'accent-hover': '#334155', 'accent-light': '#64748b', 'accent-vivid': '#94a3b8', cyan: '#0284c7', 'link-hover': '#475569' },
  },
];

// Below this, an accent (or foreground/background pair) is treated as a
// design mistake rather than a deliberate low-contrast choice.
export const MIN_TEXT_CONTRAST = 4;
export const MIN_ACCENT_CONTRAST = 1.8;

function relLuminance(hex) {
  const chan = (h, i) => parseInt(h.slice(i, i + 2), 16) / 255;
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const [r, g, b] = [1, 3, 5].map((i) => lin(chan(hex, i)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// WCAG contrast ratio between two hex colors, from 1 (identical) to 21 (black/white).
export function contrastRatio(hexA, hexB) {
  const [a, b] = [relLuminance(hexA), relLuminance(hexB)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

// Finds the preset whose accent contrasts best against `backgroundHex` for
// the given mode — used to auto-suggest a fix when the current accent fails
// the contrast checks above.
export function bestPresetFor(mode, backgroundHex) {
  return themePresets.reduce((best, preset) => {
    const score = contrastRatio(preset[mode].accent, backgroundHex);
    return !best || score > best.score ? { preset, score } : best;
  }, null)?.preset;
}
