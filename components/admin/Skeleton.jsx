export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-surface rounded-lg ${className}`} />
}

export function FormSkeleton({ rows = 4 }) {
  return (
    <div className="bg-card rounded-2xl border border-divider shadow-sm p-6 flex flex-col gap-5 max-w-3xl mx-auto">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
      <div className="flex justify-end">
        <Skeleton className="h-10 w-28 rounded-xl" />
      </div>
    </div>
  )
}

export function TableSkeleton({ rows = 6 }) {
  return (
    <div className="bg-card rounded-2xl border border-divider shadow-sm overflow-hidden">
      <div className="p-4 border-b border-divider flex items-center justify-between">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>
      <div className="divide-y divide-divider">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-16 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function CardSkeleton({ count = 3 }) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="bg-card rounded-2xl border border-divider shadow-sm p-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            {[0, 1].map((j) => (
              <div key={j} className="flex flex-col gap-1.5">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-20 w-full" />
          </div>
          <div className="flex justify-end gap-2">
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function PackageGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="bg-card rounded-2xl border border-divider shadow-sm p-5 flex flex-col gap-3">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1.5 flex-1">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <div className="flex gap-1 ml-2">
              <Skeleton className="h-7 w-7 rounded-lg" />
              <Skeleton className="h-7 w-7 rounded-lg" />
            </div>
          </div>
          <Skeleton className="h-8 w-24" />
          <div className="flex flex-wrap gap-1.5">
            <Skeleton className="h-6 w-16 rounded-lg" />
            <Skeleton className="h-6 w-20 rounded-lg" />
            <Skeleton className="h-6 w-14 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function LoadError({ onRetry }) {
  return (
    <div className="text-center py-16">
      <p className="text-sm text-subtle mb-3">Failed to load data. Please check your connection.</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors"
      >
        Retry
      </button>
    </div>
  )
}
