export default function ReportesLoading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-36 animate-pulse rounded bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}
