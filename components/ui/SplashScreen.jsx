'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import * as LucideIcons from 'lucide-react';
import { tools } from '@/data/tools';

const ITEM_DURATION = 220; // ms each project name stays on screen
const MIN_VISIBLE = 2200; // ms the splash stays up at minimum

const PROJECTS = tools.map((t) => ({ title: t.title, icon: t.icon }));
const TOTAL_DURATION = Math.max(MIN_VISIBLE, PROJECTS.length * ITEM_DURATION);

function ProjectIcon({ name, size = 16 }) {
  const Icon = LucideIcons[name] || LucideIcons.Sparkles;
  return <Icon size={size} strokeWidth={1.75} />;
}

// Lives in the root layout, so it only mounts once per hard navigation
// (full page load / refresh) — Next.js keeps the layout instance alive
// across client-side <Link> navigations, so it never replays on those.
export default function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const cycleTimer = setInterval(() => {
      setIndex((i) => (i + 1) % PROJECTS.length);
    }, ITEM_DURATION);

    const closeTimer = setTimeout(() => {
      clearInterval(cycleTimer);
      setVisible(false);
    }, TOTAL_DURATION);

    return () => {
      clearInterval(cycleTimer);
      clearTimeout(closeTimer);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = visible ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [visible]);

  const current = PROJECTS[index];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-background"
        >
          <div className="hero-blob absolute inset-0 opacity-40 pointer-events-none" />

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative flex flex-col items-center gap-8 px-6"
          >
            <div className="relative w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
              <Image
                src="/images/arshanemi-logo.png"
                alt="Arshanemi"
                width={40}
                height={40}
                priority
                className="object-contain"
              />
              <span className="absolute inset-0 rounded-2xl border-2 border-accent/40 animate-ping" />
            </div>

            <div className="flex items-center justify-center gap-2 h-6 overflow-hidden min-w-[220px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={current?.title}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                  className="flex items-center gap-2 text-sm text-muted whitespace-nowrap"
                >
                  <span className="text-accent-light">
                    <ProjectIcon name={current?.icon} />
                  </span>
                  {current?.title}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="w-48 h-1 rounded-full bg-divider overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-accent-vivid to-cyan rounded-full"
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: TOTAL_DURATION / 1000, ease: 'linear' }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
