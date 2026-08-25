'use client'
import { Save, Check } from 'lucide-react'
import PillButton from './PillButton'
import { useToast } from '@/components/admin/Toast'

const labelCls = 'block text-[11.5px] font-semibold text-muted mb-1'
const inputCls = 'w-full px-2.5 py-2 text-[13px] border border-divider rounded-md focus:outline-none focus:ring-1 focus:ring-accent-light'
const readOnlyInputCls = `${inputCls} bg-surface font-semibold text-muted cursor-default`

// Section 4 of Template Settings. Three rows:
//  - Template Number (auto-assigned, read-only) / Template Name / Version / Description — the
//    template's own core identity. Template Name is a real, independently-typed field (no longer
//    derived from anything below); Template Number is set once at creation
//    (lib/listingTemplates.js's nextTemplateNumber) and can never be edited here or anywhere else.
//  - Category 1-4 — free-text categorization, e.g. a category tree's levels.
//  - Marketplace Name / Save Preset / Final Name — unchanged from before: a separate, purely
//    informational marketplace_category1_version preview (see finalName below), matching
//    lib/listingTemplates.js's own `finalName` field. "Save Preset" doesn't persist anything on
//    its own (no standalone endpoint for just this slice) — it calls onSave, which the parent
//    keeps as the one current preset (saving again replaces it, never adds another), offered as a
//    single entry in Section 5's template list.
//
// All values/onChange are lifted to the parent wizard so they ride along in the same POST/PATCH
// as the rest of the template when Save Template/Save Changes (below, in the parent) fires.
export default function PresetExportSection({
  value, onChange, categories, onCategoriesChange, templateName, onTemplateNameChange, templateNumber, onSave, currentPreset,
}) {
  const { addToast } = useToast()

  function set(key, v) {
    onChange({ ...value, [key]: v })
  }
  function setCategory(key, v) {
    onCategoriesChange({ ...categories, [key]: v })
  }

  const finalName = `${value.marketplaceName || 'marketplace'}_${categories.category1 || 'category'}_${value.exportVersion || 'v1.0'}`

  function handleSavePreset() {
    onSave({ ...value, category1: categories.category1 })
    addToast(`Preset saved as "${finalName}".`, 'success')
  }

  return (
    <div className="border border-divider rounded-lg overflow-hidden bg-card">
      <div className="px-4 py-2.5 bg-surface border-b border-divider">
        <h2 className="text-[13px] font-semibold text-foreground">4. Template Details &amp; Export Configuration</h2>
      </div>

      <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 border-b border-divider">
        <div>
          <label className={labelCls}>Template Number</label>
          <input readOnly value={templateNumber || 'Assigned on save'} className={readOnlyInputCls} title="Assigned automatically once — cannot be edited" />
        </div>
        <div>
          <label className={labelCls}>Template Name</label>
          <input value={templateName} onChange={(e) => onTemplateNameChange(e.target.value)} className={inputCls} placeholder="e.g. Meesho Blouse Listing" />
        </div>
        <div>
          <label className={labelCls}>Version</label>
          <input value={value.exportVersion} onChange={(e) => set('exportVersion', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Description</label>
          <input value={value.description} onChange={(e) => set('description', e.target.value)} className={inputCls} />
        </div>
      </div>

      <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 border-b border-divider">
        <div>
          <label className={labelCls}>Category 1</label>
          <input value={categories.category1} onChange={(e) => setCategory('category1', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Category 2</label>
          <input value={categories.category2} onChange={(e) => setCategory('category2', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Category 3</label>
          <input value={categories.category3} onChange={(e) => setCategory('category3', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Category 4</label>
          <input value={categories.category4} onChange={(e) => setCategory('category4', e.target.value)} className={inputCls} />
        </div>
      </div>

      <div className="p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[140px]">
          <label className={labelCls}>Marketplace Name</label>
          <input value={value.marketplaceName} onChange={(e) => set('marketplaceName', e.target.value)} className={inputCls} />
        </div>

        <div className="flex-shrink-0">
          <PillButton variant="upload" icon={Save} onClick={handleSavePreset}>
            Save Preset
          </PillButton>
        </div>

        <div className="flex-[1.6] min-w-[220px]">
          <label className={labelCls}>Final Name</label>
          <input readOnly value={finalName} className={readOnlyInputCls} />
        </div>
      </div>

      {/* One badge for the one current preset — saving again replaces it,
          it never stacks into a list. */}
      {currentPreset && (
        <div className="px-4 pb-4 flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            <Check className="w-3 h-3" />
            Current preset: {currentPreset.marketplaceName || 'marketplace'} / {currentPreset.category1 || 'category'} / {currentPreset.exportVersion || 'v1.0'}
          </span>
        </div>
      )}
    </div>
  )
}
