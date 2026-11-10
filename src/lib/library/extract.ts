"use client";

// Reads the text out of an uploaded file in the student's own browser, using free
// libraries. Typed text never leaves the browser. Photo pages (handwriting, scans)
// are sent one at a time to Nurse Mira's page reader (Cloudflare's free vision AI);
// if that isn't available, the free in-browser reader is used instead.
// Heavy libraries are loaded only when needed.
import { createClient } from "@/lib/supabase/client";
import { reportProblem } from "@/lib/report-problem";
import type { Page } from "./chunk";

export const ACCEPTED: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint",
  "text/plain": "Text",
  "image/jpeg": "Photo",
  "image/png": "Photo",
};
export const ACCEPT_ATTR = ".pdf,.docx,.pptx,.txt,.jpg,.jpeg,.png";
/** Largest file that can be stored as it is (the storage bucket's limit). */
export const MAX_BYTES = 25 * 1024 * 1024;
/** Largest file the browser will read. Bigger-than-25 MB files are stored as a smaller or typed copy. */
export const MAX_READ_BYTES = 100 * 1024 * 1024;
const MAX_OCR_PAGES = 30;
const MAX_VISION_PAGES = 80;
const VISION_WIDTH = 1600; // pixels; enough for handwriting, small enough to send quickly
const VISION_PARALLEL = 3;
const MIN_PAGE_CHARS = 40; // a page with less typed text than this is treated as a photo/scan
const MIN_OCR_CONFIDENCE = 60; // below this, the free reader's result is too unreliable to keep

/** Works out the file type from its name when the browser doesn't say. */
export function fileKind(file: File): string | null {
  if (ACCEPTED[file.type]) return file.type;
  const ext = file.name.toLowerCase().split(".").pop();
  const byExt: Record<string, string> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    txt: "text/plain",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
  };
  return (ext && byExt[ext]) || null;
}

export async function sha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type Extracted = {
  pages: Page[];
  pageCount: number | null;
  method: "text" | "ocr" | "mixed";
  /** Pages that are photos or scans (no typed text). */
  imagePages: number;
  /** Photo pages whose writing couldn't be read reliably (often handwriting). */
  unreadablePages: number[];
  /** A message about the page reader (e.g. today's free reading is used up). */
  notice?: string;
};
type Progress = (message: string) => void;

export class ExtractError extends Error {}

type OcrResult = { text: string; confidence: number };

async function ocrImages(images: (Blob | HTMLCanvasElement)[], onProgress: Progress, label: (i: number) => string): Promise<OcrResult[]> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const out: OcrResult[] = [];
    for (let i = 0; i < images.length; i++) {
      onProgress(label(i));
      const { data } = await worker.recognize(images[i]);
      out.push({ text: data.text ?? "", confidence: data.confidence ?? 0 });
    }
    return out;
  } finally {
    await worker.terminate();
  }
}

type VisionResult = { ok: true; text: string; readable: boolean } | { ok: false; stop: boolean; message: string };

function canvasToBase64(canvas: HTMLCanvasElement): Promise<string> {
  // Shrink very large pages first.
  let source = canvas;
  if (canvas.width > VISION_WIDTH) {
    const scale = VISION_WIDTH / canvas.width;
    source = document.createElement("canvas");
    source.width = VISION_WIDTH;
    source.height = Math.round(canvas.height * scale);
    source.getContext("2d")!.drawImage(canvas, 0, 0, source.width, source.height);
  }
  return new Promise((resolve, reject) =>
    source.toBlob(
      (blob) => {
        if (source !== canvas) source.width = 0;
        if (!blob) return reject(new Error("Couldn't prepare the page picture."));
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      },
      "image/jpeg",
      0.8,
    ),
  );
}

