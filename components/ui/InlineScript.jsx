// An inline <script> that runs once, while the browser parses the server
// HTML (before first paint), without React 19's dev warning "Encountered a
// script tag while rendering React component". Pattern from the Next.js 16
// guide "Preventing flash before hydration": the server renders it as
// text/javascript so it executes; on the client it's text/plain, so React
// sees inert text instead of a script. suppressHydrationWarning covers that
// type mismatch. Replaces next/script's beforeInteractive for inline code.
export default function InlineScript({ id, html }) {
  return (
    <script
      id={id}
      type={typeof window === 'undefined' ? 'text/javascript' : 'text/plain'}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
