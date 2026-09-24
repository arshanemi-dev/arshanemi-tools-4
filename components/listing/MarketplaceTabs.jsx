'use client'

import { useRef } from 'react'
import { Store } from 'lucide-react'
import { OTHER_MARKETPLACE_KEY } from '@/lib/marketplaceTabs'

// Top-level marketplace switch for the Template Settings list and Template
// Logs pages — an underline tab strip (distinct from the segmented controls
// those pages use for their finer filters), one tab per saved marketplace
// with its template count. Arrow keys / Home / End move between tabs.
// `tabs` null = still loading; an empty array renders nothing.
export default function MarketplaceTabs({ tabs, activeKey, onSelect }) {
  const tabRefs = useRef([])

  if (tabs === null) {
    return (
      <div className="flex gap-3 border-b border-divider pb-2.5 pt-2">
        {[0, 1, 2].map((i) => <div key={i} className="h-7 w-28 animate-pulse rounded-md bg-card-hover" />)}
      </div>
    )
  }
  if (tabs.length === 0) return null

  function handleKeyDown(e, index) {
    let next = null
    if (e.key === 'ArrowRight') next = (index + 1) % tabs.length
    else if (e.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = tabs.length - 1
    if (next === null) return
    e.preventDefault()
    onSelect(tabs[next].key)
    tabRefs.current[next]?.focus()
  }

  return (
    <div className="border-b border-divider">
      <div role="tablist" aria-label="Marketplaces" className="-mb-px flex items-end gap-1 overflow-x-auto">
        {tabs.map((t, i) => {
          const active = t.key === activeKey
          return (
            <button
              key={t.key}
              ref={(el) => { tabRefs.current[i] = el }}
              type="button"
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => onSelect(t.key)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              className={`group flex flex-shrink-0 items-center gap-2 border-b-2 px-3.5 pb-2.5 pt-2 text-[13.5px] font-semibold transition-colors focus:outline-none focus-visible:bg-card-hover/60 ${
                active ? 'border-accent text-foreground' : 'border-transparent text-subtle hover:border-divider-light hover:text-muted'
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-bold uppercase transition-colors ${
                  active ? 'bg-accent text-white' : 'bg-card-hover text-muted group-hover:bg-divider'
                }`}
                aria-hidden="true"
              >
                {t.key === OTHER_MARKETPLACE_KEY ? <Store className="h-3.5 w-3.5" /> : t.label.charAt(0)}
              </span>
              {t.label}
              <span
                className={`rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums ${
                  active ? 'bg-accent/10 text-accent' : 'bg-card-hover text-subtle'
                }`}
                title={`${t.count} template${t.count === 1 ? '' : 's'}`}
              >
                {t.count}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
