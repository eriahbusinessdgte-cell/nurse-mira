"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Database, MessageSquare, TriangleAlert, UserX } from "lucide-react";
import { Card, buttonClass } from "@/components/ui";
import { adminUsers } from "@/lib/admin-users";
import { keepTextOnly } from "@/lib/library/actions";
import { formatBytes } from "@/lib/library/labels";
import { createClient } from "@/lib/supabase/client";

export type Preview = {
  old_chats: number;
  old_chat_bytes: number;
  archived_files: number;
  archived_file_bytes: number;
  archived_ids: string[];
  inactive_students: { id: string; name: string; email: string }[];
  problems: number;
  database_bytes: number;
};

type Key = "chats" | "archived" | "students" | "problems";

export function CleanupTools({ preview }: { preview: Preview }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<Key | null>(null);
  const [busy, setBusy] = useState<Key | null>(null);
  const [done, setDone] = useState<Partial<Record<Key, { ok: boolean; text: string }>>>({});

  async function run(key: Key) {
    setBusy(key);
    setConfirming(null);
    let result: { ok: boolean; text: string };
    try {
      if (key === "chats") {
        const { data, error } = await createClient().rpc("admin_cleanup_chats");
        result = error ? { ok: false, text: "Couldn't delete the old chats. Please try again." } : { ok: true, text: `${data} old chat(s) deleted.` };
      } else if (key === "archived") {
        const r = await keepTextOnly(preview.archived_ids);
        result = { ok: r.ok, text: r.ok ? `${r.message} Freed ${formatBytes(r.recovered ?? 0)}.` : r.message };
      } else if (key === "students") {
        let deleted = 0;
        const failed: string[] = [];
        for (const s of preview.inactive_students) {
          const r = await adminUsers({ action: "delete", user_id: s.id, confirm_email: s.email });
          if (r.error) failed.push(s.name);
          else deleted++;
        }
        result = { ok: !failed.length, text: `${deleted} account(s) deleted.${failed.length ? ` Couldn't delete: ${failed.join(", ")}.` : ""}` };
      } else {
        const { error } = await createClient().from("app_events").delete().gte("id", 0);
        result = error ? { ok: false, text: "Couldn't clear the list." } : { ok: true, text: "Problems list cleared." };
      }
    } catch {
      result = { ok: false, text: "Something went wrong. Please try again." };
    }
    setDone((d) => ({ ...d, [key]: result }));
    setBusy(null);
    router.refresh();
  }

  const items: { key: Key; icon: typeof Database; title: string; what: string; amount: string; empty: boolean; warning?: string }[] = [
    {
      key: "chats",
      icon: MessageSquare,
      title: "Old AI Tutor chats",
      what: "Chats students didn't keep, with no new message in the last 7 days. (They'd be deleted automatically at 30 days anyway.)",
      amount: `${preview.old_chats} chat(s) · about ${formatBytes(preview.old_chat_bytes)} of database`,
      empty: preview.old_chats === 0,
    },
    {
      key: "archived",
      icon: Archive,
      title: "Archived reviewers → text only",
      what: "Removes the files of archived shared reviewers. Their text stays, so Nurse Mira still learns from them, but they can't be downloaded anymore.",
      amount: `${preview.archived_files} file(s) · ${formatBytes(preview.archived_file_bytes)} of file storage`,
      empty: preview.archived_files === 0,
    },
    {
      key: "students",
      icon: UserX,
      title: "Turned-off student accounts",
      what: "Permanently deletes these accounts and their private work (chats, quizzes, case studies, care plans, planner). Shared reviewers they uploaded stay in the library.",
      amount: preview.inactive_students.length ? preview.inactive_students.map((s) => s.name).join(", ") : "No turned-off accounts",
      empty: preview.inactive_students.length === 0,
      warning: "This can't be undone. Make a backup first if you might need their work later.",
    },
    {
      key: "problems",
      icon: TriangleAlert,
      title: "Problems list",
      what: "Clears the AI & Problems log (it's also tidied automatically after 60 days).",
      amount: `${preview.problems} problem(s)`,
      empty: preview.problems === 0,
    },
  ];

  return (
    <div className="max-w-3xl space-y-4">
      <Card className="flex items-center gap-3">
        <Database size={20} className="text-mira-blue" aria-hidden />
        <p className="text-sm">
          Database in use: <strong>{formatBytes(preview.database_bytes)}</strong> of 500 MB on the free plan.
        </p>
      </Card>
      {items.map((it) => {
        const result = done[it.key];
        return (
          <Card key={it.key}>
            <div className="flex flex-wrap items-start gap-3">
              <it.icon size={20} className="mt-0.5 text-mira-blue" aria-hidden />
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">{it.title}</h2>
                <p className="mt-1 text-sm text-mira-muted">{it.what}</p>
                <p className="mt-2 text-sm font-medium">{it.amount}</p>
                {it.warning && !it.empty && <p className="mt-1 text-sm text-amber-700">{it.warning}</p>}
                {result && (
                  <p role={result.ok ? "status" : "alert"} className={`mt-2 text-sm ${result.ok ? "text-green-700" : "text-mira-danger"}`}>
                    {result.ok ? "✓ " : ""}
                    {result.text}
                  </p>
                )}
              </div>
              {confirming === it.key ? (
                <span className="flex items-center gap-2">
                  <button type="button" onClick={() => run(it.key)} className={buttonClass("danger")}>
                    Yes, clean up
                  </button>
                  <button type="button" onClick={() => setConfirming(null)} className={buttonClass("secondary")}>
                    Cancel
                  </button>
                </span>
              ) : (
                <button type="button" disabled={it.empty || !!busy || !!result?.ok} onClick={() => setConfirming(it.key)} className={buttonClass("secondary")}>
                  {busy === it.key ? "Cleaning…" : it.empty ? "Nothing to clean" : "Clean up"}
                </button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
