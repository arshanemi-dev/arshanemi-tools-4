// Small "who made this" pill for template lists — reads the viewerBadge
// field GET /api/listing-tools and GET /api/listing-tools/[id] attach to
// each template: { type: 'self'|'default'|'main'|'identity', label } — see
// lib/listingTemplates.js's templateBadgeFor for how type/label are chosen
// per viewer role. Renders nothing for legacy templates with no resolvable
// badge.
const STYLES = {
  self: 'bg-emerald-100 text-emerald-700',
  default: 'bg-accent/15 text-accent-hover',
  main: 'bg-amber-100 text-amber-700',
  identity: 'bg-card-hover text-muted',
}

export default function TemplateBadge({ badge }) {
  if (!badge?.label || !STYLES[badge.type]) return null
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${STYLES[badge.type]}`}>
      {badge.label}
    </span>
  )
}
