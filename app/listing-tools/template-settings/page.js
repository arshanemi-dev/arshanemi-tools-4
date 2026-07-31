import TemplateSettingsWizard from '@/components/listing/TemplateSettingsWizard'

export const metadata = {
  title: 'Template Settings — Listing Tools',
  robots: { index: false },
}

export default function TemplateSettingsPage() {
  return (
    <div className="min-h-full bg-gray-50">
      <TemplateSettingsWizard />
    </div>
  )
}
