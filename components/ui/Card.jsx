import { cn } from '@/lib/utils';

export default function Card({ children, className, hover = true, padding = true, ...props }) {
  return (
    <div
      className={cn(
        'bg-card border border-divider rounded-2xl transition-all duration-300',
        padding && 'p-6 lg:p-8',
        hover && 'hover:border-divider-light hover:bg-card-hover card-glow cursor-default',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
