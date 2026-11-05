import { Skeleton } from "./skeleton";
export function AppSkeleton({ text = "Opening your space…" }: { text?: string }) {
  return (
    <main id="main" className="app-skeleton app-skeleton-v2" aria-busy="true" aria-label={text}>
      <p role="status">{text}</p>
      <div className="skeleton-grid" aria-hidden="true">
        <div>
          <Skeleton className="h-12 mb-8" />
          {[1, 2, 3, 4, 5].map((n) => (
            <Skeleton className="h-16 mb-4" key={n} />
          ))}
        </div>
        <Skeleton className="min-h-96" />
      </div>
    </main>
  );
}
