'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2, Eye, Pencil, Copy, Check, X, Trash2, ClipboardPaste, CornerDownRight } from 'lucide-react'
import PillButton from '@/components/listing/PillButton'
import TemplateBadge from '@/components/listing/TemplateBadge'
import EditTemplateNamesModal from '@/components/listing/EditTemplateNamesModal'
import ConfirmDialog from '@/components/admin/ConfirmDialog'
import { useToast } from '@/components/admin/Toast'
import { fmtDate, fmtDateTime, versionLabelOf } from '@/lib/templateLogActions'

export const EDIT_FIELDS = [
  { key: 'title', label: 'Title' },
  { key: 'description', label: 'Description' },
  { key: 'keyword', label: 'Keywords' },
  { key: 'otherRules', label: 'Rules' },
  { key: 'rule1', label: 'Rule-1' },
  { key: 'rule2', label: 'Rule-2' },
]

function rulesOf(source) {
  return Object.fromEntries(EDIT_FIELDS.map((f) => [f.key, source.aiRules?.[f.key] || '']))
}

function latestOf(...isos) {
  return isos.filter(Boolean).reduce((a, b) => (new Date(b) > new Date(a) ? b : a), null)
}

function Switch({ on, busy, onClick, title }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!on}
      onClick={onClick}
      disabled={busy}
      title={title}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-80 ${
        on ? 'bg-emerald-500' : 'bg-divider-light'
      }`}
    >
      {busy ? (
        <Loader2 className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 animate-spin text-foreground" />
      ) : (
        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-card shadow-sm transition-transform ${on ? 'translate-x-[18px]' : 'translate-x-1'}`} />
      )}
    </button>
  )
}

function DateCell({ iso, muted }) {
  return (
    <td className={`px-3 py-3 whitespace-nowrap text-[12.5px] ${muted ? 'text-subtle' : 'text-muted'}`} title={iso ? fmtDateTime(iso) : undefined}>
      {fmtDate(iso)}
    </td>
  )
}

