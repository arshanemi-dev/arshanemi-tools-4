'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Loader2, ArrowLeft, Pencil, Key, ListFilter, Image as ImageIcon, Type,
  Store, Tag, GitBranch, Rows3, Sparkles, FileText, Table2,
} from 'lucide-react'
import PillButton from '@/components/listing/PillButton'
import ExcelFormatsView from '@/components/listing/ExcelFormatsView'

// The 4 real groups, in a fixed display order — same set the wizard and
// backend (lib/listingTemplates.js GROUPS) always use. Colors match the
// create wizard's Kanban board (GroupTabsStep.jsx's DEFAULT_TAB_COLOR) so a
// group reads as the same color everywhere in this feature. Written out in
// full (not built with template strings) so Tailwind's build sees the
// literal class names — see GroupTabsStep.jsx's own comment on this.
const GROUP_ORDER = [
  { id: 'design_system', label: 'Product Details', accent: 'border-l-purple-400', dot: 'bg-purple-500', badge: 'bg-purple-50 text-purple-700' },
  { id: 'compulsory', label: 'Compulsory', accent: 'border-l-red-400', dot: 'bg-red-500', badge: 'bg-red-50 text-red-700' },
  { id: 'prefill', label: 'Prefill', accent: 'border-l-blue-400', dot: 'bg-blue-500', badge: 'bg-blue-50 text-blue-700' },
  { id: 'optional', label: 'Optional', accent: 'border-l-amber-400', dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700' },
]

const TYPE_STYLE = {
  text: { icon: Type, badge: 'bg-gray-100 text-gray-600' },
  dropdown: { icon: ListFilter, badge: 'bg-indigo-100 text-indigo-700' },
  image: { icon: ImageIcon, badge: 'bg-purple-100 text-purple-700' },
}
const MAX_VALUE_CHIPS = 5

const TABS = [
  { id: 'details', label: 'Template Details', icon: FileText },
  { id: 'excel', label: 'Excel Formats', icon: Table2 },
]

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2.5 border border-gray-200 rounded-lg bg-white p-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-md bg-indigo-50 flex items-center justify-center">
        <Icon className="w-4 h-4 text-indigo-600" />
      </div>
      <div className="min-w-0">
        <p className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-[13.5px] font-semibold text-gray-800 truncate">{value}</p>
      </div>
    </div>
  )
}
function ReadField({ label, value }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-[13px] text-gray-700 break-words">{value || <span className="italic text-gray-300">Not set</span>}</p>
    </div>
  )
}

