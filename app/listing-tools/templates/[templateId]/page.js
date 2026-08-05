'use client'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Download, UploadCloud, Loader2 } from 'lucide-react'
import PillButton from '@/components/listing/PillButton'
import SheetTabs from '@/components/listing/SheetTabs'
import SheetGrid from '@/components/listing/SheetGrid'
import useTemplateExport from '@/components/listing/useTemplateExport'
import BillingGateModal from '@/components/billing/BillingGateModal'
import { importIntoBestMatchingGroup } from '@/components/listing/parseUploadedSheet'
import { useToast } from '@/components/admin/Toast'
import useDebouncedCallback from '@/hooks/useDebouncedCallback'

// The single-template workspace — every non-Design-System sheet visible and
// editable on one screen at once, each block with its own independent
// group tab-strip (matches the source screenshot's stacked layout).
const STACK_GROUPS = ['compulsory', 'prefill', 'optional']

export default function TemplateWorkspacePage() {
  const { templateId } = useParams()
  const { addToast } = useToast()
  const [template, setTemplate] = useState(null)
  const [content, setContent] = useState(null)
  const [blockGroups, setBlockGroups] = useState(STACK_GROUPS)
  const [uploading, setUploading] = useState(false)
  const uploadInputRef = useRef(null)
  const { exporting, gate, closeGate, runExport } = useTemplateExport(templateId)

  useEffect(() => {
    fetch(`/api/listing-tools/${templateId}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { setTemplate(d.template); setContent(d.content) })
  }, [templateId])

  const saveGroup = useDebouncedCallback(async (group, headers, rows) => {
    const res = await fetch(`/api/listing-tools/${templateId}/sheets/${group}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ headers, rows }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      addToast(data.message || 'Could not save changes', 'error')
    }
  }, 1000)

  function handleRowsChange(group, nextRows) {
    setContent((prev) => ({ ...prev, sheets: prev.sheets.map((s) => (s.group === group ? { ...s, rows: nextRows } : s)) }))
    const sheet = content.sheets.find((s) => s.group === group)
    saveGroup(group, sheet.headers, nextRows)
  }

  async function handleUploadOldSheet(file) {
    if (!file || !content) return
    setUploading(true)
    try {
      const result = await importIntoBestMatchingGroup(file, content.sheets.filter((s) => STACK_GROUPS.includes(s.group)))
      if (!result) {
        addToast("Couldn't match that file's columns to any sheet in this template.", 'error')
        return
      }
      handleRowsChange(result.group, result.rows)
      addToast(`Updated the ${result.group.replace('_', ' ')} sheet from that file.`, 'success')
    } catch {
      addToast('Could not read that file — is it a valid .xlsx?', 'error')
    } finally {
      setUploading(false)
    }
  }

  if (!content) {
    return <div className="min-h-full bg-gray-50 flex items-center justify-center"><Loader2 className="w-6 h-6 text-indigo-500 animate-spin" /></div>
  }

  return (
    <div className="min-h-full bg-gray-50 px-6 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">{template?.templateName}</h1>
          {template?.description && <p className="text-[13px] text-gray-500">{template.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <PillButton variant="upload" icon={UploadCloud} loading={uploading} onClick={() => uploadInputRef.current?.click()}>
            Upload Old Sheet
          </PillButton>
          <input
            ref={uploadInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => { handleUploadOldSheet(e.target.files?.[0]); e.target.value = '' }}
          />
          <PillButton
            variant="download"
            icon={Download}
            loading={exporting}
            onClick={() => runExport({ template: content, groups: ['design_system', 'compulsory', 'prefill', 'optional'], format: 'excel', meta: template })}
          >
            Download Final Sheet
          </PillButton>
        </div>
      </div>

      {blockGroups.map((group, blockIndex) => {
        const sheet = content.sheets.find((s) => s.group === group)
        if (!sheet) return null
        return (
          <div key={blockIndex} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
            <SheetTabs
              variant="dark"
              active={group}
              onChange={(g) => setBlockGroups((prev) => prev.map((x, i) => (i === blockIndex ? g : x)))}
            />
            <SheetGrid
              headers={sheet.headers}
              rows={sheet.rows}
              onRowsChange={(rows) => handleRowsChange(group, rows)}
              uploadUrl={`/api/listing-tools/${templateId}/images`}
            />
          </div>
        )
      })}

      <BillingGateModal
        gate={gate}
        onClose={closeGate}
        onRetry={() => runExport({ template: content, groups: ['design_system', 'compulsory', 'prefill', 'optional'], format: 'excel', meta: template })}
      />
    </div>
  )
}
