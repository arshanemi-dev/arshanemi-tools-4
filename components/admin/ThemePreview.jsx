'use client'

export default function ThemePreview({ theme, mode }) {
  const c = theme[mode] ?? {}
  const accent = c.accent || '#3608dd'
  const accentLight = c['accent-light'] || '#818cf8'
  const cyan = c.cyan || '#06b6d4'
  const radius = theme.borderRadius || {}

  const cardRadius = radius.lg || '8px'
  const btnRadius = radius.md || '6px'
  const badgeRadius = radius['2xl'] || '16px'

  return (
    <div
      className="rounded-xl overflow-hidden border border-gray-200 shadow-sm select-none"
      style={{ fontFamily: `${theme.typography?.fontFamily || 'Inter'}, sans-serif` }}
    >
      {/* Browser chrome */}
      <div className="bg-gray-100 border-b border-gray-200 px-3 py-2 flex items-center gap-2">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 bg-white rounded text-[10px] text-gray-400 px-2 py-0.5 text-center">
          santhyainfotech.com
        </div>
      </div>

      {/* Site preview */}
      <div style={{ backgroundColor: c.background, minHeight: '380px' }}>

        {/* Header */}
        <div style={{ backgroundColor: c.surface, borderBottom: `1px solid ${c.divider}` }}
          className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded" style={{ backgroundColor: accent }} />
            <span className="text-[11px] font-bold" style={{ color: c.foreground }}>Arshanemi</span>
          </div>
          <div className="flex items-center gap-3">
            {['Services', 'About', 'Contact'].map(n => (
              <span key={n} className="text-[10px]" style={{ color: c.muted }}>{n}</span>
            ))}
            <span className="text-[10px] px-2 py-0.5 rounded"
              style={{ backgroundColor: accent, color: '#fff', borderRadius: btnRadius }}>
              Get Quote
            </span>
          </div>
        </div>

        {/* Hero */}
        <div className="px-4 py-5">
          <div className="inline-flex items-center gap-1 px-2 py-0.5 mb-3 text-[9px] font-semibold rounded-full"
            style={{ backgroundColor: `${accent}22`, color: accentLight, borderRadius: badgeRadius }}>
            <span style={{ color: accent }}>★</span> Trusted by 500+ Clients
          </div>
          <h1 className="text-[15px] font-extrabold leading-tight mb-1.5"
            style={{ color: c.foreground }}>
            Grow Your Business
            <span className="block" style={{
              background: `linear-gradient(90deg, ${accent} 0%, ${cyan} 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              With Smart SEO
            </span>
          </h1>
          <p className="text-[10px] mb-3 leading-relaxed" style={{ color: c.muted }}>
            Results-driven SEO & digital marketing that delivers measurable growth.
          </p>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold px-3 py-1.5 rounded"
              style={{ backgroundColor: accent, color: '#fff', borderRadius: btnRadius }}>
              Start Now
            </span>
            <span className="text-[10px] font-medium px-3 py-1.5 rounded border"
              style={{ color: c.foreground, borderColor: c.divider, borderRadius: btnRadius }}>
              View Work
            </span>
          </div>
        </div>

        {/* Cards row */}
        <div className="px-4 pb-4 grid grid-cols-3 gap-2">
          {['SEO', 'Ads', 'Content'].map((s) => (
            <div key={s} className="p-2.5"
              style={{ backgroundColor: c.card, borderRadius: cardRadius, border: `1px solid ${c.divider}` }}>
              <div className="w-4 h-4 rounded mb-1.5" style={{ backgroundColor: `${accent}33` }} />
              <p className="text-[10px] font-semibold mb-0.5" style={{ color: c.foreground }}>{s}</p>
              <p className="text-[9px]" style={{ color: c.subtle }}>Optimised</p>
            </div>
          ))}
        </div>

        {/* Typography sample */}
        <div className="mx-4 mb-4 p-2.5 rounded"
          style={{ backgroundColor: c.surface, border: `1px solid ${c.divider}`, borderRadius: cardRadius }}>
          <p className="text-[10px] font-bold mb-0.5" style={{ color: c.foreground }}>
            Typography Preview
          </p>
          <p className="text-[9px] leading-relaxed" style={{ color: c.muted }}>
            The quick brown fox jumps over the lazy dog.&nbsp;
            <span style={{ color: accentLight, textDecoration: 'underline' }}>Learn more →</span>
          </p>
          <p className="text-[9px] mt-1" style={{ color: c.subtle }}>Subtle secondary text sample</p>
        </div>
      </div>
    </div>
  )
}
