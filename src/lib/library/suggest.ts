// Suggests subject, topic and title for an upload from its file name and first
// pages, by matching against the curriculum. No AI service is used.

export type SubjectLite = { id: string; code: string; title: string; year_level: number; semester: number };
export type TopicLite = { id: string; subject_id: string; name: string };

const STOP = new Set([
  "and", "the", "of", "for", "with", "care", "clients", "client", "problems", "in", "to", "or", "at", "risk",
  "acute", "chronic", "nursing", "practice", "as", "a", "an", "on", "by", "level",
]);

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));

/** "NCM-109_preeclampsia reviewer (final).pdf" → "NCM 109 Preeclampsia Reviewer (Final)" */
export function titleFromFilename(filename: string): string {
  const base = filename
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[_]+/g, " ")
    .replace(/\b(ncm|mc)[ -]?(\d{1,3})\b/gi, (_, a: string, b: string) => `${a.toUpperCase()} ${b}`)
    .replace(/\s+-\s+/g, " - ")
    .replace(/\s+/g, " ")
    .trim();
  return base
    .split(" ")
    .map((w) => (w === w.toLowerCase() && w.length > 2 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ")
    .slice(0, 200);
}

export function suggestMetadata(filename: string, text: string, subjects: SubjectLite[], topics: TopicLite[]) {
  const sample = `${filename}\n${text.slice(0, 6000)}`;
  const sampleLower = sample.toLowerCase();
  const sampleWords = new Set(words(sample));

  // 1. An explicit subject code ("NCM 109", "MC2") is the strongest signal.
  let subject: SubjectLite | undefined;
  const codeMatch = sample.match(/\b(NCM|MC)[ -]?(\d{1,3})\b/i);
  if (codeMatch) {
    const code = `${codeMatch[1].toUpperCase()} ${Number(codeMatch[2])}`;
    subject = subjects.find((s) => s.code.toUpperCase() === code);
  }

  // 2. Topic names that appear in the text.
  const topicHits = topics
    .filter((t) => t.name.length > 3 && sampleLower.includes(t.name.toLowerCase()))
    .sort((a, b) => b.name.length - a.name.length);
  let topic = subject ? topicHits.find((t) => t.subject_id === subject!.id) : topicHits[0];
  if (!subject && topic) subject = subjects.find((s) => s.id === topic!.subject_id);

  // 3. Otherwise, the subject whose title words appear most.
  if (!subject) {
    let best = 0;
    for (const s of subjects) {
      const tw = words(s.title);
      if (!tw.length) continue;
      const score = tw.filter((w) => sampleWords.has(w)).length / tw.length;
      if (score > best && score >= 0.5) {
        best = score;
        subject = s;
      }
    }
  }
  if (subject && topic && topic.subject_id !== subject.id) topic = undefined;

  return {
    title: titleFromFilename(filename),
    subject_id: subject?.id ?? null,
    topic_id: topic?.id ?? null,
    year_level: subject?.year_level ?? null,
    semester: subject?.semester ?? null,
  };
}
