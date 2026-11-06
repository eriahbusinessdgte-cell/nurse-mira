// Read-aloud for the AI Tutor, using the voices already on the student's device (free).
// We pick the most natural-sounding English voice available and speak in short pieces,
// which sounds livelier and avoids Chrome cutting long speech off.

const STORE_KEY = "nurse-mira.voice";

/** Higher = more natural. Edge's "Natural"/"Online" voices and Google's voices sound best. */
export function voiceScore(v: { name: string; lang: string; localService?: boolean }): number {
  const name = v.name.toLowerCase();
  const lang = v.lang.toLowerCase().replace("_", "-");
  if (!lang.startsWith("en")) return -1;
  let s = 0;
  if (/natural|neural/.test(name)) s += 100;
  if (/online/.test(name)) s += 40;
  if (/premium|enhanced/.test(name)) s += 60;
  if (/^google/.test(name)) s += 50;
  if (/(aria|jenny|ava|emma|michelle|sonia|libby|natasha|clara|samantha|zoe|serena|allison|karen|moira|tessa|female)/.test(name)) s += 15;
  if (lang === "en-us") s += 8;
  else if (lang === "en-ph" || lang === "en-gb" || lang === "en-au") s += 5;
  if (/espeak|compact|novelty|whisper|bad news|bells|boing|bubbles|cellos|jester|organ|trinoids|zarvox|albert|fred|junior|ralph/.test(name)) s -= 80;
  return s;
}

export function englishVoices(all: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  return all.filter((v) => voiceScore(v) >= 0).sort((a, b) => voiceScore(b) - voiceScore(a));
}

export function savedVoiceName(): string | null {
  try {
    return localStorage.getItem(STORE_KEY);
  } catch {
    return null;
  }
}
export function saveVoiceName(name: string) {
  try {
    localStorage.setItem(STORE_KEY, name);
  } catch {
    /* private mode etc. — just don't remember it */
  }
}

/** Turn a markdown answer into natural spoken sentences. */
export function toSpeech(md: string): string[] {
  const text = md
    .replace(/\[S\d{1,2}\]\(#source-\d+\)|\[S\d{1,2}\]/g, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/^\s*\|?[-:| ]{3,}\|?\s*$/gm, "")
    .replace(/\|/g, ", ")
    .replace(/^#{1,6}\s*(.+)$/gm, "$1.")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/[*_`>~]/g, "")
    .replace(/→|->/g, " then ")
    .replace(/≥/g, " at least ")
    .replace(/≤/g, " at most ")
    .replace(/\be\.g\.,?/gi, "for example,")
    .replace(/\bi\.e\.,?/gi, "that is,")
    .replace(/\bvs\.?\b/gi, "versus")
    .replace(/–|—/g, ", ")
    .replace(/:\s*\n/g, ". ")
    .replace(/([^.!?:;,])\s*\n+/g, "$1. ")
    .replace(/\s+/g, " ")
    .trim();
  // Split into sentences, then group into pieces of up to ~220 characters.
  const sentences = text.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [text];
  const pieces: string[] = [];
  let cur = "";
  for (const raw of sentences) {
    const s = raw.trim();
    if (!s) continue;
    if ((cur + " " + s).length > 220 && cur) {
      pieces.push(cur);
      cur = s;
    } else cur = cur ? `${cur} ${s}` : s;
  }
  if (cur) pieces.push(cur);
  return pieces;
}

/** Speak a list of pieces one after another. Returns a stop function. */
export function speakPieces(
  pieces: string[],
  opts: { voice: SpeechSynthesisVoice | null; cheerful: boolean; onEnd: () => void },
): () => void {
  const synth = window.speechSynthesis;
  let stopped = false;
  synth.cancel();
  const next = (i: number) => {
    if (stopped) return;
    if (i >= pieces.length) return opts.onEnd();
    const u = new SpeechSynthesisUtterance(pieces[i]);
    if (opts.voice) {
      u.voice = opts.voice;
      u.lang = opts.voice.lang;
    } else u.lang = "en-US";
    // A slightly brighter, quicker delivery sounds friendlier; Clinical stays neutral.
    u.pitch = opts.cheerful ? 1.12 : 1;
    u.rate = opts.cheerful ? 1.06 : 1;
    u.onend = () => next(i + 1);
    u.onerror = (e) => {
      if (e.error === "interrupted" || e.error === "canceled") return;
      next(i + 1);
    };
    synth.speak(u);
  };
  next(0);
  return () => {
    stopped = true;
    synth.cancel();
  };
}
