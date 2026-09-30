import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shown while a lazily loaded page chunk is fetched. Mirrors PageLayout's
 * header spacing so the page does not jump when the real content arrives.
 */
export function RouteFallback() {
  return (
    <div className="h-full flex flex-col" role="status" aria-live="polite">
      <span className="sr-only">Loading page…</span>
      <div className="pt-16 px-16 pb-4 border-b border-border mb-4">
        <div className="max-w-4xl mx-auto space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
      </div>
      <div className="px-16">
        <div className="max-w-4xl mx-auto space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-2/3" />
        </div>
      </div>
    </div>
  );
}