/** Sends one page picture to Nurse Mira's page reader. */
export async function readWithVision(canvas: HTMLCanvasElement): Promise<VisionResult> {
  try {
    const image = await canvasToBase64(canvas);
    const { data, error } = await createClient().functions.invoke("read-page", { body: { image } });
    if (error || !data) {
      reportProblem("read-page", "unreachable", "The page reader couldn't be reached.");
      return { ok: false, stop: false, message: "The page reader couldn't be reached." };
    }
    if (data.kind === "budget" || data.kind === "unavailable") {
      reportProblem("read-page", data.kind, String(data.error));
      return { ok: false, stop: true, message: String(data.error) };
    }
    if (data.error) return { ok: false, stop: false, message: String(data.error) };
    return { ok: true, text: String(data.text ?? ""), readable: !!data.readable };
  } catch {
    return { ok: false, stop: false, message: "The page reader couldn't be reached." };
  }
}

async function imageToCanvas(file: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}

async function loadPdf(file: File) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.mjs";
  try {
    return await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  } catch (e) {
    const name = (e as { name?: string })?.name;
    if (name === "PasswordException") throw new ExtractError("This PDF is password-protected. Please remove the password and upload it again.");
    throw new ExtractError("This PDF couldn't be opened. It may be damaged. Try saving it again as a PDF.");
  }
}

async function readPdf(file: File, onProgress: Progress): Promise<Extracted> {
  const doc = await loadPdf(file);

  // 1. Typed text, page by page.
  const pages: Page[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    onProgress(`Reading page ${n} of ${doc.numPages}…`);
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const text = content.items.map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "")).join("");
    pages.push({ page: n, text });
  }

  // 2. Pages with (almost) no typed text are photos or scans: read them as pictures.
  const photoPages = pages.filter((p) => p.text.trim().length < MIN_PAGE_CHARS).map((p) => p.page as number);
  const unreadable: number[] = [];
  let notice: string | undefined;
  if (photoPages.length) {
    const render = async (n: number, width: number) => {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(3, Math.max(1, width / base.width)) });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvas, viewport }).promise;
      return canvas;
    };
    const setText = (n: number, text: string) => {
      const target = pages.find((p) => p.page === n)!;
      target.text = `${target.text}\n${text}`.trim();
    };

    // 2a. Nurse Mira's page reader (reads handwriting), a few pages at a time.
    const visionPages = photoPages.slice(0, MAX_VISION_PAGES);
    const leftover: number[] = photoPages.slice(MAX_VISION_PAGES);
    let stopped = false;
    let done = 0;
    const queue = [...visionPages];
    const worker = async () => {
      while (queue.length) {
        const n = queue.shift()!;
        if (stopped) {
          leftover.push(n);
          continue;
        }
        const canvas = await render(n, VISION_WIDTH);
        const r = await readWithVision(canvas);
        canvas.width = 0;
        done++;
        onProgress(`Reading photo page ${done} of ${visionPages.length} (handwriting too)…`);
        if (r.ok) {
          if (r.readable) setText(n, r.text);
          else unreadable.push(n);
        } else {
          if (r.stop) {
            stopped = true;
            notice = r.message;
          }
          leftover.push(n);
        }
      }
    };
    onProgress(`Reading photo page 1 of ${visionPages.length} (handwriting too)…`);
    await Promise.all(Array.from({ length: Math.min(VISION_PARALLEL, visionPages.length) }, worker));

    // 2b. Anything left: the free in-browser reader (good for clear print, weak on handwriting).
    leftover.sort((a, b) => a - b);
    const toRead = leftover.slice(0, MAX_OCR_PAGES);
    unreadable.push(...leftover.slice(MAX_OCR_PAGES));
    if (toRead.length) {
      const canvases: HTMLCanvasElement[] = [];
      for (const n of toRead) {
        onProgress(`Preparing photo page ${n}…`);
        canvases.push(await render(n, 1200));
      }
      const results = await ocrImages(canvases, onProgress, (i) => `Reading photo page ${i + 1} of ${toRead.length}…`);
      results.forEach((r, i) => {
        const n = toRead[i];
        if (r.confidence >= MIN_OCR_CONFIDENCE && r.text.trim().length >= MIN_PAGE_CHARS) setText(n, r.text);
        else unreadable.push(n);
        canvases[i].width = 0; // free memory
      });
    }
  }

  const method = photoPages.length === 0 ? "text" : photoPages.length === pages.length ? "ocr" : "mixed";
  return { pages, pageCount: doc.numPages, method, imagePages: photoPages.length, unreadablePages: unreadable.sort((a, b) => a - b), notice };
}

