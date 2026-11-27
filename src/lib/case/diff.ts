// Word-level difference between the student's text and Nurse Mira's revision (Case Study Checker, D-072).
export type DiffPiece = { t: "same" | "add" | "del"; s: string };

const tokens = (t: string) => t.match(/\s+|[^\s]+/g) ?? [];

/** Longest-common-subsequence diff on words. Very long texts fall back to "all removed / all added". */
export function wordDiff(a: string, b: string): DiffPiece[] {
  const x = tokens(a);
  const y = tokens(b);
  if (x.length * y.length > 4_000_000) return [{ t: "del", s: a }, { t: "add", s: b }];
  const n = x.length;
  const m = y.length;
  const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: DiffPiece[] = [];
  const push = (t: DiffPiece["t"], s: string) => {
    const last = out[out.length - 1];
    if (last && last.t === t) last.s += s;
    else out.push({ t, s });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) {
      push("same", x[i++]);
      j++;
    }
    else if (dp[i + 1][j] >= dp[i][j + 1]) push("del", x[i++]);
    else push("add", y[j++]);
  }
  while (i < n) push("del", x[i++]);
  while (j < m) push("add", y[j++]);
  // Whitespace-only changes aren't worth highlighting.
  return out.map((p) => (p.t !== "same" && !p.s.trim() ? { t: "same", s: p.t === "add" ? p.s : "" } : p));
}
