export default function DashboardLoading() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1400px] space-y-6 px-6 py-8 lg:px-10">
        <div className="space-y-3">
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="h-9 w-72 animate-pulse rounded bg-muted" />
          <div className="h-4 w-[420px] max-w-full animate-pulse rounded bg-muted" />
        </div>

        <div className="h-20 animate-pulse rounded-2xl bg-muted" />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-36 animate-pulse rounded-2xl bg-muted"
            />
          ))}
        </div>

        <div className="h-[430px] animate-pulse rounded-2xl bg-muted" />

        <div className="h-[420px] animate-pulse rounded-2xl bg-muted" />
      </div>
    </main>
  );
}
