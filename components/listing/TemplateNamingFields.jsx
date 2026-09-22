'use client'

// Shared input style + label wrapper — also used directly by the bulk
// mapping page's own grids (Task 3: same UI components, not a re-styled
// copy).
export const inputCls =
  'w-full h-[38px] rounded-md border border-[#d7dce2] bg-background px-2.5 text-[14px] text-foreground outline-none focus:border-[#9dbfe8] placeholder:text-subtle'

export function Field({ label, className = '', children }) {
  return (
    <div className={`min-w-0 px-1.5 ${className}`}>
      <label className="my-1.5 block truncate text-[14.5px] text-muted">{label}</label>
      {children}
    </div>
  )
}

function cat(categoriesData, n) {
  return categoriesData[`category${n}`] || ''
}

// Both composed names join with "_". Save Final Name also appends the
// Version at the very end (marketplace_cat1…cat6_version). Pure — exported
// so callers can compose the same names for their save payload without
// re-deriving the logic (see NewTemplateDesign.jsx's saveTemplate and the
// bulk page's own save flow).
export function composeFinalName(presetData, categoriesData) {
  return [presetData.marketplaceName, cat(categoriesData, 1), cat(categoriesData, 2), cat(categoriesData, 3), cat(categoriesData, 4), cat(categoriesData, 5), cat(categoriesData, 6), presetData.exportVersion]
    .map((s) => (s || '').trim())
    .filter(Boolean)
    .join('_')
}

// Create mode: Template Name is composed automatically from Marketplace +
// Category 6 ("Meesho_Blouses") and is read-only; edit mode keeps the saved
// name editable instead (Category 6 isn't persisted, so it can't be
// recomposed on reload).
export function composeAutoTemplateName(presetData, categoriesData) {
  return [presetData.marketplaceName, cat(categoriesData, 6)]
    .map((s) => (s || '').trim())
    .filter(Boolean)
    .join('_')
}

// Marketplace/Category1-6/Version/Save Final Name/Template Name/Template
// No/Description — the template-naming form shared by NewTemplateDesign.jsx
// (single-sheet Create/Edit Template) and the bulk mapping page.
export default function TemplateNamingFields({
  isEditMode,
  presetData,
  setPresetData,
  categoriesData,
  setCategoriesData,
  templateNameInput,
  setTemplateNameInput,
  templateNumber,
  currentPreset,
}) {
  const setCat = (n, v) => setCategoriesData({ ...categoriesData, [`category${n}`]: v })
  const setPreset = (k, v) => setPresetData({ ...presetData, [k]: v })
  const finalName = composeFinalName(presetData, categoriesData)
  const autoTemplateName = composeAutoTemplateName(presetData, categoriesData)

  return (
    <div className="rounded-[7px] border border-divider p-3">
      <div className="flex flex-wrap">
        <Field label="Marketplace Name" className="flex-[1_1_170px]">
          <input
            className={inputCls}
            placeholder="Meesho"
            value={presetData.marketplaceName || ''}
            onChange={(e) => setPreset('marketplaceName', e.target.value)}
          />
        </Field>
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <Field key={n} label={`Category ${n}`} className="flex-[1_1_170px]">
            <input className={inputCls} value={cat(categoriesData, n)} onChange={(e) => setCat(n, e.target.value)} />
          </Field>
        ))}
        <Field label="Version" className="flex-[0_1_105px]">
          <input
            className={inputCls}
            placeholder="v1.0"
            value={presetData.exportVersion || ''}
            onChange={(e) => setPreset('exportVersion', e.target.value)}
          />
        </Field>
      </div>

      <div className="flex flex-wrap">
        <Field label="Save Final Name" className="flex-[5_1_260px]">
          <input
            readOnly
            className={`${inputCls} bg-surface font-semibold text-muted`}
            value={finalName}
            placeholder="marketplace_category_version"
          />
        </Field>
        <Field label="Template Name" className="flex-[2.4_1_170px]">
          {isEditMode ? (
            <input
              className={inputCls}
              placeholder="Meesho_Blouses"
              value={templateNameInput}
              onChange={(e) => setTemplateNameInput(e.target.value)}
            />
          ) : (
            <input
              readOnly
              title="Auto — Marketplace + Category 6"
              className={`${inputCls} bg-surface font-semibold text-muted`}
              placeholder="Marketplace_Category 6"
              value={autoTemplateName}
            />
          )}
        </Field>
        <Field label="Template No" className="flex-[0.95_1_110px]">
          <input
            readOnly
            disabled
            title="Assigned automatically on save — not editable"
            className={`${inputCls} bg-surface font-semibold text-muted`}
            value={templateNumber || 'On save'}
          />
        </Field>
        <Field label="Description" className="flex-[6_1_200px]">
          <input
            className={inputCls}
            placeholder="Other"
            value={presetData.description || ''}
            onChange={(e) => setPreset('description', e.target.value)}
          />
        </Field>
      </div>

      {currentPreset && (
        <p className="mt-1.5 px-1.5 text-[12px] text-emerald-600">
          Preset saved: {currentPreset.marketplaceName || 'marketplace'} /{' '}
          {currentPreset.category1 || 'category'} / {currentPreset.exportVersion || 'v1.0'}
        </p>
      )}
    </div>
  )
}
