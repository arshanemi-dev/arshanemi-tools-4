'use client'

import { useState } from 'react'
import { Check, X } from 'lucide-react'
import PillButton from '@/components/listing/PillButton'
import Modal from '@/components/admin/Modal'
import { useToast } from '@/components/admin/Toast'

// Preset inputs shown in the "Edit Template" dialog — same set the New
// Design's top form uses at create time.
function presetOf(template) {
  return {
    marketplaceName: template.marketplaceName || '',
    category1: template.category1 || '',
    category2: template.category2 || '',
    category3: template.category3 || '',
    category4: template.category4 || '',
    category5: template.category5 || '',
    category6: template.category6 || '',
    exportVersion: template.exportVersion || '',
  }
}
// Same composition rules as NewTemplateDesign.jsx: Template Name =
// Marketplace + Category 6; Final Name = Marketplace + Category 1…6 + Version.
function composeTemplateName(p) {
  return [p.marketplaceName, p.category6].map((s) => (s || '').trim()).filter(Boolean).join('_')
}
function composeFinalName(p) {
  return [p.marketplaceName, p.category1, p.category2, p.category3, p.category4, p.category5, p.category6, p.exportVersion]
    .map((s) => (s || '').trim())
    .filter(Boolean)
    .join('_')
}

const labelCls = 'text-[11.5px] font-semibold text-muted'
const fieldCls =
  'w-full px-3 py-2 text-[13px] border border-divider rounded-md bg-card focus:outline-none focus:ring-1 focus:ring-accent-light'
const roCls = `${fieldCls} bg-surface font-mono font-semibold text-muted`

// Template Settings list's "Edit Name" dialog. Template Name and Template
// Final Name are composed read-only from the preset inputs, exactly like
// the New Design's top form. Mounted only while open (the parent renders it
// conditionally), so every open starts from the template's current values.
export default function EditTemplateNamesModal({ template, onClose, onSaved }) {
  const { addToast } = useToast()
  const [saving, setSaving] = useState(false)
  const [presetDraft, setPresetDraft] = useState(() => presetOf(template))

  const composedName = composeTemplateName(presetDraft)
  const composedFinal = composeFinalName(presetDraft)
  const setPreset = (key, value) => setPresetDraft((p) => ({ ...p, [key]: value }))

  async function handleSave() {
    if (!composedName) {
      addToast('Enter a Marketplace Name and Category 6 — the Template Name is built from them.', 'error')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/listing-tools/${template.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateName: composedName,
          finalName: composedFinal,
          marketplaceName: presetDraft.marketplaceName.trim(),
          category1: presetDraft.category1.trim(),
          category2: presetDraft.category2.trim(),
          category3: presetDraft.category3.trim(),
          category4: presetDraft.category4.trim(),
          category5: presetDraft.category5.trim(),
          category6: presetDraft.category6.trim(),
          exportVersion: presetDraft.exportVersion.trim(),
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Request failed')
      addToast('Template updated.', 'success')
      onSaved(data.template)
      onClose()
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit Template"
      maxWidth="max-w-xl"
      footer={
        <>
          <PillButton variant="upload" icon={Check} loading={saving} onClick={handleSave}>
            Save
          </PillButton>
          <PillButton variant="ghost" icon={X} onClick={onClose}>
            Cancel
          </PillButton>
        </>
      }
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1 col-span-2 sm:col-span-3">
          <span className={labelCls}>Marketplace Name</span>
          <input
            type="text"
            value={presetDraft.marketplaceName}
            onChange={(e) => setPreset('marketplaceName', e.target.value)}
            placeholder="Meesho"
            className={fieldCls}
          />
        </label>
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <label key={n} className="flex flex-col gap-1">
            <span className={labelCls}>Category {n}</span>
            <input
              type="text"
              value={presetDraft[`category${n}`]}
              onChange={(e) => setPreset(`category${n}`, e.target.value)}
              className={fieldCls}
            />
          </label>
        ))}
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Version</span>
          <input
            type="text"
            value={presetDraft.exportVersion}
            onChange={(e) => setPreset('exportVersion', e.target.value)}
            placeholder="v1.0"
            className={fieldCls}
          />
        </label>
      </div>

      <div className="mt-1 border-t border-divider pt-4 grid gap-3">
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Template Name — auto (Marketplace + Category 6)</span>
          <input readOnly value={composedName} placeholder="Meesho_Blouses" className={roCls} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Template Final Name — auto (Marketplace + Category 1–6 + Version)</span>
          <input readOnly value={composedFinal} placeholder="Meesho_Women Fashion_..._v1.0" className={roCls} />
        </label>
      </div>
    </Modal>
  )
}
