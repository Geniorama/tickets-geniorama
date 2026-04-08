export default function ProyectosLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-8 w-36 animate-pulse rounded bg-muted" />
        <div className="h-9 w-32 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-10 w-full animate-pulse rounded bg-muted" />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}