// One row of the Template Settings list = one version of a template (or the
// template itself, when it has no versions yet). A template's versions sit
// together, newest first: the first ("head") row carries every
// template-level control — selection, Visible, Edit Name/Rules, Delete —
// and shows the template as it stands now, since that's what those
// controls edit. Older version rows show what that version captured at
// save time (snapshot.meta; versions saved before meta was captured fall
// back to the template's current values) and only offer version-level
// actions, so e.g. Delete on an old version row can never be mistaken for
// deleting the whole template.
export default function TemplateSettingsListRow({
  template, version = null, isHead = true, isLastInGroup = true,
  isSelected, onToggleSelect, onUpdated, onDeleted, onToggleLive, liveBusy = false,
}) {
  const { addToast } = useToast()
  const [editingRules, setEditingRules] = useState(false)
  const [draft, setDraft] = useState(() => rulesOf(template))
  const [descDraft, setDescDraft] = useState(() => template.description || '')
  const [savingRules, setSavingRules] = useState(false)
  const [togglingVisibility, setTogglingVisibility] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editNamesOpen, setEditNamesOpen] = useState(false)

  const isChild = !isHead
  const source = isChild && version?.meta
    ? { ...template, ...version.meta, aiRules: version.meta.aiRules || template.aiRules }
    : template
  const totalRows = Object.values(template.rowCounts || {}).reduce((sum, n) => sum + (n || 0), 0)
  const isUsed = totalRows > 0

  // The head row is also where template-level edits land, so its Updated
  // date reflects those too, not just the version's own rename/live events.
  const createdAt = version ? version.createdAt : template.createdAt
  const updatedAt = !version ? template.updatedAt : isHead ? latestOf(version.updatedAt, template.updatedAt) : version.updatedAt

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
    setDescDraft(template.description || '')
    setEditingRules(true)
  }

  function cancelEditRules() {
    setDraft(rulesOf(template))
    setDescDraft(template.description || '')
    setEditingRules(false)
  }

  // On an older version row this copies THAT version's rules — paste them
  // into the head row's Edit Rules to bring an earlier rule set back.
  function handleCopyRules() {
    navigator.clipboard.writeText(JSON.stringify(rulesOf(source), null, 2))
    addToast(isChild ? `${versionLabelOf(version)} AI rules copied to clipboard.` : 'AI rules copied to clipboard.', 'success')
  }

  async function handlePasteRules() {
    try {
      const parsed = JSON.parse(await navigator.clipboard.readText())
      setDraft((prev) => Object.fromEntries(EDIT_FIELDS.map((f) => [f.key, parsed[f.key] ?? prev[f.key]])))
      addToast('Pasted from clipboard.', 'success')
    } catch {
      addToast('Clipboard doesn’t have copied rules to paste.', 'error')
    }
  }

  async function handleSaveRules() {
    setSavingRules(true)
    try {
      const updated = await patchTemplate({ aiRules: draft, description: descDraft })
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

  const rowCls = [
    'hover:bg-surface/60',
    isLastInGroup ? 'border-b border-divider last:border-b-0' : 'border-b border-dashed border-divider/70',
    isChild ? 'bg-surface/40' : '',
    isHead && isSelected ? 'bg-accent/6' : '',
  ].join(' ')
  const cellText = isChild ? 'text-subtle' : 'text-muted'
  const inputCls = 'w-full px-2 py-1 text-[12.5px] border border-divider rounded focus:outline-none focus:ring-1 focus:ring-accent-light bg-card'
  const detailsHref = `/listing-tools/template-settings/${template.id}/details`

  return (
    <>
      <tr className={rowCls}>
        <td className="px-3 py-3 text-center">
          {isHead ? (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => onToggleSelect(template.id, e.target.checked)}
              className="w-4 h-4 text-accent rounded border-divider-light focus:ring-accent cursor-pointer"
            />
          ) : (
            <CornerDownRight className="mx-auto h-3.5 w-3.5 text-subtle/70" aria-label="Older version of the template above" />
          )}
        </td>
        <td className="px-3 py-3">
          {isHead && (
            <Switch
              on={template.isAllowedToShow}
              busy={togglingVisibility}
              onClick={toggleVisibility}
              title={template.isAllowedToShow ? 'Visible in Auto Listing / Choose Your Template' : 'Hidden from Auto Listing / Choose Your Template'}
            />
          )}
        </td>

        <td className={`px-3 py-3 font-mono whitespace-nowrap ${isChild ? 'text-subtle/70' : 'text-subtle'}`}>{template.templateNumber || '—'}</td>

        <td className="px-3 py-3 whitespace-nowrap">
          {version ? (
            <span className="inline-flex items-center gap-1.5" title={`Version ${version.versionNumber}`}>
              <span className={`font-mono text-[12.5px] font-semibold ${isChild ? 'text-muted' : 'text-foreground'}`}>
                {versionLabelOf(version)}
              </span>
              {version.isLive && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live
                </span>
              )}
            </span>
          ) : (
            <span className="text-[12px] italic text-subtle">No versions</span>
          )}
        </td>

        <td className={`px-3 py-3 font-medium whitespace-nowrap ${isChild ? 'text-muted' : 'text-foreground'}`}>
          <span className="inline-flex items-center gap-1.5">
            {source.templateName}
            {isHead && <TemplateBadge badge={template.viewerBadge} />}
          </span>
        </td>
        <td className="px-3 py-3 text-subtle font-mono text-[12.5px] max-w-[220px]">
          <span className="block truncate" title={source.finalName || '—'}>{source.finalName || '—'}</span>
        </td>

        <DateCell iso={createdAt} muted={isChild} />
        <DateCell iso={updatedAt} muted={isChild} />
        <td className="px-3 py-3 whitespace-nowrap">
          {version ? (
            <div className="flex items-center gap-2">
              <Switch
                on={version.isLive}
                busy={liveBusy}
                onClick={() => onToggleLive(template, version)}
                title={version.isLive ? 'Live — click to take this version offline' : 'Make this version live (the current live version goes offline)'}
              />
              <span
                className={`text-[12.5px] ${version.isLive ? 'font-medium text-emerald-600' : 'text-subtle'}`}
                title={version.liveAt ? `Last went live ${fmtDateTime(version.liveAt)}` : 'Never been live'}
              >
                {fmtDate(version.liveAt)}
              </span>
            </div>
          ) : (
            <span className="text-subtle">—</span>
          )}
        </td>

        <td className={`px-3 py-3 max-w-[180px] ${cellText}`}>
          {editingRules ? (
            <input type="text" value={descDraft} onChange={(e) => setDescDraft(e.target.value)} placeholder="Template description" className={inputCls} />
          ) : (
            <span className="block truncate" title={source.description}>{source.description || '—'}</span>
          )}
        </td>

        {EDIT_FIELDS.map((field) => {
          const value = editingRules ? draft[field.key] : source.aiRules?.[field.key]
          return (
            <td key={field.key} className="px-2 py-3">
              {editingRules ? (
                <input
                  type="text"
                  value={value || ''}
                  onChange={(e) => setDraft((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  className={inputCls}
                />
              ) : (
                <span className={`block max-w-[140px] truncate text-[12.5px] ${cellText}`} title={value || '—'}>
                  {value || '—'}
                </span>
              )}
            </td>
          )
        })}

        <td className="px-3 py-3">
          <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
            {isChild ? (
              <>
                <Link href={`${detailsHref}?tab=versions`}>
                  <PillButton variant="ghost" icon={Eye} title="Open this template's Versions tab">View</PillButton>
                </Link>
                <PillButton variant="ghost" icon={Copy} onClick={handleCopyRules} title={`Copy ${versionLabelOf(version)}'s AI rules`}>
                  Copy Rules
                </PillButton>
              </>
            ) : editingRules ? (
              <>
                <PillButton variant="upload" icon={Check} loading={savingRules} onClick={handleSaveRules}>Save</PillButton>
                <PillButton variant="ghost" icon={ClipboardPaste} onClick={handlePasteRules}>Paste</PillButton>
                <PillButton variant="ghost" icon={X} onClick={cancelEditRules}>Cancel</PillButton>
              </>
            ) : (
              <>
                <Link href={detailsHref}>
                  <PillButton variant="view" icon={Eye}>View</PillButton>
                </Link>
                <PillButton variant="ghost" icon={Pencil} onClick={() => setEditNamesOpen(true)} title="Edit the Template Name and Template Final Name">
                  Edit Name
                </PillButton>
                <PillButton variant="ghost" icon={Pencil} onClick={startEditRules}>Edit Rules</PillButton>
                <PillButton variant="ghost" icon={Copy} onClick={handleCopyRules}>Copy Rules</PillButton>
                <PillButton variant="delete" icon={Trash2} onClick={() => setConfirmOpen(true)}>Delete</PillButton>
              </>
            )}
          </div>
        </td>
      </tr>

      {isHead && (
        <ConfirmDialog
          open={confirmOpen}
          title={`Delete "${template.templateName}"?`}
          description={
            isUsed
              ? `This template has been used — ${totalRows} row${
                  totalRows === 1 ? '' : 's'
                } of real product data exist across its sheets. Deleting it permanently deletes that data too. This can't be undone.`
              : "This template hasn't been used yet (no product rows filled in). This can't be undone."
          }
          confirmText={isUsed ? template.templateName : undefined}
          confirmLabel="Delete"
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setConfirmOpen(false)}
        />
      )}

      {isHead && editNamesOpen && (
        <EditTemplateNamesModal template={template} onClose={() => setEditNamesOpen(false)} onSaved={onUpdated} />
      )}
    </>
  )
}
