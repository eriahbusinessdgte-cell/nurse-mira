export function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <button
        type="submit"
        className="rounded-lg border border-mira-line bg-white px-3 py-1.5 text-sm text-mira-muted hover:text-mira-ink"
      >
        Sign out
      </button>
    </form>
  );
}
