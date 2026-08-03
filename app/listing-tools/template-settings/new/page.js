import TemplateSettingsWizard from '@/components/listing/TemplateSettingsWizard'

export const metadata = {
  title: 'Create Template — Listing Tools',
  robots: { index: false },
}

export default function NewTemplateSettingsPage() {
  return (
    <div className="min-h-full bg-gray-50">
      <TemplateSettingsWizard />
    </div>
  )
}
