import { Skeleton } from "./skeleton";
export function AppSkeleton({ text = "Opening your space…" }: { text?: string }) {
  return (
    <main className="app-skeleton" aria-busy="true" aria-label={text}>
      <p role="status">{text}</p>
      <div className="skeleton-grid" aria-hidden="true">
        <div>
          <Skeleton className="h-12 mb-8" />
          {[1, 2, 3, 4, 5].map((n) => (
            <div className="skeleton h-16 mb-4" key={n} />
          ))}
        </div>
        <div className="skeleton min-h-96" />
      </div>
    </main>
  );
}
