"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  BookOpen,
  Coffee,
  History,
  Mic,
  MicOff,
  Plus,
  Settings2,
  SendHorizontal,
  ShieldAlert,
  Stethoscope,
  Trash2,
  Volume2,
  VolumeX,
  X,
  Bookmark,
  BookmarkCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { problemKind, reportProblem } from "@/lib/report-problem";
import { sourceLabel } from "@/lib/library/labels";
import { englishVoices, saveVoiceName, savedVoiceName, speakPieces, toSpeech } from "@/lib/tutor/voice";
import { deleteConversation, setKept } from "./actions";
import { CHAT_KEEP_DAYS, expiryLabel } from "@/lib/tutor/expiry";

export type ConversationItem = {
  id: string;
  title: string;
  mode: "tea" | "clinical";
  subject_id: string | null;
  last_message_at: string;
  summary: string | null;
  next_step: string | null;
  kept: boolean;
};
type SourceRef = { n: number; document_id: string; title: string; page: number | null; source_type: string; status: string; related?: boolean };
export type ChatMessage = {
  id: number | string;
  role: "user" | "assistant";
  content: string;
  sources: SourceRef[];
  mode: "tea" | "clinical" | null;
  safety_mode: boolean;
  created_at: string;
};
type Subject = { id: string; code: string; title: string };

type Props = {
  conversations: ConversationItem[];
  active: ConversationItem | null;
  initialMessages: ChatMessage[];
  subjects: Subject[];
  remaining: number;
  limit: number;
  studentName: string;
  initialQuestion: string;
  defaultMode: "tea" | "clinical";
};

// Minimal types for the browser's speech recognition (not in TypeScript's built-in types everywhere).
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
};

const when = (iso: string) => new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric" });

const withCitationLinks = (text: string) => text.replace(/\[S(\d{1,2})\]/g, "[S$1](#source-$1)");

