export const COLOR_GROUPS = [
  {
    label: 'Backgrounds & Surfaces',
    keys: ['background', 'surface', 'card', 'card-hover'],
  },
  {
    label: 'Borders',
    keys: ['divider', 'divider-light'],
  },
  {
    label: 'Text',
    keys: ['foreground', 'muted', 'subtle'],
  },
  {
    label: 'Brand & Accent',
    keys: ['accent', 'accent-hover', 'accent-light', 'accent-vivid', 'cyan'],
  },
  {
    label: 'Prose & Headings',
    keys: ['heading-3', 'heading-4', 'prose-quote', 'link-hover', 'code-bg'],
  },
]

export const COLOR_LABELS = {
  background:      'Page Background',
  surface:         'Section Surface',
  card:            'Card',
  'card-hover':    'Card Hover',
  divider:         'Border',
  'divider-light': 'Border Light',
  foreground:      'Primary Text',
  muted:           'Muted Text',
  subtle:          'Subtle Text',
  accent:          'Accent',
  'accent-hover':  'Accent Hover',
  'accent-light':  'Accent Light',
  'accent-vivid':  'Accent Vivid',
  cyan:            'Cyan / Gradient End',
  'heading-3':     'H3 Heading',
  'heading-4':     'H4 Heading',
  'prose-quote':   'Blockquote',
  'link-hover':    'Link Hover',
  'code-bg':       'Code Background',
}

export const FONT_OPTIONS = [
  { value: 'System',            label: 'System (Apple)',      weights: null },
  { value: 'Inter',             label: 'Inter',              weights: '300;400;500;600;700;800' },
  { value: 'Poppins',           label: 'Poppins',            weights: '300;400;500;600;700;800' },
  { value: 'Plus Jakarta Sans', label: 'Plus Jakarta Sans',  weights: '300;400;500;600;700;800' },
  { value: 'DM Sans',           label: 'DM Sans',            weights: '300;400;500;600;700' },
  { value: 'Nunito',            label: 'Nunito',             weights: '300;400;500;600;700;800' },
  { value: 'Outfit',            label: 'Outfit',             weights: '300;400;500;600;700' },
  { value: 'Raleway',           label: 'Raleway',            weights: '300;400;500;600;700;800' },
  { value: 'Manrope',           label: 'Manrope',            weights: '300;400;500;600;700;800' },
  { value: 'Roboto',            label: 'Roboto',             weights: '300;400;500;700' },
  { value: 'Open Sans',         label: 'Open Sans',          weights: '300;400;500;600;700' },
]

export const RADIUS_PRESETS = {
  sharp: {
    label: 'Sharp',
    values: { sm: '1px', base: '2px', md: '3px', lg: '4px', xl: '6px', '2xl': '8px' },
  },
  default: {
    label: 'Default',
    values: { sm: '2px', base: '4px', md: '6px', lg: '8px', xl: '12px', '2xl': '16px' },
  },
  rounded: {
    label: 'Rounded',
    values: { sm: '6px', base: '8px', md: '10px', lg: '14px', xl: '20px', '2xl': '28px' },
  },
  pill: {
    label: 'Pill',
    values: { sm: '999px', base: '999px', md: '999px', lg: '999px', xl: '999px', '2xl': '999px' },
  },
}

export const SCALE_MARKS = [
  { value: 0.8,  label: '80%' },
  { value: 0.9,  label: '90%' },
  { value: 1.0,  label: '100%' },
  { value: 1.1,  label: '110%' },
  { value: 1.2,  label: '120%' },
  { value: 1.3,  label: '130%' },
]
