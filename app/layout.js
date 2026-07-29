import './globals.css';
import Script from 'next/script';
import { headers } from 'next/headers';
import { ThemeProvider } from '@/context/ThemeContext';
import SplashScreen from '@/components/ui/SplashScreen';

const SITE_URL = 'https://tools.arshanemi.com';
const SITE_NAME = 'Arshanemi Tools';
const OG_IMAGE = `${SITE_URL}/images/arshanemi-logo.png`;

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Arshanemi Tools — Dashboard',
    template: '%s | Arshanemi Tools',
  },
  description: 'Sign in to open every Arshanemi tool your account has been granted access to.',
  robots: { index: false, follow: false },
  icons: {
    icon: [{ url: '/images/arshanemi-logo.png', type: 'image/png', sizes: 'any' }],
    apple: [{ url: '/images/arshanemi-logo.png', type: 'image/png' }],
    shortcut: '/images/arshanemi-logo.png',
  },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: 'Arshanemi Tools — Dashboard',
    description: 'Sign in to open every Arshanemi tool your account has been granted access to.',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: SITE_NAME }],
  },
};

export default async function RootLayout({ children }) {
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') || ''
  // The settings shell (Sidebar/Topbar) manages its own fixed-viewport
  // scroll region — every other route needs normal document scrolling.
  const isAdmin = pathname.startsWith('/settings')

  return (
    <html lang="en-IN" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/png" href="/images/arshanemi-logo.png" />
        <link rel="shortcut icon" type="image/png" href="/images/arshanemi-logo.png" />
        <link rel="apple-touch-icon" href="/images/arshanemi-logo.png" />
      </head>
      <body className={`antialiased bg-background text-foreground ${isAdmin ? 'overflow-hidden' : 'min-h-screen'}`}>
        <Script id="theme-init" strategy="beforeInteractive">{`(function(){var d=document.documentElement;try{var raw=localStorage.getItem('arshanemi-theme-config');if(raw){var obj=JSON.parse(raw),data=obj.data,ts=obj.ts;if(Date.now()-ts<600000&&data&&data.mode){var mode=data.mode,colors=data[mode]||{},t=data.typography,br=data.borderRadius;d.setAttribute('data-theme',mode);for(var k in colors)d.style.setProperty('--color-'+k,colors[k]);function rgb(h){return[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)].join(',')}if(colors['accent'])d.style.setProperty('--color-accent-rgb',rgb(colors['accent']));if(colors['accent-light'])d.style.setProperty('--color-accent-light-rgb',rgb(colors['accent-light']));if(colors['accent-vivid'])d.style.setProperty('--color-accent-vivid-rgb',rgb(colors['accent-vivid']));if(colors['cyan'])d.style.setProperty('--color-cyan-rgb',rgb(colors['cyan']));if(t){if(t.fontFamily)d.style.setProperty('--font-sans',t.fontFamily+',ui-sans-serif,system-ui,sans-serif');if(t.scale!=null)d.style.setProperty('--si-font-scale',t.scale);}if(br)for(var k2 in br){if(k2!=='preset')d.style.setProperty(k2==='base'?'--radius':'--radius-'+k2,br[k2]);}return;}}}catch(e){}d.setAttribute('data-theme','dark');})()`}</Script>
        <ThemeProvider>
          <SplashScreen />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
