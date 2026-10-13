import { COMPANY_EMAIL, COMPANY_NAME } from './company';

// Copy for the Coming Soon screen (components/coming-soon) — shown in place of
// every page while the gate in lib/comingSoon.js is on.
export const comingSoon = {
  company: COMPANY_NAME,
  product: 'Auto Listing',
  status: 'Launching soon',
  badge: 'Coming soon',
  headline: 'Marketplace listings,',
  headlineAccent: 'filled in for you.',
  intro:
    'Pick a marketplace template, add your product details once, and Auto Listing completes the sheet — ready to upload. We’re putting the finishing touches on it.',

  // `icon` is a lucide-react name — see the ICONS map in ComingSoon.jsx.
  features: [
    { icon: 'LayoutTemplate',  title: 'Marketplace templates', desc: 'Start from the exact sheet each marketplace asks for.' },
    { icon: 'WandSparkles',    title: 'AI auto-fill',          desc: 'Titles and attributes written from your product details.' },
    { icon: 'Images',          title: 'Bulk images',           desc: 'Drop in a batch of photos and they fill the image columns in order.' },
    { icon: 'FileSpreadsheet', title: 'Excel export',          desc: 'Download the finished sheet, ready for the marketplace.' },
  ],

  contactLabel: 'Questions? Write to us',
  contactEmail: COMPANY_EMAIL,

  // The animated sheet on the right (SheetPreview.jsx).
  preview: {
    fileName: 'listing-template.xlsx',
    chip: 'AI filling',
    columns: ['SKU', 'Title', 'Brand', 'Colour', 'Price'],
    imagesLabel: 'Images added',
    exportLabel: 'Export',
  },
};
