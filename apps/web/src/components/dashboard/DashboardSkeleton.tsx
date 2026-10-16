function Block({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-md bg-slate-200 ${className}`} />;
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading dashboard</span>
      <div className="flex justify-between gap-4">
        <div className="space-y-2">
          <Block className="h-4 w-28" />
          <Block className="h-8 w-40" />
          <Block className="h-4 w-72" />
        </div>
        <Block className="h-10 w-40" />
      </div>
      <div className="rounded-2xl border border-slate-200 bg-[#FFFBF5] p-5">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Block className="h-4 w-32" />
            <Block className="h-6 w-48" />
            <Block className="h-5 w-24" />
          </div>
          <Block className="h-36 w-36 rounded-full" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-slate-200 bg-[#FFFBF5] p-4">
            <Block className="h-4 w-24" />
            <Block className="mt-3 h-8 w-16" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-[#FFFBF5] p-5">
        <Block className="h-5 w-40" />
        <Block className="mt-4 h-24 w-full" />
      </div>
    </div>
  );
}
