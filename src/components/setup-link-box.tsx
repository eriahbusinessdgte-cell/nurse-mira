"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { buttonClass } from "@/components/ui";

// Shows a one-time link with ready-to-send message text and copy buttons.
export function SetupLinkBox({ link, name, kind }: { link: string; name: string; kind: "setup" | "reset" }) {
  const [copied, setCopied] = useState<"link" | "message" | null>(null);
  const first = name.split(/\s+/)[0] || "there";
  const message =
    kind === "setup"
      ? `Hi ${first}! You're invited to Nurse Mira, your nursing study companion. Open this link to create your password and set up your account:\n\n${link}\n\nThe link works once and expires in 1 hour. If it expires, just ask me for a new one.`
      : `Hi ${first}! Here's your Nurse Mira password reset link:\n\n${link}\n\nIt works once and expires in 1 hour.`;

  const copy = async (what: "link" | "message") => {
    try {
      await navigator.clipboard.writeText(what === "link" ? link : message);
      setCopied(what);
      setTimeout(() => setCopied(null), 2500);
    } catch {
      setCopied(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-mira-page p-3">
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-mira-muted">Message to send</p>
        <p className="whitespace-pre-wrap break-all text-sm">{message}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => copy("message")} className={buttonClass("primary")}>
          {copied === "message" ? <Check size={16} /> : <Copy size={16} />}
          {copied === "message" ? "Message copied" : "Copy message"}
        </button>
        <button type="button" onClick={() => copy("link")} className={buttonClass("secondary")}>
          {copied === "link" ? <Check size={16} /> : <Copy size={16} />}
          {copied === "link" ? "Link copied" : "Copy link only"}
        </button>
      </div>
      <p className="text-xs text-mira-muted">
        Send it by Messenger, text or email. The link works once and expires in 1 hour. You can always make a new one from the student&apos;s page.
      </p>
    </div>
  );
}
