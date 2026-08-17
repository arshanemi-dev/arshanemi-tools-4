import TemplateSettingsWizard from '@/components/listing/TemplateSettingsWizard'

export const metadata = {
  title: 'Edit Template — Listing Tools',
  robots: { index: false },
}

export default async function EditTemplateSettingsPage({ params }) {
  const { templateId } = await params
  return (
    <div className="min-h-full bg-surface">
      <TemplateSettingsWizard templateId={templateId} />
    </div>
  )
}