// Pure read-only view of a template's full definition — every header, its
// type, its dropdown values, plus preset and AI rules. No edit/save/delete
// actions live here on purpose (per the "no operations, just view" ask);
// the only way out is Edit Template, which hands off to the real wizard.
export default function TemplateDetailsPage() {
  const { templateId } = useParams()
  const [template, setTemplate] = useState(null)
  const [content, setContent] = useState(null)
  const [loadError, setLoadError] = useState(false)
  const [activeTab, setActiveTab] = useState('details')

  useEffect(() => {
    let cancelled = false
    fetch(`/api/listing-tools/${templateId}`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return
        if (!data?.template || !data?.content) { setLoadError(true); return }
        setTemplate(data.template)
        setContent(data.content)
      })
      .catch(() => { if (!cancelled) setLoadError(true) })
    return () => { cancelled = true }
  }, [templateId])

  if (loadError) {
    return (
      <div className="max-w-lg mx-auto px-6 py-16 text-center">
        <p className="text-[14px] font-semibold text-gray-800">Couldn&apos;t load this template.</p>
        <p className="text-[13px] text-gray-500 mt-1">It may have been deleted, or you don&apos;t have access to it.</p>
        <Link href="/listing-tools/template-settings" className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-indigo-600 hover:text-indigo-700">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Template Settings
        </Link>
      </div>
    )
  }
  if (!template || !content) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
      </div>
    )
  }

  const totalHeaders = content.sheets.reduce((sum, s) => sum + (s.headers?.length || 0), 0)

  return (
    <div className="min-h-full bg-gray-50 px-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <Link href="/listing-tools/template-settings" className="inline-flex items-center gap-1.5 text-[12px] font-medium text-gray-500 hover:text-gray-700 mb-2">
            <ArrowLeft className="w-3 h-3" /> Back to Template Settings
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold text-gray-900">{template.templateName}</h1>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
              template.isAllowedToShow ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {template.isAllowedToShow ? 'Active' : 'Hidden'}
            </span>
          </div>
          {template.description && <p className="text-[13px] text-gray-500 mt-0.5">{template.description}</p>}
        </div>
        {/* <Link href={`/listing-tools/template-settings/${templateId}`}>
          <PillButton variant="edit" icon={Pencil} title="Edit this template's groups, headers, dropdown sources, preset and AI rules">
            Edit Template
          </PillButton>
        </Link> */}
      </div>

      {/* Tabs — segmented control, not a thin underline, so switching to
          Excel Formats is obvious rather than easy to miss. */}
      <div className="inline-flex items-center gap-1 rounded-lg bg-gray-100 p-1 mb-5">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = activeTab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
                active ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'excel' ? (
        <ExcelFormatsView sourceFileUrl={template.sourceFileUrl} />
      ) : (
        <>
          {/* Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <StatCard icon={Store} label="Marketplace" value={template.marketplaceName || '—'} />
            <StatCard icon={Tag} label="Category" value={template.category || '—'} />
            <StatCard icon={GitBranch} label="Version" value={template.exportVersion || '—'} />
            <StatCard icon={Rows3} label="Total Headers" value={totalHeaders} />
          </div>
          <div className="flex items-center gap-2 mb-5 border border-gray-200 rounded-lg bg-white px-3.5 py-2.5">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Final Name</span>
            <span className="text-[13px] font-mono font-medium text-gray-700 truncate">{template.finalName || '—'}</span>
          </div>

          {/* AI Rules */}
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white mb-5">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <h2 className="text-[13px] font-semibold text-gray-800">AI Rules</h2>
            </div>
            <div className="p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <ReadField label="Title" value={template.aiRules?.title} />
              <ReadField label="Description" value={template.aiRules?.description} />
              <ReadField label="Keywords" value={template.aiRules?.keyword} />
              <ReadField label="Rules" value={template.aiRules?.otherRules} />
            </div>
          </div>

          {/* Groups + headers */}
          <div className="space-y-4">
            {GROUP_ORDER.map((g) => {
              const sheet = content.sheets.find((s) => s.group === g.id)
              const headers = sheet?.headers || []
              const dropdownCount = headers.filter((h) => h.dataType === 'dropdown').length
              const uniqueCount = headers.filter((h) => h.isUniqueKeyPart).length
              return (
                <div key={g.id} className={`border border-l-4 ${g.accent} border-gray-200 rounded-lg overflow-hidden bg-white`}>
                  <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${g.dot}`} />
                      <h2 className="text-[13px] font-semibold text-gray-800">{sheet?.sheetName || g.label}</h2>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {uniqueCount > 0 && (
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10.5px] font-semibold text-indigo-700">{uniqueCount} unique</span>
                      )}
                      {dropdownCount > 0 && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10.5px] font-semibold text-gray-600">{dropdownCount} dropdown</span>
                      )}
                      <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${g.badge}`}>
                        {headers.length} header{headers.length === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>
                  {headers.length === 0 ? (
                    <p className="px-4 py-6 text-center text-[12px] italic text-gray-400">No headers in this group.</p>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {headers.map((h, i) => {
                        const typeStyle = TYPE_STYLE[h.dataType] || TYPE_STYLE.text
                        const Icon = typeStyle.icon
                        const values = h.dropdownSource?.values || []
                        const shown = values.slice(0, MAX_VALUE_CHIPS)
                        const extra = values.length - shown.length
                        return (
                          <div key={h.id} className={`px-4 py-3 ${i % 2 === 1 ? 'bg-gray-50/60' : ''}`}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[13px] font-medium text-gray-800">{h.label}</span>
                                {h.isUniqueKeyPart && (
                                  <span title="Unique key part" className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">
                                    <Key className="w-2.5 h-2.5" /> Unique
                                  </span>
                                )}
                              </div>
                              <span className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold capitalize ${typeStyle.badge}`}>
                                <Icon className="w-3 h-3" /> {h.dataType}
                              </span>
                            </div>
                            {h.dataType === 'dropdown' && (
                              <div className="mt-2 flex flex-wrap items-center gap-1">
                                {shown.length > 0 ? (
                                  <>
                                    {shown.map((v, vi) => (
                                      <span key={vi} className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px] text-gray-600">{v}</span>
                                    ))}
                                    {extra > 0 && (
                                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">+{extra} more</span>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-[11px] italic text-gray-400">No values</span>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
