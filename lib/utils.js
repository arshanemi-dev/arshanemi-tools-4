import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function formatNumber(num) {
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num.toString();
}

// ─── Blog category visual config ─────────────────────────────────────────────

export const CATEGORY_STYLES = {
  seo: {
    badge: 'text-violet-300 bg-violet-950/60 border-violet-800/60',
    thumbnailBg: 'bg-gradient-to-br from-violet-950 via-indigo-950 to-[#161616]',
    glow: 'rgba(139,92,246,0.15)',
    dot: 'bg-violet-400',
  },
  'digital-marketing': {
    badge: 'text-emerald-300 bg-emerald-950/60 border-emerald-800/60',
    thumbnailBg: 'bg-gradient-to-br from-emerald-950 via-teal-950 to-[#161616]',
    glow: 'rgba(16,185,129,0.15)',
    dot: 'bg-emerald-400',
  },
  general: {
    badge: 'text-amber-300 bg-amber-950/60 border-amber-800/60',
    thumbnailBg: 'bg-gradient-to-br from-amber-950 via-orange-950 to-[#161616]',
    glow: 'rgba(245,158,11,0.15)',
    dot: 'bg-amber-400',
  },
  'app-development': {
    badge: 'text-blue-300 bg-blue-950/60 border-blue-800/60',
    thumbnailBg: 'bg-gradient-to-br from-blue-950 via-indigo-950 to-[#161616]',
    glow: 'rgba(59,130,246,0.15)',
    dot: 'bg-blue-400',
  },
  'web-development': {
    badge: 'text-cyan-300 bg-cyan-950/60 border-cyan-800/60',
    thumbnailBg: 'bg-gradient-to-br from-cyan-950 via-sky-950 to-[#161616]',
    glow: 'rgba(6,182,212,0.15)',
    dot: 'bg-cyan-400',
  },
  'social-media': {
    badge: 'text-pink-300 bg-pink-950/60 border-pink-800/60',
    thumbnailBg: 'bg-gradient-to-br from-pink-950 via-rose-950 to-[#161616]',
    glow: 'rgba(236,72,153,0.15)',
    dot: 'bg-pink-400',
  },
  'paid-advertising': {
    badge: 'text-orange-300 bg-orange-950/60 border-orange-800/60',
    thumbnailBg: 'bg-gradient-to-br from-orange-950 via-amber-950 to-[#161616]',
    glow: 'rgba(249,115,22,0.15)',
    dot: 'bg-orange-400',
  },
  'email-marketing': {
    badge: 'text-rose-300 bg-rose-950/60 border-rose-800/60',
    thumbnailBg: 'bg-gradient-to-br from-rose-950 via-pink-950 to-[#161616]',
    glow: 'rgba(244,63,94,0.15)',
    dot: 'bg-rose-400',
  },
  services: {
    badge: 'text-sky-300 bg-sky-950/60 border-sky-800/60',
    thumbnailBg: 'bg-gradient-to-br from-sky-950 via-blue-950 to-[#161616]',
    glow: 'rgba(14,165,233,0.15)',
    dot: 'bg-sky-400',
  },
};

const FALLBACK_STYLE = CATEGORY_STYLES.general;

export function getCategoryStyle(slug) {
  if (!slug) return FALLBACK_STYLE;
  return CATEGORY_STYLES[slug.toLowerCase().replace(/\s+/g, '-')] || FALLBACK_STYLE;
}
