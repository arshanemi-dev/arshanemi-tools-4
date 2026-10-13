import Image from 'next/image';
import { FileSpreadsheet, Images, LayoutTemplate, Mail, Sparkles, WandSparkles } from 'lucide-react';
import { comingSoon } from '@/data/comingSoon';
import SheetPreview from './SheetPreview';

// The whole screen is server-rendered and animated in CSS alone (the cs-*
// classes in app/globals.css) — it paints at once, with no script of its own.

// Icon names used in data/comingSoon.js → components. Named imports, so only
// these ship, not the whole icon set.
const ICONS = { LayoutTemplate, WandSparkles, Images, FileSpreadsheet };

// Entrance order: .cs-rise starts each step 90ms after the one before. Written
// out in full so Tailwind sees the classes.
const STEP = ['[--d:0]', '[--d:1]', '[--d:2]', '[--d:3]', '[--d:4]', '[--d:5]', '[--d:6]', '[--d:7]', '[--d:8]'];

export default function ComingSoon() {
  const { company, product, status, badge, headline, headlineAccent, intro, features, contactLabel, contactEmail } = comingSoon;

  return (
    <div className="relative isolate flex min-h-screen flex-col overflow-hidden bg-background">
      {/* Backdrop — a faded grid and two slow brand-colour glows */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="cs-grid absolute inset-0" />
        <div className="hero-blob absolute -left-48 -top-48 h-[40rem] w-[40rem] rounded-full" />
        <div className="hero-blob cs-late absolute -bottom-56 -right-40 h-[46rem] w-[46rem] rounded-full" />
      </div>

      <header className={`cs-rise ${STEP[0]} mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 pt-6 sm:px-8 lg:px-12`}>
        <div className="flex items-center gap-3">
          <Image
            src="/images/barmeto-logo.png"
            alt={company}
            width={74}
            height={48}
            className="h-9 w-auto rounded-lg"
            priority
          />
          <span className="border-l border-divider-light pl-3 text-sm font-semibold text-foreground">{product}</span>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-divider bg-background/70 px-3 py-1.5 text-xs font-medium text-muted backdrop-blur">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-action opacity-70 motion-reduce:animate-none" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-action" />
          </span>
          {status}
        </span>
      </header>

      <main className="mx-auto grid w-full max-w-7xl flex-1 items-center gap-14 px-5 py-12 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:px-12 lg:py-10">
        <div>
          <p className={`cs-rise ${STEP[1]} inline-flex items-center gap-2 rounded-full border border-accent-vivid/25 bg-accent-vivid/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent-vivid`}>
            <Sparkles size={13} />
            {badge}
          </p>

          <h1 className={`cs-rise ${STEP[2]} mt-5 text-4xl font-bold leading-[1.08] tracking-tight text-foreground sm:text-5xl xl:text-6xl`}>
            {headline}
            <span className="gradient-text block pb-1">{headlineAccent}</span>
          </h1>

          <p className={`cs-rise ${STEP[3]} mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg`}>{intro}</p>

          <ul className="mt-9 grid gap-3 sm:grid-cols-2">
            {features.map((feature, i) => {
              const Icon = ICONS[feature.icon] || Sparkles;
              return (
                <li
                  key={feature.title}
                  className={`cs-rise ${STEP[4 + i]} card-glow flex gap-3 rounded-2xl border border-divider bg-background/70 p-4 backdrop-blur transition-[translate,box-shadow] duration-300 hover:-translate-y-0.5`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent-vivid to-cyan text-white shadow-lg">
                    <Icon size={18} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-foreground">{feature.title}</span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-muted">{feature.desc}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className={`cs-rise ${STEP[4]}`}>
          <SheetPreview />
        </div>
      </main>

      <footer className={`cs-rise ${STEP[8]} mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-3 px-5 pb-6 text-xs text-subtle sm:flex-row sm:px-8 lg:px-12`}>
        <span>© {new Date().getFullYear()} {company}. All rights reserved.</span>
        <a
          href={`mailto:${contactEmail}`}
          className="inline-flex items-center gap-2 rounded-full font-medium text-muted transition-colors hover:text-accent-vivid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-vivid"
        >
          <Mail size={14} />
          {contactLabel}
        </a>
      </footer>
    </div>
  );
}
