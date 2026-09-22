import BulkTemplateDesign from '@/components/listing/BulkTemplateDesign'

export const metadata = {
  title: 'Bulk Listing — Listing Tools',
  robots: { index: false },
}

// ?templates=id1,id2,... — set by the template list page's "Edit Bulk
// Listing" toolbar button (enabled once 2+ templates are checkbox-selected
// there). No query at all = a fresh Create Bulk Listing with nothing
// pre-loaded. See BulkTemplateDesign.jsx for how templateIds drives the
// sidebar/active-template state.
export default async function BulkTemplateSettingsPage({ searchParams }) {
  const { templates } = await searchParams
  const templateIds = templates ? templates.split(',').map((s) => s.trim()).filter(Boolean) : []
  return (
    <div className="min-h-full bg-surface">
      <BulkTemplateDesign templateIds={templateIds} />
    </div>
  )
}
