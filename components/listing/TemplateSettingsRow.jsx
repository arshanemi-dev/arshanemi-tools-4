'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Eye, Pencil, Copy, ClipboardPaste, Check, Trash2, X, Loader2 } from 'lucide-react'
import PillButton from './PillButton'
import ConfirmDialog from '@/components/admin/ConfirmDialog'
import { useToast } from '@/components/admin/Toast'

const EDIT_FIELDS = [
  { key: 'title', label: 'Title' },
  { key: 'description', label: 'Description' },
  { key: 'keyword', label: 'Keywords' },
  { key: 'otherRules', label: 'Rules' },
]

function rulesOf(template) {
  return {
    title: template.aiRules?.title || '',
    description: template.aiRules?.description || '',
    keyword: template.aiRules?.keyword || '',
    otherRules: template.aiRules?.otherRules || '',
  }
}

// One row in the Template Settings list — beyond View/Edit/Delete, every
// row carries its own AI-rules mini-editor (Copy/Edit/Paste/Save with the
// same 4 fields as the wizard's Section 5) so a quick rules tweak doesn't
// need opening the full wizard, plus the isAllowedToShow visibility switch
// that gates whether this template shows in Auto Listing / Choose Your
// Template at all.
export default function TemplateSettingsRow({ template, onUpdated, onDeleted }) {
  const { addToast } = useToast()
  const [editingRules, setEditingRules] = useState(false)
  const [draft, setDraft] = useState(() => rulesOf(template))
  const [savingRules, setSavingRules] = useState(false)
  const [togglingVisibility, setTogglingVisibility] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const totalRows = Object.values(template.rowCounts || {}).reduce((sum, n) => sum + (n || 0), 0)
  const isUsed = totalRows > 0

  async function patchTemplate(body) {
    const res = await fetch(`/api/listing-tools/${template.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new Error(data?.error || 'Request failed')
    return data.template
  }

  function startEditRules() {
    setDraft(rulesOf(template))
    setEditingRules(true)
  }

  function handleCopyRules() {
    navigator.clipboard.writeText(JSON.stringify(rulesOf(template), null, 2))
    addToast('AI rules copied to clipboard.', 'success')
  }

  async function handlePasteRules() {
    try {
      const text = await navigator.clipboard.readText()
      const parsed = JSON.parse(text)
      setDraft((prev) => ({
        title: parsed.title ?? prev.title,
        description: parsed.description ?? prev.description,
        keyword: parsed.keyword ?? prev.keyword,
        otherRules: parsed.otherRules ?? prev.otherRules,
      }))
      addToast('Pasted from clipboard.', 'success')
    } catch {
      addToast('Clipboard doesn’t have copied rules to paste.', 'error')
    }
  }

  async function handleSaveRules() {
    setSavingRules(true)
    try {
      const updated = await patchTemplate({ aiRules: draft })
      addToast('AI rules saved.', 'success')
      setEditingRules(false)
      onUpdated(updated)
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setSavingRules(false)
    }
  }

  async function toggleVisibility() {
    setTogglingVisibility(true)
    const next = !template.isAllowedToShow
    try {
      const updated = await patchTemplate({ isAllowedToShow: next })
      onUpdated(updated)
      addToast(
        next
          ? `"${template.templateName}" activated — now visible in Auto Listing / Choose Your Template.`
          : `"${template.templateName}" deactivated — hidden from Auto Listing / Choose Your Template.`,
        'success',
      )
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setTogglingVisibility(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/listing-tools/${template.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Could not delete template')
      addToast('Template deleted', 'success')
      onDeleted(template.id)
    } catch (err) {
      addToast(err.message, 'error')
      setDeleting(false)
    }
  }

  return (
    <>
      <tr className="border-b border-divider last:border-b-0 hover:bg-surface/60">
        <td className="px-4 py-3 text-foreground font-medium">{template.templateName}</td>
        <td className="px-4 py-3 text-subtle">{template.description || '—'}</td>
        <td className="px-4 py-3 text-subtle">
          {template.marketplaceName || template.category ? `${template.marketplaceName || '—'} / ${template.category || '—'}` : '—'}
        </td>
        <td className="px-4 py-3">
          <button
            type="button"
            role="switch"
            aria-checked={!!template.isAllowedToShow}
            onClick={toggleVisibility}
            disabled={togglingVisibility}
            title={template.isAllowedToShow ? 'Visible in Auto Listing / Choose Your Template' : 'Hidden from Auto Listing / Choose Your Template'}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-80 ${
              template.isAllowedToShow ? 'bg-emerald-500' : 'bg-divider-light'
            }`}
          >
            {togglingVisibility ? (
              <Loader2 className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 animate-spin text-foreground" />
            ) : (
              <span
                className="inline-block h-3.5 w-3.5 rounded-full bg-card shadow-sm transition-transform"
                style={{ transform: template.isAllowedToShow ? 'translateX(18px)' : 'translateX(4px)' }}
              />
            )}
          </button>
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Link href={`/listing-tools/template-settings/${template.id}/details`}>
              <PillButton variant="view" icon={Eye}>View Details</PillButton>
            </Link>
            <Link href={`/listing-tools/template-settings/${template.id}`}>
              <PillButton variant="edit" icon={Pencil}>Edit</PillButton>
            </Link>
            <PillButton variant="ghost" icon={Copy} onClick={handleCopyRules}>Copy AI Rule</PillButton>
            <PillButton
              variant={editingRules ? 'edit' : 'ghost'}
              icon={editingRules ? X : Pencil}
              onClick={() => (editingRules ? setEditingRules(false) : startEditRules())}
            >
              {editingRules ? 'Cancel' : 'Edit Rules'}
            </PillButton>
            <PillButton variant="delete" icon={Trash2} onClick={() => setConfirmOpen(true)}>Delete</PillButton>
          </div>
        </td>
      </tr>

      {editingRules && (
        <tr>
          <td colSpan={5} className="bg-surface px-4 py-4">
            <div className="rounded-lg border border-divider bg-card p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11.5px] font-semibold text-muted">Edit AI Rules for &quot;{template.templateName}&quot;</p>
                <div className="flex items-center gap-2">
                  <PillButton variant="ghost" icon={ClipboardPaste} onClick={handlePasteRules}>Paste Rules</PillButton>
                  <PillButton variant="upload" icon={Check} loading={savingRules} onClick={handleSaveRules}>Save Rules</PillButton>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {EDIT_FIELDS.map((f) => (
                  <div key={f.key}>
                    <label className="block text-[11px] font-semibold text-subtle uppercase tracking-wide mb-1">{f.label}</label>
                    <input
                      value={draft[f.key]}
                      onChange={(e) => setDraft((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      className="w-full px-2.5 py-2 text-[13px] border border-divider rounded-md focus:outline-none focus:ring-1 focus:ring-accent-light"
                    />
                  </div>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={`Delete "${template.templateName}"?`}
        description={
          isUsed
            ? `This template has been used — ${totalRows} row${totalRows === 1 ? '' : 's'} of real product data exist across its sheets. Deleting it permanently deletes that data too. This can't be undone.`
            : "This template hasn't been used yet (no product rows filled in). This can't be undone."
        }
        confirmText={isUsed ? template.templateName : undefined}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}
