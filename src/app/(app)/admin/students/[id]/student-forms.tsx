"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SetupLinkBox } from "@/components/setup-link-box";
import { SubjectPicker } from "@/components/subject-picker";
import { Card, buttonClass, inputClass } from "@/components/ui";
import { adminUsers } from "@/lib/admin-users";
import type { Subject } from "@/lib/curriculum";
import { SEM_LABEL, YEAR_LABEL } from "@/lib/nav";
import { updateStudentDetails, updateStudentSubjects } from "../actions";

type Student = {
  id: string;
  email: string;
  full_name: string;
  preferred_name: string | null;
  year_level: number | null;
  current_semester: number | null;
  is_active: boolean;
  onboarding_completed: boolean;
};

function Status({ result }: { result: { ok: boolean; message: string } | null }) {
  if (!result) return null;
  return (
    <p role={result.ok ? "status" : "alert"} className={`text-sm ${result.ok ? "text-green-700" : "text-mira-danger"}`}>
      {result.ok ? "✓ " : ""}
      {result.message}
    </p>
  );
}

export function DetailsForm({ student }: { student: Student }) {
  const [result, action, pending] = useActionState(updateStudentDetails.bind(null, student.id), null);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm font-medium">
        Full name
        <input name="full_name" required defaultValue={student.full_name} className={inputClass} />
      </label>
      <label className="block text-sm font-medium">
        Preferred first name <span className="font-normal text-mira-muted">(optional)</span>
        <input name="preferred_name" defaultValue={student.preferred_name ?? ""} className={inputClass} />
      </label>
      <label className="block text-sm font-medium">
        Year level
        <select name="year_level" defaultValue={student.year_level ?? ""} className={inputClass}>
          <option value="">Not set</option>
          {[1, 2, 3, 4].map((y) => (
            <option key={y} value={y}>
              {YEAR_LABEL[y]}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium">
        Current semester
        <select name="current_semester" defaultValue={student.current_semester ?? ""} className={inputClass}>
          <option value="">Not set</option>
          {[1, 2].map((s) => (
            <option key={s} value={s}>
              {SEM_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          {pending ? "Saving…" : "Save details"}
        </button>
        <span className="text-sm text-mira-muted">Email: {student.email}</span>
      </div>
      <div className="sm:col-span-2">
        <Status result={result} />
      </div>
    </form>
  );
}

export function SubjectsEditor({
  studentId,
  subjects,
  initial,
  highlight,
}: {
  studentId: string;
  subjects: Subject[];
  initial: string[];
  highlight: { year: number | null; semester: number | null };
}) {
  const [selected, setSelected] = useState(initial);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = selected.length !== initial.length || selected.some((id) => !initial.includes(id));

  return (
    <div>
      <SubjectPicker subjects={subjects} selected={selected} onChange={(ids) => (setSelected(ids), setResult(null))} highlight={highlight} />
      <div className="sticky bottom-0 mt-4 flex items-center gap-3 border-t border-mira-line bg-white pt-4">
        <button
          type="button"
          disabled={!dirty || pending}
          onClick={() => startTransition(async () => setResult(await updateStudentSubjects(studentId, selected)))}
          className={buttonClass("primary")}
        >
          {pending ? "Saving…" : "Save subjects"}
        </button>
        {dirty && !pending && <span className="text-sm text-amber-700">Unsaved changes</span>}
        <Status result={result} />
      </div>
    </div>
  );
}

export function AccessPanel({ student }: { student: Student }) {
  const router = useRouter();
  const [link, setLink] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [showDelete, setShowDelete] = useState(false);

  const run = async (key: string, body: Record<string, unknown>, done: (data: Record<string, unknown>) => void) => {
    setBusy(key);
    setMessage(null);
    const { data, error } = await adminUsers(body);
    setBusy(null);
    if (error || !data) return setMessage({ ok: false, message: error ?? "Something went wrong." });
    done(data);
  };

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="mb-1 font-semibold">{student.onboarding_completed ? "Password reset" : "Setup link"}</h2>
        <p className="mb-4 text-sm text-mira-muted">
          {student.onboarding_completed
            ? "Make a one-time link the student can use to choose a new password."
            : "This student hasn't set up their account yet. Make a fresh setup link if the old one expired."}
        </p>
        {link ? (
          <SetupLinkBox link={link} name={student.full_name} kind={student.onboarding_completed ? "reset" : "setup"} />
        ) : (
          <button
            type="button"
            disabled={!student.is_active || busy !== null}
            onClick={() => run("link", { action: "setup_link", user_id: student.id }, (d) => setLink(String(d.link)))}
            className={buttonClass("primary", "w-full")}
          >
            {busy === "link" ? "Creating link…" : student.onboarding_completed ? "Create reset link" : "Create new setup link"}
          </button>
        )}
        {!student.is_active && <p className="mt-2 text-xs text-mira-muted">Turn the account back on first.</p>}
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold">Access</h2>
        <p className="mb-4 text-sm text-mira-muted">
          {student.is_active
            ? "Turning the account off stops the student from signing in. Their work is kept, and you can turn it back on at any time."
            : "This account is turned off. The student can't sign in, but their work is kept."}
        </p>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() =>
            run("active", { action: "set_active", user_id: student.id, active: !student.is_active }, () => {
              setMessage({ ok: true, message: student.is_active ? "Account turned off." : "Account turned back on." });
              router.refresh();
            })
          }
          className={buttonClass(student.is_active ? "secondary" : "primary", "w-full")}
        >
          {busy === "active" ? "Updating…" : student.is_active ? "Turn account off" : "Turn account back on"}
        </button>
      </Card>

      <Card className="ring-red-100">
        <h2 className="mb-1 font-semibold text-mira-danger">Delete permanently</h2>
        <p className="mb-4 text-sm text-mira-muted">
          For test accounts or mistakes. This permanently removes the student&apos;s login, profile, chosen subjects, private documents
          and saved work. Shared reviewers they uploaded stay in the library for everyone. It can&apos;t be undone. To keep their
          work, turn the account off instead.
        </p>
        {!showDelete ? (
          <button type="button" onClick={() => setShowDelete(true)} className={buttonClass("danger", "w-full")}>
            Delete this student…
          </button>
        ) : (
          <div className="space-y-3">
            <label className="block text-sm font-medium">
              Type <span className="font-semibold">{student.email}</span> to confirm
              <input value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} autoComplete="off" className={inputClass} />
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={() => (setShowDelete(false), setConfirmEmail(""))} className={buttonClass("secondary", "flex-1")}>
                Cancel
              </button>
              <button
                type="button"
                disabled={confirmEmail.trim().toLowerCase() !== student.email.toLowerCase() || busy !== null}
                onClick={() =>
                  run("delete", { action: "delete", user_id: student.id, confirm_email: confirmEmail }, () => {
                    router.replace("/admin/students");
                    router.refresh();
                  })
                }
                className={buttonClass("danger", "flex-1 !bg-mira-danger !text-white")}
              >
                {busy === "delete" ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        )}
      </Card>

      {message && (
        <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-green-700" : "text-mira-danger"}`}>
          {message.message}
        </p>
      )}
    </div>
  );
}
