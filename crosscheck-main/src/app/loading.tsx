export default function Loading() {
  return (
    <main className="flex flex-1 items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-2 w-2 rounded-full bg-[var(--color-brand)] animate-pulse" />
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-faint)]">
          LOADING
        </span>
      </div>
    </main>
  );
}