function Answer({ message, speaking, onSpeak }: { message: ChatMessage; speaking: boolean; onSpeak: () => void }) {
  return (
    <div className="max-w-3xl rounded-2xl rounded-tl-sm bg-white p-4 shadow-sm ring-1 ring-mira-line">
      {message.safety_mode && (
        <p className="mb-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <ShieldAlert size={14} aria-hidden /> Safety topic — answered in Clinical Mode. For learning only; always follow your clinical instructor and the
          physician&apos;s orders, and check doses against a current drug reference.
        </p>
      )}
      <div className="prose-mira text-sm leading-relaxed">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ href, children }) =>
              href?.startsWith("#source-") ? (
                <a href={href} className="mx-0.5 rounded bg-mira-blue-soft px-1.5 py-0.5 text-[11px] font-semibold text-mira-blue no-underline">
                  {children}
                </a>
              ) : (
                <a href={href} target="_blank" rel="noreferrer" className="text-mira-blue underline">
                  {children}
                </a>
              ),
          }}
        >
          {withCitationLinks(message.content)}
        </ReactMarkdown>
      </div>
      {message.sources.length > 0 && (
        <div className="mt-3 border-t border-mira-line pt-3">
          <p className="mb-1.5 text-xs font-semibold text-mira-muted">
            {message.sources.every((s) => s.related) ? "Related pages in the Nurse Mira library" : "Sources from the Nurse Mira library"}
          </p>
          <ul className="space-y-1">
            {message.sources.map((s) => (
              <li key={s.n} id={`source-${s.n}`} className="flex flex-wrap items-center gap-2 text-xs">
                {!s.related && <span className="rounded bg-mira-blue-soft px-1.5 py-0.5 font-semibold text-mira-blue">S{s.n}</span>}
                <span className="font-medium">{s.title}</span>
                {s.page ? <span className="text-mira-muted">page {s.page}</span> : null}
                <span className="text-mira-muted">· {sourceLabel(s.source_type)}</span>
                {s.status === "archived" && <span className="text-amber-700">· archived</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={onSpeak}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-mira-muted hover:bg-mira-page hover:text-mira-ink"
          aria-label={speaking ? "Stop reading aloud" : "Read aloud"}
        >
          {speaking ? <VolumeX size={15} /> : <Volume2 size={15} />} {speaking ? "Stop" : "Listen"}
        </button>
      </div>
    </div>
  );
}

export function TutorChat({ conversations, active, initialMessages, subjects, remaining: initialRemaining, limit, studentName, initialQuestion, defaultMode }: Props) {
  const [list, setList] = useState(conversations);
  const [conversationId, setConversationId] = useState<string | null>(active?.id ?? null);
  const [title, setTitle] = useState(active?.title ?? "New conversation");
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [mode, setMode] = useState<"tea" | "clinical">(active?.mode ?? defaultMode);
  const [subjectId, setSubjectId] = useState<string>(active?.subject_id ?? "");
  const [input, setInput] = useState(initialQuestion);
  const [sending, setSending] = useState(false);
  const [banner, setBanner] = useState<{ kind: "limit" | "unavailable" | "error"; text: string; retry?: string } | null>(null);
  const [remaining, setRemaining] = useState(initialRemaining);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakingId, setSpeakingId] = useState<ChatMessage["id"] | null>(null);
  const [voiceSupported, setVoiceSupported] = useState({ mic: false, speak: false });
  const [, startTransition] = useTransition();
  const recognitionRef = useRef<Recognition | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const tempCounter = useRef(0);
  const stopSpeech = useRef<(() => void) | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceName, setVoiceName] = useState<string>("");
  const [voicePanel, setVoicePanel] = useState(false);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    // Feature detection has to run in the browser after the page loads.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVoiceSupported({ mic: !!(w.SpeechRecognition || w.webkitSpeechRecognition), speak: "speechSynthesis" in window });
    const synth = window.speechSynthesis;
    const loadVoices = () => {
      const list = englishVoices(synth.getVoices());
      setVoices(list);
      const saved = savedVoiceName();
      setVoiceName((cur) => cur || (saved && list.some((v) => v.name === saved) ? saved : (list[0]?.name ?? "")));
    };
    if (synth) {
      loadVoices();
      synth.addEventListener?.("voiceschanged", loadVoices);
    }
    return () => {
      synth?.removeEventListener?.("voiceschanged", loadVoices);
      stopSpeech.current?.();
      window.speechSynthesis?.cancel();
      recognitionRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  async function send(text?: string) {
    const question = (text ?? input).trim();
    if (!question || sending) return;
    setBanner(null);
    setSending(true);
    tempCounter.current += 1;
    const temp: ChatMessage = { id: `tmp-${tempCounter.current}`, role: "user", content: question, sources: [], mode, safety_mode: false, created_at: "" };
    setMessages((m) => [...m, temp]);
    setInput("");

    const { data, error } = await createClient().functions.invoke("tutor", {
      body: { conversation_id: conversationId, message: question, mode, subject_id: subjectId || null },
    });
    setSending(false);

    if (error || !data || data.error) {
      setMessages((m) => m.filter((x) => x.id !== temp.id));
      setInput(question);
      let kind: "limit" | "unavailable" | "error" = "error";
      let text = "Something went wrong. Please try again.";
      if (data?.error) {
        kind = data.kind === "limit" ? "limit" : data.kind === "unavailable" ? "unavailable" : "error";
        text = data.error;
      } else if (error) {
        try {
          const ctx = (error as { context?: Response }).context;
          const parsed = ctx ? await ctx.json() : null;
          if (parsed?.error) text = parsed.error;
        } catch {
          text = "Can't reach Nurse Mira right now. Check your internet and try again.";
        }
      }
      if (kind === "limit") setRemaining(0);
      reportProblem("tutor", problemKind(data, !!error), text);
      setBanner({ kind, text, retry: kind === "limit" ? undefined : question });
      return;
    }

    setMessages((m) => [...m, data.message as ChatMessage]);
    if (typeof data.remaining === "number") setRemaining(data.remaining);
    if (!conversationId) {
      const newTitle = question.replace(/\s+/g, " ").slice(0, 70) + (question.length > 70 ? "…" : "");
      setConversationId(data.conversation_id);
      setTitle(newTitle);
      setList((l) => [{ id: data.conversation_id, title: newTitle, mode, subject_id: subjectId || null, last_message_at: new Date().toISOString(), summary: null, next_step: null, kept: false }, ...l]);
      window.history.replaceState(null, "", `/tutor?c=${data.conversation_id}`);
    } else {
      setList((l) => {
        const item = l.find((c) => c.id === conversationId);
        return item ? [{ ...item, last_message_at: new Date().toISOString() }, ...l.filter((c) => c.id !== conversationId)] : l;
      });
    }
  }

  function toggleMic() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "en-PH";
    rec.interimResults = true;
    rec.continuous = false;
    const before = input ? `${input.trim()} ` : "";
    rec.onresult = (e) => {
      const text = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join("");
      setInput(before + text);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed") setBanner({ kind: "error", text: "Microphone access was blocked. Allow the microphone in your browser settings, or type your question instead." });
    };
    rec.onend = () => {
      setListening(false);
      inputRef.current?.focus();
    };
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  }

  function speak(m: ChatMessage) {
    if (!window.speechSynthesis) return;
    stopSpeech.current?.();
    if (speakingId === m.id) {
      setSpeakingId(null);
      return;
    }
    setSpeakingId(m.id);
    const voice = voices.find((v) => v.name === voiceName) ?? null;
    stopSpeech.current = speakPieces(toSpeech(m.content), {
      voice,
      cheerful: (m.mode ?? mode) === "tea" && !m.safety_mode,
      onEnd: () => setSpeakingId(null),
    });
  }

  function tryVoice(name: string) {
    stopSpeech.current?.();
    setSpeakingId(null);
    const voice = voices.find((v) => v.name === name) ?? null;
    stopSpeech.current = speakPieces(["Hi! I'm Nurse Mira. Let's make studying a little more fun today!"], { voice, cheerful: true, onEnd: () => {} });
  }

  function newConversation() {
    stopSpeech.current?.();
    setSpeakingId(null);
    // Clear the chat right here: after the first answer the address was changed quietly
    // (replaceState), so navigating to "/tutor" alone looked like "same page" and did nothing.
    setConversationId(null);
    setTitle("New conversation");
    setMessages([]);
    setMode(defaultMode);
    setSubjectId("");
    setInput("");
    setBanner(null);
    setHistoryOpen(false);
    if (window.location.pathname !== "/tutor" || window.location.search) {
      window.history.replaceState(null, "", "/tutor");
    }
  }

  const suggestions = [
    "Where did we leave off?",
    "Explain heart failure and edema in simple terms",
    subjectId ? `Quiz me with 3 questions on ${subjects.find((s) => s.id === subjectId)?.title}` : "Give me 3 practice questions on my current subjects",
    "Do a short mock oral recitation with me",
  ];

  function toggleKeep(c: ConversationItem) {
    const next = !c.kept;
    setList((l) => l.map((x) => (x.id === c.id ? { ...x, kept: next } : x)));
    startTransition(async () => {
      const r = await setKept(c.id, next);
      if (!r.ok) setList((l) => l.map((x) => (x.id === c.id ? { ...x, kept: !next } : x)));
    });
  }
  const activeItem = list.find((c) => c.id === conversationId);

  const historyPanel = (
    <div className="flex h-full flex-col">
      <button type="button" onClick={newConversation} className="mb-3 flex items-center justify-center gap-2 rounded-lg bg-mira-yellow px-3 py-2.5 text-sm font-medium text-mira-blue-dark hover:bg-mira-yellow-dark">
        <Plus size={16} aria-hidden /> New conversation
      </button>
      <p className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-mira-muted">Saved conversations</p>
      {list.length > 0 && (
        <p className="mb-2 px-1 text-xs text-mira-muted">
          Chats are deleted {CHAT_KEEP_DAYS} days after your last message. Tap <Bookmark size={11} className="inline" aria-hidden /> to keep one.
        </p>
      )}
      {list.length === 0 ? (
        <p className="px-1 text-sm text-mira-muted">Your conversations are saved here for {CHAT_KEEP_DAYS} days after your last message. Tap the bookmark to keep one for good.</p>
      ) : (
        <ul className="-mx-1 flex-1 space-y-1 overflow-y-auto">
          {list.map((c) => (
            <li key={c.id} className="group flex items-start gap-1">
              <a
                href={`/tutor?c=${c.id}`}
                className={`min-w-0 flex-1 rounded-lg px-2 py-2 text-sm ${c.id === conversationId ? "bg-mira-blue-soft text-mira-blue-dark" : "hover:bg-mira-page"}`}
              >
                <span className="line-clamp-2 font-medium">{c.title}</span>
                <span className="text-xs text-mira-muted">
                  {when(c.last_message_at)} · {c.mode === "tea" ? "Tea" : "Clinical"}
                </span>
                <span className={`block text-xs ${c.kept ? "text-mira-blue" : "text-mira-muted"}`}>{expiryLabel(c.kept, c.last_message_at)}</span>
              </a>
              <button
                type="button"
                onClick={() => toggleKeep(c)}
                className={`mt-1 rounded p-1.5 hover:bg-mira-blue-soft ${c.kept ? "text-mira-blue" : "text-mira-muted"}`}
                aria-label={c.kept ? `Stop keeping ${c.title}` : `Keep ${c.title}`}
                aria-pressed={c.kept}
                title={c.kept ? "Kept — tap to let it expire" : "Keep this chat"}
              >
                {c.kept ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
              </button>
              <button
                type="button"
                onClick={() =>
                  confirm(`Delete “${c.title}”? This can't be undone.`) &&
                  startTransition(async () => {
                    const r = await deleteConversation(c.id);
                    if (r.ok) {
                      setList((l) => l.filter((x) => x.id !== c.id));
                      if (c.id === conversationId) newConversation();
                    }
                  })
                }
                className="mt-1 rounded p-1.5 text-mira-muted opacity-0 hover:bg-red-50 hover:text-mira-danger focus:opacity-100 group-hover:opacity-100"
                aria-label={`Delete ${c.title}`}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="-m-4 flex h-[calc(100dvh-65px)] sm:-m-6">
      {/* History (desktop) */}
      <aside className="hidden w-72 shrink-0 border-r border-mira-line bg-white p-4 lg:block">{historyPanel}</aside>

      {/* History (mobile drawer) */}
      {historyOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Saved conversations">
          <button className="absolute inset-0 bg-black/40" aria-label="Close" onClick={() => setHistoryOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-80 max-w-[85%] bg-white p-4">
            <button type="button" onClick={() => setHistoryOpen(false)} className="mb-2 ml-auto block rounded p-1 text-mira-muted" aria-label="Close">
              <X size={18} />
            </button>
            {historyPanel}
          </div>
        </div>
      )}

      <section className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-2 border-b border-mira-line bg-white px-4 py-3 [@media(max-height:500px)]:py-1.5">
          <button type="button" onClick={() => setHistoryOpen(true)} className="rounded-lg p-2 text-mira-muted hover:bg-mira-page lg:hidden" aria-label="Saved conversations">
            <History size={18} />
          </button>
          <h1 className="min-w-0 flex-1 truncate font-semibold">{conversationId ? title : "AI Tutor"}</h1>
          {activeItem && (
            <button
              type="button"
              onClick={() => toggleKeep(activeItem)}
              aria-pressed={activeItem.kept}
              title={activeItem.kept ? "Kept — tap to let it expire" : `Keep this chat (otherwise deleted ${CHAT_KEEP_DAYS} days after the last message)`}
              className={`flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-sm ${activeItem.kept ? "bg-mira-blue-soft text-mira-blue" : "text-mira-muted hover:bg-mira-page"}`}
            >
              {activeItem.kept ? <BookmarkCheck size={16} aria-hidden /> : <Bookmark size={16} aria-hidden />}
              <span className="hidden sm:inline">{activeItem.kept ? "Kept" : "Keep"}</span>
            </button>
          )}

          <div className="flex rounded-lg bg-mira-page p-1" role="radiogroup" aria-label="Tutor style">
            {(
              [
                ["tea", "Tea Mode", Coffee],
                ["clinical", "Clinical", Stethoscope],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={mode === value}
                onClick={() => setMode(value)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${mode === value ? "bg-white font-medium text-mira-blue shadow-sm" : "text-mira-muted"}`}
              >
                <Icon size={15} aria-hidden /> {label}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-1.5 text-sm text-mira-muted">
            <BookOpen size={15} aria-hidden />
            <span className="sr-only">Subject</span>
            <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="max-w-[15rem] rounded-lg border border-mira-line bg-white px-2 py-1.5 text-sm text-mira-ink">
              <option value="">Any subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} ({s.code})
                </option>
              ))}
            </select>
          </label>
          <span className="rounded-full bg-mira-page px-3 py-1 text-xs text-mira-muted" title="Resets at midnight, Philippine time">
            {remaining} of {limit} answers left today
          </span>
          {voiceSupported.speak && voices.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setVoicePanel((o) => !o)}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-mira-muted hover:bg-mira-page hover:text-mira-ink"
                aria-expanded={voicePanel}
              >
                <Settings2 size={15} aria-hidden /> Voice
              </button>
              {voicePanel && (
                <div className="absolute right-0 top-full z-30 mt-2 w-80 rounded-xl bg-white p-4 text-sm shadow-lg ring-1 ring-mira-line">
                  <label className="mb-1 block font-medium" htmlFor="voice-pick">
                    Nurse Mira&apos;s reading voice
                  </label>
                  <select
                    id="voice-pick"
                    value={voiceName}
                    onChange={(e) => {
                      setVoiceName(e.target.value);
                      saveVoiceName(e.target.value);
                      tryVoice(e.target.value);
                    }}
                    className="w-full rounded-lg border border-mira-line bg-white px-2 py-1.5"
                  >
                    {voices.map((v, i) => (
                      <option key={v.name} value={v.name}>
                        {v.name.replace(/^Microsoft /, "").replace(/ - English.*$/, "")} ({v.lang}){i === 0 ? " ★" : ""}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => tryVoice(voiceName)} className="mt-2 flex items-center gap-1.5 rounded-lg bg-mira-blue-soft px-3 py-1.5 font-medium text-mira-blue">
                    <Volume2 size={15} aria-hidden /> Try it
                  </button>
                  <p className="mt-3 text-xs text-mira-muted">
                    ★ = the most natural voice on this device. Voices come from your device and browser, so they differ between phones and laptops. For the
                    most natural voices, use Microsoft Edge (look for names with &quot;Natural&quot;) or Chrome (&quot;Google&quot; voices).
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto bg-mira-page px-4 py-6 [@media(max-height:500px)]:py-3">
          <div className="mx-auto max-w-3xl space-y-5">
            {messages.length === 0 && (
              <div className="py-6 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-mira-blue text-white">
                  <Stethoscope size={26} aria-hidden />
                </div>
                <h2 className="text-xl font-semibold">Hi Nurse {studentName}! What shall we study?</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-mira-muted">
                  Ask anything about your nursing subjects. Nurse Mira answers from the shared library when it can and shows its sources.
                  {mode === "tea" ? " You're in Tea Mode — friendly and relaxed." : " You're in Clinical Mode — formal and exam-ready."}
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {suggestions.map((s) => (
                    <button key={s} type="button" onClick={() => send(s)} disabled={sending || remaining === 0} className="rounded-full bg-white px-3 py-2 text-sm ring-1 ring-mira-line hover:ring-mira-blue disabled:opacity-50">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex justify-end">
                  <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-mira-blue px-4 py-3 text-sm text-white">{m.content}</p>
                </div>
              ) : (
                <div key={m.id} className="flex">
                  <Answer message={m} speaking={speakingId === m.id} onSpeak={() => (voiceSupported.speak ? speak(m) : undefined)} />
                </div>
              ),
            )}

            {sending && (
              <div className="flex items-center gap-2 text-sm text-mira-muted" role="status">
                <span className="flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-mira-blue [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-mira-blue [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-mira-blue" />
                </span>
                Nurse Mira is checking the library and thinking…
              </div>
            )}
            <div ref={endRef} />
          </div>
        </div>

        {/* Composer */}
        <div className="border-t border-mira-line bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] [@media(max-height:500px)]:py-1.5">
          <div className="mx-auto max-w-3xl">
            {banner && (
              <div
                role="alert"
                className={`mb-2 flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-sm ${banner.kind === "limit" ? "bg-amber-50 text-amber-900" : "bg-red-50 text-mira-danger"}`}
              >
                <span className="flex-1">{banner.text}</span>
                {banner.retry && (
                  <button type="button" onClick={() => send(banner.retry)} className="rounded-md bg-white px-2 py-1 text-xs font-medium ring-1 ring-current">
                    Try again
                  </button>
                )}
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="flex items-end gap-2"
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                maxLength={4000}
                placeholder={remaining === 0 ? "No answers left today — they reset at midnight" : "Ask Nurse Mira a nursing question…"}
                aria-label="Your question"
                className="max-h-40 min-h-[44px] flex-1 resize-y rounded-xl border border-mira-line px-3 py-2.5 text-sm outline-none focus:border-mira-blue focus:ring-2 focus:ring-mira-blue/20"
              />
              {voiceSupported.mic && (
                <button
                  type="button"
                  onClick={toggleMic}
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${listening ? "bg-red-50 text-mira-danger ring-red-200" : "bg-white text-mira-muted ring-mira-line hover:text-mira-ink"}`}
                  aria-label={listening ? "Stop listening" : "Speak your question"}
                  title={listening ? "Stop listening" : "Speak your question"}
                >
                  {listening ? <MicOff size={19} /> : <Mic size={19} />}
                </button>
              )}
              <button
                type="submit"
                disabled={!input.trim() || sending || remaining === 0}
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-mira-blue text-white hover:bg-mira-blue-dark disabled:opacity-50"
                aria-label="Send"
              >
                <SendHorizontal size={19} />
              </button>
            </form>
            <p className="mt-1.5 text-center text-[11px] text-mira-muted [@media(max-height:500px)]:hidden">
              For learning only — not a substitute for your clinical instructor. Never type real patient names or details.
              {listening && " Listening… (your browser may send speech to its own service to turn it into text)."}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
