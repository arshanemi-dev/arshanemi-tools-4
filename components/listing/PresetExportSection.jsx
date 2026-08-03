'use client'
import { Save, Check } from 'lucide-react'
import PillButton from './PillButton'
import { useToast } from '@/components/admin/Toast'

const labelCls = 'block text-[11.5px] font-semibold text-gray-600 mb-1'
const inputCls = 'w-full px-2.5 py-2 text-[13px] border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-400'

// Section 4 of Template Settings, matching source/11.html's "Preset & Export
// Configuration" single-line row pixel-for-pixel. marketplaceName/category/
// exportVersion are real fields on the template
// (lib/listingTemplates.js's createTemplateMeta) — value/onChange are lifted
// to the parent wizard so they ride along in the same POST as the rest of
// the template when the Save Template button (below, in the parent) fires.
// "Save Preset" doesn't persist anything on its own (no standalone endpoint
// for just this slice) — it calls onSave, which the parent keeps as the one
// current preset (saving again replaces it, never adds another), offered
// as a single entry in Section 5's template list.
export default function PresetExportSection({ value, onChange, onSave, currentPreset }) {
  const { addToast } = useToast()

  function set(key, v) {
    onChange({ ...value, [key]: v })
  }

  const finalName = `${value.marketplaceName || 'marketplace'}_${value.category || 'category'}_${value.exportVersion || 'v1.0'}`

  function handleSavePreset() {
    onSave(value)
    addToast(`Preset saved as "${finalName}".`, 'success')
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
        <h2 className="text-[13px] font-semibold text-gray-800">4. Preset &amp; Export Configuration</h2>
      </div>
      <div className="p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[150px]">
          <label className={labelCls}>Marketplace Name</label>
          <input value={value.marketplaceName} onChange={(e) => set('marketplaceName', e.target.value)} className={inputCls} />
        </div>

        <div className="flex-1 min-w-[150px]">
          <label className={labelCls}>Category</label>
          <input value={value.category} onChange={(e) => set('category', e.target.value)} className={inputCls} />
        </div>

        <div className="flex-1 min-w-[110px]">
          <label className={labelCls}>Version</label>
          <input value={value.exportVersion} onChange={(e) => set('exportVersion', e.target.value)} className={inputCls} />
        </div>

        <div className="flex-shrink-0">
          <PillButton variant="upload" icon={Save} onClick={handleSavePreset}>
            Save Preset
          </PillButton>
        </div>

        <div className="flex-[1.6] min-w-[220px]">
          <label className={labelCls}>Final Name</label>
          <input readOnly value={finalName} className={`${inputCls} bg-gray-50 font-semibold text-gray-700 cursor-default`} />
        </div>
      </div>

      {/* One badge for the one current preset — saving again replaces it,
          it never stacks into a list. */}
      {currentPreset && (
        <div className="px-4 pb-4 flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            <Check className="w-3 h-3" />
            Current preset: {currentPreset.marketplaceName || 'marketplace'} / {currentPreset.category || 'category'} / {currentPreset.exportVersion || 'v1.0'}
          </span>
        </div>
      )}
    </div>
  )
}
