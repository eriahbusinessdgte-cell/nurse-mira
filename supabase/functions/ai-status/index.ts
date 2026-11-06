// Nurse Mira — AI service status check.
// Reports only whether each provider's key is set and whether it answers, plus the
// names of available models. It never returns a key and uses no AI quota
// (listing models is free).
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

async function groqStatus() {
  const key = Deno.env.get("GROQ_API_KEY");
  if (!key) return { configured: false, reachable: false };
  try {
    const res = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${key}` } });
    if (!res.ok) return { configured: true, reachable: false, status: res.status };
    const body = await res.json();
    const models = ((body?.data ?? []) as { id: string }[]).map((m) => m.id).sort();
    return { configured: true, reachable: true, model_count: models.length, models };
  } catch {
    return { configured: true, reachable: false };
  }
}

async function cloudflareStatus() {
  const token = Deno.env.get("CLOUDFLARE_API_TOKEN")?.trim();
  const account = Deno.env.get("CLOUDFLARE_ACCOUNT_ID")?.trim();
  if (!token || !account) return { configured: false, reachable: false, has_token: !!token, has_account: !!account };
  const headers = { Authorization: `Bearer ${token}` };
  try {
    const out: Record<string, unknown> = { configured: true };
    for (const task of ["Text Generation", "Image-to-Text", "Text-to-Speech"]) {
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/models/search?per_page=100&task=${encodeURIComponent(task)}`, { headers });
      if (!res.ok) return { configured: true, reachable: false, status: res.status, errors: (await res.json().catch(() => null))?.errors };
      const body = await res.json();
      out[task] = ((body?.result ?? []) as { name: string }[]).map((m) => m.name).sort();
    }
    out.reachable = true;
    return out;
  } catch (e) {
    // Report the kind of problem without revealing the key: account ID shape and the error type.
    return {
      configured: true,
      reachable: false,
      account_id_looks_valid: /^[0-9a-f]{32}$/.test(account),
      token_length: token.length,
      token_has_spaces_or_newlines: /\s/.test(token),
      token_has_unusual_characters: /[^A-Za-z0-9_\-.]/.test(token),
      token_starts_with_bearer: /^bearer/i.test(token),
      error: String((e as Error)?.name ?? "error"),
    };
  }
}

Deno.serve(async () => {
  const [groq, cloudflare] = await Promise.all([groqStatus(), cloudflareStatus()]);
  return json(200, { provider: "groq", ...groq, cloudflare });
});
