'use client'
import { useEffect, useRef, useState } from 'react'
import { Search, Pencil, Copy, Upload, ClipboardPaste } from 'lucide-react'
import PillButton from './PillButton'
import { useToast } from '@/components/admin/Toast'

const ROW_FIELDS = [
  { key: 'title', label: 'Title', placeholder: 'Title rule' },
  { key: 'description', label: 'Description', placeholder: 'Description rule' },
  { key: 'keyword', label: 'Keyword', placeholder: 'Keyword rule' },
  { key: 'otherRules', label: 'Other Rules', placeholder: 'Other rules' },
]

const EDITOR_FIELDS = [
  { key: 'title', label: 'Title Prompt Template' },
  { key: 'description', label: 'Description Prompt Template' },
  { key: 'keyword', label: 'Keyword Rules' },
  { key: 'otherRules', label: 'Other Rules & Tone Constraints' },
]

const labelCls = 'block text-[11.5px] font-semibold text-muted mb-1'
const inputCls = 'w-full px-2.5 py-2 text-[13px] border border-divider rounded-md focus:outline-none focus:ring-1 focus:ring-accent-light'

function rulesFromTemplate(t) {
  return {
    marketplace: t.marketplaceName || '',
    category: t.category || '',
    title: t.aiRules?.title || '',
    description: t.aiRules?.description || '',
    keyword: t.aiRules?.keyword || '',
    otherRules: t.aiRules?.otherRules || '',
  }
}

