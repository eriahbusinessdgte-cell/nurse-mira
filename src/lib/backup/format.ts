// Nurse Mira backup file format (.nmb).
//
// A backup is the app's records as JSON, gzip-compressed, then locked with the admin's
// backup password (PBKDF2-SHA256 → AES-256-GCM). Layout of the file:
//   "NMB1" (4 bytes) | salt (16) | iv (12) | encrypted data
// Without the password the file is unreadable — and the password can't be recovered.
// Works in the browser and in Node 20+ (both have Web Crypto and CompressionStream).

export const TABLE_ORDER = [
  "subjects",
  "topics",
  "profiles",
  "student_subjects",
  "app_settings",
  "documents",
  "document_chunks",
  "conversations",
  "messages",
  "ai_usage",
  "review_sheets",
  "quizzes",
  "quiz_attempts",
  "case_studies",
  "care_plans",
  "planner_items",
  "cloudflare_usage",
] as const;
export type TableName = (typeof TABLE_ORDER)[number];

export const TABLE_LABEL: Record<TableName, string> = {
  subjects: "Subjects",
  topics: "Topics",
  profiles: "People (accounts)",
  student_subjects: "Student subject choices",
  app_settings: "App settings",
  documents: "Library documents",
  document_chunks: "Library text pieces",
  conversations: "Tutor chats",
  messages: "Tutor messages",
  ai_usage: "Daily answer counts",
  review_sheets: "Study sheets",
  quizzes: "Quizzes",
  quiz_attempts: "Quiz results",
  case_studies: "Case studies",
  care_plans: "Nursing care plans",
  planner_items: "Planner items",
  cloudflare_usage: "Page-reading usage",
};

export type Row = Record<string, unknown>;
export type BackupData = { app: "nurse-mira"; version: 1; created_at: string; tables: Partial<Record<TableName, Row[]>> };

const MAGIC = new TextEncoder().encode("NMB1");
const ITERATIONS = 310_000;
export const MIN_PASSWORD = 10;

async function keyFrom(password: string, salt: Uint8Array, usage: KeyUsage) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: ITERATIONS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    [usage],
  );
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export async function lockBackup(data: BackupData, password: string): Promise<Uint8Array> {
  const packed = await pipe(new TextEncoder().encode(JSON.stringify(data)), new CompressionStream("gzip"));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFrom(password, salt, "encrypt");
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, packed as BufferSource));
  const file = new Uint8Array(4 + 16 + 12 + sealed.length);
  file.set(MAGIC, 0);
  file.set(salt, 4);
  file.set(iv, 20);
  file.set(sealed, 32);
  return file;
}

export class BackupError extends Error {}

export async function unlockBackup(file: Uint8Array, password: string): Promise<BackupData> {
  if (file.length < 33 || !MAGIC.every((b, i) => file[i] === b)) {
    throw new BackupError("This isn't a Nurse Mira backup file.");
  }
  const key = await keyFrom(password, file.slice(4, 20), "decrypt");
  let packed: Uint8Array;
  try {
    packed = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: file.slice(20, 32) }, key, file.slice(32)));
  } catch {
    throw new BackupError("That password doesn't open this backup (or the file is damaged).");
  }
  const data = JSON.parse(new TextDecoder().decode(await pipe(packed, new DecompressionStream("gzip")))) as BackupData;
  if (data?.app !== "nurse-mira" || data.version !== 1 || typeof data.tables !== "object") {
    throw new BackupError("This backup was made by a different version and can't be read.");
  }
  return data;
}

/**
 * Splits a table's rows into requests for the restore. Text pieces and chat messages
 * are kept together per document / chat (the server puts them back all-or-nothing).
 */
export function restoreBatches(table: TableName, rows: Row[], size = 800): Row[][] {
  const parent = table === "document_chunks" ? "document_id" : table === "messages" ? "conversation_id" : null;
  if (!parent) {
    const out: Row[][] = [];
    for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
    return out;
  }
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const k = String(r[parent]);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const out: Row[][] = [];
  let current: Row[] = [];
  for (const g of groups.values()) {
    if (current.length && current.length + g.length > size) {
      out.push(current);
      current = [];
    }
    current = current.concat(g);
  }
  if (current.length) out.push(current);
  return out;
}

export const backupFileName = (d = new Date()) => {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(d);
  return `nurse-mira-backup-${day}.nmb`;
};

export const daysSince = (iso: string | null | undefined, now = Date.now()) =>
  iso ? Math.floor((now - new Date(iso).getTime()) / 86_400_000) : null;