/**
 * Typed text only, page by page, for large open textbooks (no size limit, no photo reading —
 * a textbook's picture-only pages are diagrams, not notes). Frees each page as it goes.
 */
export async function readPdfText(file: File, onProgress: Progress = () => {}): Promise<{ pages: Page[]; pageCount: number }> {
  if (fileKind(file) !== "application/pdf") throw new ExtractError("Please choose the textbook's PDF file.");
  onProgress("Opening the book…");
  const doc = await loadPdf(file);
  const pages: Page[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    if (n === 1 || n % 10 === 0) onProgress(`Reading page ${n} of ${doc.numPages}…`);
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    pages.push({ page: n, text: content.items.map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "")).join("") });
    page.cleanup();
  }
  const pageCount = doc.numPages;
  await doc.cleanup();
  return { pages, pageCount };
}

async function readDocx(file: File): Promise<Extracted> {
  const mammoth = (await import("mammoth/mammoth.browser")).default;
  const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return { pages: [{ page: null, text: value }], pageCount: null, method: "text", imagePages: 0, unreadablePages: [] };
}

async function readPptx(file: File): Promise<Extracted> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const slides = Object.keys(zip.files)
    .map((name) => ({ name, n: Number(name.match(/^ppt\/slides\/slide(\d+)\.xml$/)?.[1]) }))
    .filter((s) => s.n)
    .sort((a, b) => a.n - b.n);
  const pages: Page[] = [];
  for (const s of slides) {
    const xml = await zip.file(s.name)!.async("string");
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const paragraphs = [...doc.getElementsByTagName("a:p")].map((p) =>
      [...p.getElementsByTagName("a:t")].map((t) => t.textContent ?? "").join(""),
    );
    pages.push({ page: s.n, text: paragraphs.filter(Boolean).join("\n") });
  }
  return { pages, pageCount: slides.length, method: "text", imagePages: 0, unreadablePages: [] };
}

export async function extractText(file: File, onProgress: Progress = () => {}): Promise<Extracted> {
  const kind = fileKind(file);
  if (!kind) throw new ExtractError("This type of file isn't supported. Please upload a PDF, Word (.docx), PowerPoint (.pptx), text file, or a JPG/PNG photo.");
  if (file.size > MAX_READ_BYTES) throw new ExtractError("This file is larger than 100 MB. Please split it into smaller files. (Adding a whole open textbook? The admin can use “Add textbook” in the Shared Library.)");
  if (file.size === 0) throw new ExtractError("This file is empty.");

  onProgress("Reading the file…");
  if (kind === "application/pdf") return readPdf(file, onProgress);
  if (kind.includes("wordprocessingml")) return readDocx(file);
  if (kind.includes("presentationml")) return readPptx(file);
  if (kind === "text/plain") {
    return { pages: [{ page: null, text: await file.text() }], pageCount: null, method: "text", imagePages: 0, unreadablePages: [] };
  }
  onProgress("Reading the photo (handwriting too)…");
  const canvas = await imageToCanvas(file);
  const v = await readWithVision(canvas);
  canvas.width = 0;
  if (v.ok) {
    return { pages: [{ page: 1, text: v.readable ? v.text : "" }], pageCount: 1, method: "ocr", imagePages: 1, unreadablePages: v.readable ? [] : [1] };
  }
  const [r] = await ocrImages([file], onProgress, () => "Reading text from the photo…");
  const ok = r.confidence >= MIN_OCR_CONFIDENCE;
  return { pages: [{ page: 1, text: ok ? r.text : "" }], pageCount: 1, method: "ocr", imagePages: 1, unreadablePages: ok ? [] : [1], notice: v.message };
}
