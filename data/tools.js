export const toolCategories = [
  { id: 'research',    label: 'Research Tools' },
  { id: 'analytics',  label: 'Analytics Tools' },
  { id: 'listing',    label: 'Listing Tools' },
  { id: 'embedded',   label: 'Embedded Tools' },
];

export const tools = [

  {
    slug: 'pdf-cropper',
    title: 'PDF Cropper',
    icon: 'Crop',
    shortDesc: 'Batch crop, trim margins, and resize PDF pages with pixel precision — no software, no uploads.',
    category: 'embedded',
    badge: 'Free',
    toolUrl: 'https://pdf-cropper.freelax.in/',
    requiresLogin: false,
    features: [
      { icon: 'Crop',       title: 'Pixel-Precise Cropping', desc: 'Drag a crop box or enter exact margins in mm/inches — every page is trimmed to the same precision every time.' },
      { icon: 'Layers',     title: 'Batch Processing',       desc: 'Crop hundreds of pages across multiple PDFs in one pass instead of opening each file individually.' },
      { icon: 'Eye',        title: 'Live Preview',           desc: 'See the exact crop applied to every page before you export — no surprises, no re-dos.' },
      { icon: 'Lock',       title: 'Runs in Your Browser',   desc: 'Files are processed locally — nothing is uploaded to a server, so sensitive documents never leave your device.' },
      { icon: 'Grid',       title: 'Auto-Detect Margins',    desc: 'One click scans the page content and suggests the tightest possible crop automatically.' },
      { icon: 'Download',   title: 'Instant Export',         desc: 'Download your cropped PDF immediately — no waiting, no email links, no processing queue.' },
    ],
    hero: {
      headline: 'Crop Every Page. Perfectly. Every Time.',
      subtext: 'Upload a PDF, set your crop once, and apply it across every page in seconds — all inside your browser, with nothing ever leaving your device.',
    },
    stats: [
      { value: '10K+',  label: 'Pages Cropped Weekly' },
      { value: '100%',  label: 'Client-Side & Private' },
      { value: '<5 sec', label: 'Avg. Processing Time' },
      { value: 'Free',  label: 'Full Access, No Signup' },
    ],
    steps: [
      { step: '01', title: 'Upload Your PDF',    desc: 'Drag and drop any PDF file — multi-page documents are fully supported.' },
      { step: '02', title: 'Set the Crop Area',  desc: 'Drag the crop handles or enter exact margin values for pixel-precise trimming.' },
      { step: '03', title: 'Preview Every Page', desc: 'Scroll through a live preview to confirm the crop looks right on every page.' },
      { step: '04', title: 'Apply to All Pages', desc: 'Apply your crop settings to the entire document, or select specific page ranges.' },
      { step: '05', title: 'Download Instantly', desc: 'Export your cropped PDF in seconds — ready to print, share, or archive.' },
    ],
    advantages: [
      { icon: 'Clock',  title: 'Save hours of manual editing', desc: 'What used to take page-by-page editing in Acrobat now takes one pass across the whole document.' },
      { icon: 'Lock',   title: 'Nothing leaves your device',   desc: 'All cropping happens locally in your browser — no server uploads, no privacy risk.' },
      { icon: 'Layers', title: 'Consistent results every time', desc: 'Batch crop guarantees every page is trimmed identically — no manual drift between pages.' },
    ],
    faqs: [
      { question: 'Is my PDF uploaded to a server?',  answer: 'No — PDF Cropper processes everything locally in your browser. Your file never leaves your device.' },
      { question: 'Can I crop specific pages only?',  answer: 'Yes — apply your crop to the whole document or a custom page range.' },
      { question: 'Is there a file size limit?',      answer: 'Most PDFs up to a few hundred MB work smoothly since processing happens on your own device.' },
    ],
  },

  {
    slug: 'bg-remover',
    title: 'Background Remover',
    icon: 'Sparkles',
    shortDesc: 'AI-powered background removal for product photos and portraits — export transparent PNGs in seconds.',
    category: 'embedded',
    badge: 'AI-Powered',
    toolUrl: 'https://bg-remover.freelax.in/',
    requiresLogin: false,
    features: [
      { icon: 'Sparkles',  title: 'One-Click AI Removal',   desc: 'Our model detects the subject and strips the background automatically — no manual masking or lasso tools.' },
      { icon: 'Image',     title: 'Product-Photo Ready',    desc: 'Optimised for clean edges around products, packaging, and apparel — ideal for marketplace listings.' },
      { icon: 'User',      title: 'Portrait Mode',          desc: 'Fine-tuned edge detection around hair and skin tones for natural-looking people cutouts.' },
      { icon: 'Download',  title: 'Transparent PNG Export', desc: 'Download a true transparent-background PNG, ready to drop onto any backdrop or template.' },
      { icon: 'Zap',       title: 'Seconds, Not Minutes',   desc: 'Processing typically finishes in under 5 seconds, even for high-resolution images.' },
      { icon: 'RefreshCw', title: 'Manual Touch-Up',        desc: 'Erase or restore edges with a brush tool for the rare image the AI doesn\'t nail on the first pass.' },
    ],
    hero: {
      headline: 'Remove Any Background in One Click',
      subtext: 'Drop in a photo and our AI isolates the subject instantly — clean edges, transparent PNG, ready for your listing, thumbnail, or design in seconds.',
    },
    stats: [
      { value: '2M+',   label: 'Images Processed' },
      { value: '<5 sec', label: 'Avg. Processing Time' },
      { value: '99%',   label: 'Edge Accuracy on Products' },
      { value: 'Free',  label: 'To Start, No Credit Card' },
    ],
    steps: [
      { step: '01', title: 'Upload Your Image',    desc: 'Drag and drop any JPG or PNG — product photo, portrait, or graphic.' },
      { step: '02', title: 'AI Detects the Subject', desc: 'Our model automatically identifies the foreground and separates it from the background.' },
      { step: '03', title: 'Preview the Cutout',   desc: 'Zoom in to check edges around hair, fur, or fine details before exporting.' },
      { step: '04', title: 'Touch Up If Needed',   desc: 'Use the brush tool to manually restore or erase any missed spots.' },
      { step: '05', title: 'Export Transparent PNG', desc: 'Download your background-free image, ready to use anywhere.' },
    ],
    advantages: [
      { icon: 'Zap',         title: 'Skip expensive photo editors',  desc: 'Get studio-quality cutouts without Photoshop or a subscription.' },
      { icon: 'ShieldCheck', title: 'Consistent, professional results', desc: 'Every image gets the same clean, marketplace-ready treatment.' },
      { icon: 'Clock',       title: 'Turn hours into seconds',       desc: 'Batch-ready product shoots go from raw photo to listing-ready in moments.' },
    ],
    faqs: [
      { question: 'What image formats are supported?', answer: 'JPG, PNG, and WebP uploads; export is always a transparent PNG.' },
      { question: 'Does it work on group photos?',      answer: 'Yes, though single-subject images (products, single portraits) get the cleanest results.' },
      { question: 'Is there a resolution limit?',       answer: 'Images up to 4000×4000px are supported for full-quality processing.' },
    ],
  },

  {
    slug: 'profit-loss',
    title: 'Profit & Loss',
    icon: 'BarChart3',
    shortDesc: 'Log income and expenses, visualize trends, and generate instant profit & loss reports for any date range.',
    category: 'embedded',
    badge: 'New',
    toolUrl: 'https://profit-loss.freelax.in/',
    requiresLogin: false,
    features: [
      { icon: 'Wallet',     title: 'Simple Income & Expense Log', desc: 'Add transactions in seconds with custom categories — no accounting background required.' },
      { icon: 'LineChart',  title: 'Visual Trend Charts',         desc: 'See income, expenses, and net profit plotted over any time period at a glance.' },
      { icon: 'Calendar',   title: 'Any Date Range',              desc: 'Generate a P&L report for this month, last quarter, or a fully custom range in one click.' },
      { icon: 'FileDown',   title: 'Exportable Reports',          desc: 'Download your profit & loss statement as PDF or CSV to share with your accountant.' },
      { icon: 'Tag',        title: 'Custom Categories',           desc: 'Organise transactions into categories that match how your business actually spends and earns.' },
      { icon: 'TrendingUp', title: 'Month-over-Month Comparison', desc: 'Instantly compare this month\'s performance against the last to spot trends early.' },
    ],
    hero: {
      headline: 'Know If You\'re Actually Making Money',
      subtext: 'Log income and expenses as they happen, then generate a clear profit & loss report for any period — no spreadsheets, no guesswork.',
    },
    stats: [
      { value: '50K+',   label: 'Transactions Logged' },
      { value: 'Instant', label: 'Report Generation' },
      { value: 'Any',    label: 'Custom Date Range' },
      { value: 'Free',   label: 'Core Features' },
    ],
    steps: [
      { step: '01', title: 'Log a Transaction',   desc: 'Add income or an expense with amount, category, and date in a few taps.' },
      { step: '02', title: 'Categorise as You Go', desc: 'Tag transactions with custom categories to see exactly where money comes from and goes.' },
      { step: '03', title: 'View Your Dashboard', desc: 'Watch income, expenses, and net profit update in real time on visual charts.' },
      { step: '04', title: 'Pick a Date Range',   desc: 'Select any period — weekly, monthly, quarterly, or custom — to generate a report.' },
      { step: '05', title: 'Export Your P&L',     desc: 'Download a clean profit & loss statement to share with partners or your accountant.' },
    ],
    advantages: [
      { icon: 'Eye',      title: 'Always know your numbers',    desc: 'No more waiting until month-end to find out if you turned a profit.' },
      { icon: 'Clock',    title: 'Replace messy spreadsheets',  desc: 'Skip manual formulas and broken templates — everything is calculated automatically.' },
      { icon: 'FileText', title: 'Accountant-ready reports',    desc: 'Export clean, professional P&L statements whenever you need them.' },
    ],
    faqs: [
      { question: 'Do I need accounting knowledge to use this?', answer: 'No — just log what you earn and spend; the tool handles the calculations and formatting.' },
      { question: 'Can I create custom expense categories?',     answer: 'Yes — add as many custom income and expense categories as your business needs.' },
      { question: 'Can I export reports for my accountant?',     answer: 'Yes — export any date range as a PDF or CSV in one click.' },
    ],
  },

  {
    slug: 'program',
    title: 'Program Playground',
    icon: 'Code2',
    shortDesc: 'A fast, distraction-free online code runner for quick scripts, snippets, and experiments — no setup required.',
    category: 'embedded',
    badge: 'Beta',
    toolUrl: 'https://program.freelax.in/',
    requiresLogin: false,
    features: [
      { icon: 'Play',    title: 'Instant Execution',      desc: 'Write code and run it immediately — no compiler installs, no environment setup.' },
      { icon: 'Code2',   title: 'Multi-Language Support', desc: 'Run snippets across popular languages without switching tools or tabs.' },
      { icon: 'Zap',     title: 'Zero Setup',             desc: 'Skip the local environment entirely — everything runs directly in your browser tab.' },
      { icon: 'Save',    title: 'Auto-Saved Sessions',    desc: 'Your code sticks around between visits, so you never lose an in-progress snippet.' },
      { icon: 'Terminal', title: 'Live Console Output',   desc: 'See stdout, errors, and return values printed instantly as your code runs.' },
      { icon: 'Share2',  title: 'Shareable Links',        desc: 'Generate a link to any snippet so teammates can view or fork it instantly.' },
    ],
    hero: {
      headline: 'Write Code. Hit Run. See Results.',
      subtext: 'No installs, no configuration, no local environment — just open a tab and start running real code in seconds.',
    },
    stats: [
      { value: 'Instant', label: 'Code Execution' },
      { value: '0',       label: 'Setup Steps Required' },
      { value: 'Multi',   label: 'Language Support' },
      { value: 'Free',    label: 'While in Beta' },
    ],
    steps: [
      { step: '01', title: 'Open a New Snippet', desc: 'Start with a blank editor or pick a language template.' },
      { step: '02', title: 'Write Your Code',    desc: 'Use the built-in editor with syntax highlighting and auto-indent.' },
      { step: '03', title: 'Hit Run',            desc: 'Execute instantly and see console output appear alongside your code.' },
      { step: '04', title: 'Debug on the Fly',   desc: 'Tweak your code and re-run in seconds to iterate quickly.' },
      { step: '05', title: 'Share or Save',      desc: 'Generate a shareable link or keep your snippet saved for later.' },
    ],
    advantages: [
      { icon: 'Zap',    title: 'Test ideas in seconds',    desc: 'No project scaffolding — just write and run instantly.' },
      { icon: 'Users',  title: 'Share knowledge easily',   desc: 'Send a link instead of pasting code into chat or docs.' },
      { icon: 'Laptop', title: 'Works on any device',      desc: 'Runs entirely in the browser, so it works on any machine with no installs.' },
    ],
    faqs: [
      { question: 'Do I need to install anything?',   answer: 'No — everything runs directly in your browser tab.' },
      { question: 'What languages are supported?',    answer: 'Program Playground supports the most common scripting and general-purpose languages, with more being added during beta.' },
      { question: 'Are my snippets private?',          answer: 'Snippets are only accessible via their unique link unless you choose to share them.' },
    ],
  },

  {
    slug: 'link-generator',
    title: 'Link Generator',
    icon: 'Link2',
    shortDesc: 'Generate clean short links, QR codes, and trackable URLs to share anywhere in a single click.',
    category: 'embedded',
    badge: 'Free',
    toolUrl: 'https://link-generator.freelax.in/',
    requiresLogin: false,
    features: [
      { icon: 'Link2',    title: 'Instant Short Links', desc: 'Paste any long URL and get a clean, shareable short link in one click.' },
      { icon: 'QrCode',   title: 'Built-In QR Codes',   desc: 'Every short link automatically comes with a downloadable QR code for print or offline sharing.' },
      { icon: 'BarChart3', title: 'Click Tracking',     desc: 'See how many times each link has been clicked, right from your dashboard.' },
      { icon: 'Edit',     title: 'Custom Slugs',        desc: 'Choose your own short link ending instead of a random string, for branded, memorable URLs.' },
      { icon: 'Clock',    title: 'Link Expiry Options', desc: 'Set links to expire after a date or click count for time-sensitive campaigns.' },
      { icon: 'Copy',     title: 'One-Click Copy',      desc: 'Copy your new short link or QR code image straight to your clipboard instantly.' },
    ],
    hero: {
      headline: 'Turn Any Link Into a Short, Trackable One',
      subtext: 'Paste a long URL, get a clean short link and QR code instantly, and track every click — perfect for social bios, print materials, and campaigns.',
    },
    stats: [
      { value: '1M+',    label: 'Links Generated' },
      { value: 'Instant', label: 'Link & QR Creation' },
      { value: '100%',   label: 'Click Tracking Included' },
      { value: 'Free',   label: 'No Signup Required' },
    ],
    steps: [
      { step: '01', title: 'Paste Your URL',      desc: 'Drop in any long link you want to shorten.' },
      { step: '02', title: 'Customise the Slug',  desc: 'Optionally choose your own short link ending for a branded look.' },
      { step: '03', title: 'Generate the QR Code', desc: 'A scannable QR code is created automatically alongside your short link.' },
      { step: '04', title: 'Copy or Download',    desc: 'Copy the link or download the QR code image with one click.' },
      { step: '05', title: 'Track Performance',   desc: 'Watch click counts roll in as people use your link.' },
    ],
    advantages: [
      { icon: 'Share2',   title: 'Share anywhere, cleanly',    desc: 'Replace long, messy URLs with short links that look professional everywhere.' },
      { icon: 'BarChart3', title: 'Know what\'s working',      desc: 'Click tracking shows exactly which links and campaigns are getting engagement.' },
      { icon: 'QrCode',   title: 'Bridge print and digital',   desc: 'QR codes let offline materials — posters, packaging, business cards — link straight to your content.' },
    ],
    faqs: [
      { question: 'Do I need an account to generate links?', answer: 'No — you can generate short links and QR codes without signing up.' },
      { question: 'Can I customise my short link?',          answer: 'Yes — choose a custom slug instead of a random one for branded links.' },
      { question: 'Do links expire?',                        answer: 'By default links don\'t expire, but you can optionally set an expiry date or click limit.' },
    ],
  },
];

// Default per-role tools access, applied when a user_settings row is first
// created for a user (via Admin → Users, or when seeding default accounts).
// master_admin and admin get every current tool since they're only ever
// created by an existing admin (and an admin needs tools of their own before
// they can grant any to their team, per Admin → Settings). A plain 'user'
// starts with NO tools access at all; an admin has to explicitly grant each
// one from Admin → Settings.
export const defaultToolsAccessByRole = {
  master_admin: tools.map((t) => t.slug),
  admin: tools.map((t) => t.slug),
  user: [],
};