// Section 5 of Template Settings, matching source/11.html's "AI Rules &
// Template Generation" toolbar + single-line row + expandable prompt editor
// pixel-for-pixel. Unlike the prototype's 4 fake preset names, "Copy Rules
// From Template" lists your real saved templates (GET /api/listing-tools) —
// picking one loads that template's saved marketplaceName/category/aiRules
// (lib/listingTemplates.js's createTemplateMeta already persists all of
// these) as a starting point. `value`/`onChange` are lifted to the parent
// wizard: they're exactly what gets submitted as `aiRules` when Save
// Template fires. `latestTemplateId` is set by the parent right after a
// save succeeds, so this section re-fetches and auto-selects the template
// you just created — confirming what was actually saved, not just what's
// still sitting in local state.
export default function AiRulesSection({ value, onChange, latestTemplateId, currentPreset }) {
  const { addToast } = useToast()
  const fileInputRef = useRef(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showEditor, setShowEditor] = useState(false)
  const [templates, setTemplates] = useState([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/listing-tools', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { templates: [] }))
      .then((json) => { if (!cancelled) setTemplates(json.templates || []) })
      .catch(() => { if (!cancelled) setTemplates([]) })
    return () => { cancelled = true }
  }, [])

  // Fires once right after the parent's Save Template succeeds — re-fetches
  // so the just-created row is in the list, then selects and loads it.
  useEffect(() => {
    if (!latestTemplateId) return
    let cancelled = false
    fetch('/api/listing-tools', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { templates: [] }))
      .then((json) => {
        if (cancelled) return
        const list = json.templates || []
        setTemplates(list)
        setSelectedTemplateId(latestTemplateId)
        const match = list.find((t) => t.id === latestTemplateId)
        if (match) onChange(rulesFromTemplate(match))
      })
      .catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestTemplateId])

  function set(key, v) {
    onChange({ ...value, [key]: v })
  }

  function handleSelectTemplate(id) {
    setSelectedTemplateId(id)
    // The one current preset (from Section 4's "Save Preset") only ever
    // carries marketplace/category/version — no aiRules to load, so only
    // those two fields change; Title/Description/Keyword/Other Rules are
    // left as-is.
    if (currentPreset && id === currentPreset.id) {
      onChange({ ...value, marketplace: currentPreset.marketplaceName || '', category: currentPreset.category || '' })
      return
    }
    const match = templates.find((t) => t.id === id)
    if (match) onChange(rulesFromTemplate(match))
  }

  // Copy/Paste only ever move the keyword + other-rules content — Marketplace
  // and Category are read-only display here (see the disabled inputs below;
  // they mirror whichever template is selected, Section 4 is where those
  // actually get edited for the template being created), and Title/
  // Description are per-template detail that copy/paste don't touch.
  function handleCopy() {
    navigator.clipboard.writeText(JSON.stringify({ title: value.title, description: value.description, keyword: value.keyword, otherRules: value.otherRules }, null, 2))
    addToast('Keyword and rules copied to clipboard.', 'success')
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText()
      const parsed = JSON.parse(text)
      onChange({
        ...value,
        title: parsed.title ?? value.title,
        description: parsed.description ?? value.description,
        keyword: parsed.keyword ?? value.keyword,
        otherRules: parsed.otherRules ?? value.otherRules,
      })
      addToast('Keyword and rules pasted in.', 'success')
    } catch {
      addToast('Clipboard doesn’t have copied rules to paste.', 'error')
    }
  }

  function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target.result)
        onChange({ ...value, ...parsed })
        addToast('Rules uploaded successfully.', 'success')
      } catch {
        addToast('Invalid JSON file format.', 'error')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="border border-divider rounded-lg overflow-hidden bg-card">
      <div className="px-4 py-2.5 bg-surface border-b border-divider flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold text-foreground">5. AI Rules &amp; Template Generation</h2>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-subtle" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search rule keywords…"
              className="pl-8 pr-3 py-1.5 text-[12.5px] w-44 border border-divider rounded-md bg-card focus:outline-none focus:ring-1 focus:ring-accent-light"
            />
          </div>

          <PillButton variant="edit" icon={Pencil} onClick={() => setShowEditor((s) => !s)}>
            {showEditor ? 'Hide AI Editor' : 'Edit AI Rules'}
          </PillButton>
          <PillButton variant="ghost" icon={Copy} onClick={handleCopy}>Copy Rules</PillButton>
          <PillButton variant="ghost" icon={ClipboardPaste} onClick={handlePaste}>Paste Rules</PillButton>
          <PillButton variant="ghost" icon={Upload} onClick={() => fileInputRef.current?.click()}>Upload Rules</PillButton>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleUpload} />
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[190px]">
            <label className={labelCls}>Copy Rules From Template</label>
            <select value={selectedTemplateId} onChange={(e) => handleSelectTemplate(e.target.value)} className={inputCls}>
              <option value="">— Start from scratch —</option>
              {currentPreset && (
                <option value={currentPreset.id}>
                  Current preset: {currentPreset.marketplaceName || 'marketplace'} / {currentPreset.category || 'category'} / {currentPreset.exportVersion || 'v1.0'}
                </option>
              )}
              {templates.length > 0 && (
                <optgroup label="Saved Templates">
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.templateName}</option>)}
                </optgroup>
              )}
            </select>
          </div>

          <div className="flex-1 min-w-[120px]">
            <label className={labelCls}>Marketplace</label>
            <input
              value={value.marketplace}
              disabled
              title="Set in Section 4 — display only here"
              className={`${inputCls} bg-surface text-subtle cursor-default`}
            />
          </div>

          <div className="flex-1 min-w-[120px]">
            <label className={labelCls}>Category</label>
            <input
              value={value.category}
              disabled
              title="Set in Section 4 — display only here"
              className={`${inputCls} bg-surface text-subtle cursor-default`}
            />
          </div>

          {ROW_FIELDS.map((f) => (
            <div key={f.key} className="flex-1 min-w-[140px]">
              <label className={labelCls}>{f.label}</label>
              <input
                value={value[f.key]}
                placeholder={f.placeholder}
                onChange={(e) => set(f.key, e.target.value)}
                className={inputCls}
              />
            </div>
          ))}
        </div>

        {showEditor && (
          <div className="rounded-lg border border-divider bg-surface p-4 space-y-3">
            <h3 className="text-[12.5px] font-semibold text-muted">Edit AI Generation Prompts &amp; Instructions</h3>
            <div className="grid md:grid-cols-2 gap-3">
              {EDITOR_FIELDS.map((f) => (
                <div key={f.key}>
                  <label className={labelCls}>{f.label}</label>
                  <textarea
                    rows={3}
                    value={value[f.key]}
                    onChange={(e) => set(f.key, e.target.value)}
                    className={`${inputCls} resize-none`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
