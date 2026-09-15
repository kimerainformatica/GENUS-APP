export default function ClienteProfileLoading() {
  return (
    <main className="mx-auto max-w-7xl animate-pulse px-5 py-8 sm:px-6 sm:py-10" aria-label="Carregando perfil do cliente">
      <div className="mb-5 h-5 w-36 rounded bg-muted" />
      <div className="h-52 rounded-2xl border border-border bg-card" />
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => <div key={index} className="h-28 rounded-2xl border border-border bg-card" />)}
      </div>
      <div className="mt-8 h-72 rounded-2xl border border-border bg-card" />
    </main>
  );
}
