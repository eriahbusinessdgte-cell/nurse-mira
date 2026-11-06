// Temporary landing page shown while Nurse Mira is being set up (Phase 2).
// It is replaced by the real login page once Supabase is connected.
export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-mira-line">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-mira-blue text-2xl font-semibold text-white">
          M
        </div>
        <h1 className="text-2xl font-semibold text-mira-ink">Nurse Mira</h1>
        <p className="mt-1 text-mira-muted">Your Personal Nursing School Companion</p>
        <p className="mt-6 rounded-lg bg-mira-blue-soft px-4 py-3 text-sm text-mira-blue-dark">
          We&apos;re getting things ready. Sign-in will open here soon.
        </p>
      </div>
    </main>
  );
}
