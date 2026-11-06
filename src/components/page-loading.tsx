/** Shown while a page loads the signed-in person's data. */
export function PageLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-1 items-center justify-center p-10 text-mira-muted">
      <span className="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-mira-blue/25 border-t-mira-blue" />
      {label}
    </div>
  );
}
