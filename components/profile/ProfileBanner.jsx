import { MessageCircle } from 'lucide-react'
import { socialLinks } from '@/data/company'

// This lucide-react version dropped brand icons (Facebook/Instagram/Youtube
// don't exist as exports — only generic glyphs like MessageCircle do; see
// app/settings/navigation/page.js's dynamic LucideIcons[icon] lookup, which
// falls back to a generic Globe icon for the same reason). Small inline SVGs
// instead of leaving three of four badges empty.
function FacebookIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M22 12.06C22 6.53 17.52 2.04 12 2.04S2 6.53 2 12.06c0 4.99 3.66 9.13 8.44 9.88v-6.99H7.9v-2.89h2.54V9.84c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.87h2.78l-.44 2.89h-2.34v6.99C18.34 21.19 22 17.05 22 12.06Z" />
    </svg>
  )
}

function InstagramIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function YoutubeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.5v-7l6.3 3.5-6.3 3.5Z" />
    </svg>
  )
}

const BANNER_SOCIAL_ORDER = ['Instagram', 'Facebook', 'WhatsApp', 'YouTube']
const SOCIAL_ICONS = { Instagram: InstagramIcon, Facebook: FacebookIcon, MessageCircle, Youtube: YoutubeIcon }
const SOCIAL_STYLES = {
  Instagram: 'bg-gradient-to-tr from-[#FED373] via-[#E1306C] to-[#5851DB]',
  Facebook: 'bg-[#1877F2]',
  WhatsApp: 'bg-[#25D366]',
  YouTube: 'bg-[#FF0000]',
}

// Profile page hero banner — credit balance on the left, the company's own
// social links on the right (not the user's — there's no per-user social
// profile concept here). Sits above the tab bar so it's visible on every tab.
export default function ProfileBanner({ profile }) {
  const remaining = profile.walletCreditsRemaining
    ?? Math.max(0, (profile.walletCreditsTotal ?? 0) - (profile.walletCreditsUsed ?? 0))

  const socials = BANNER_SOCIAL_ORDER
    .map((label) => socialLinks.find((s) => s.label === label))
    .filter(Boolean)

  return (
    <div className="rounded-2xl bg-gradient-to-r from-[#4a5fd9] to-[#f0763f] px-6 py-5 flex flex-wrap items-center justify-between gap-6">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center flex-shrink-0">
          <span className="text-lg font-bold text-[#4a5fd9]">{(profile.name || '?').charAt(0).toUpperCase()}</span>
        </div>
        <p className="text-xl font-bold text-white">{profile.name}</p>
        <span className="w-fit text-xs font-semibold text-white bg-white/20 rounded-full px-3 py-1.5">
          {remaining} Credits
        </span>
      </div>

      <div className="flex flex-col items-start sm:items-end gap-2">
        <p className="text-sm font-bold text-white">Follow us</p>
        <div className="flex items-center gap-2">
          {socials.map((social) => {
            const Icon = SOCIAL_ICONS[social.icon]
            return (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.label}
                className={`w-9 h-9 rounded-lg flex items-center justify-center text-white hover:opacity-90 transition-opacity ${SOCIAL_STYLES[social.label]}`}
              >
                {Icon && <Icon className="w-4 h-4" />}
              </a>
            )
          })}
        </div>
      </div>
    </div>
  )
}
