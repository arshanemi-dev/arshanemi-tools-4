'use client';

import * as LucideIcons from 'lucide-react';
import { ArrowUpRight, Wrench } from 'lucide-react';
import { motion } from 'framer-motion';

const CARD_GRADIENTS = [
  'from-accent to-cyan',
  'from-accent-vivid to-accent-light',
  'from-cyan to-accent-light',
  'from-accent-light to-accent-vivid',
];

function ToolIcon({ name, size = 22 }) {
  const Icon = LucideIcons[name] || Wrench;
  return <Icon size={size} />;
}

export default function ToolCard({ tool, index }) {
  const gradient = CARD_GRADIENTS[index % CARD_GRADIENTS.length];
  const launchable = Boolean(tool.toolUrl);

  const card = (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.45, delay: (index % 6) * 0.06 }}
      className={`card-glow group relative flex h-full flex-col rounded-2xl border border-divider bg-card/60 p-6 transition-colors ${
        launchable ? 'hover:border-divider-light hover:-translate-y-1' : 'opacity-60'
      }`}
    >
      {tool.badge && (
        <span className="absolute top-4 right-4 rounded-full border border-accent/20 bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
          {tool.badge}
        </span>
      )}

      <div className="flex items-center justify-between">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-background shadow-lg`}>
          <ToolIcon name={tool.icon} />
        </div>
        {launchable && (
          <ArrowUpRight
            size={18}
            className="-rotate-45 text-subtle transition-all duration-300 group-hover:rotate-0 group-hover:text-foreground"
          />
        )}
      </div>

      <h3 className="mt-5 text-lg font-bold tracking-tight text-foreground">{tool.title}</h3>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{tool.shortDesc}</p>

      {tool.category && (
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="rounded-full border border-divider px-2.5 py-1 text-[11px] font-medium text-muted">
            {tool.category}
          </span>
        </div>
      )}

      <div className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground/90">
        {launchable ? 'Open Tool' : 'Not available yet'}
        {launchable && (
          <ArrowUpRight size={14} className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
        )}
      </div>
    </motion.div>
  );

  if (!launchable) {
    return <div aria-disabled="true">{card}</div>;
  }

  return (
    <a href={tool.toolUrl} target="_blank" rel="noopener noreferrer" className="block h-full">
      {card}
    </a>
  );
}
