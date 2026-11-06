"use client";

// Reads the text out of an uploaded file, in the student's own browser, using
// free libraries. Nothing is sent to an outside service. Heavy libraries are
// loaded only when needed.
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
export const MAX_BYTES = 25 * 1024 * 1024;
const MAX_OCR_PAGES = 30;
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
  if (photoPages.length) {
    const toRead = photoPages.slice(0, MAX_OCR_PAGES);
    unreadable.push(...photoPages.slice(MAX_OCR_PAGES));
    const canvases: HTMLCanvasElement[] = [];
    for (const n of toRead) {
      onProgress(`Preparing photo page ${n}…`);
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvas, viewport }).promise;
      canvases.push(canvas);
    }
    const results = await ocrImages(canvases, onProgress, (i) => `Reading photo page ${i + 1} of ${toRead.length}…`);
    results.forEach((r, i) => {
      const n = toRead[i];
      const target = pages.find((p) => p.page === n)!;
      if (r.confidence >= MIN_OCR_CONFIDENCE && r.text.trim().length >= MIN_PAGE_CHARS) {
        target.text = `${target.text}\n${r.text}`.trim();
      } else {
        unreadable.push(n);
      }
      canvases[i].width = 0; // free memory
    });
  }

  const method = photoPages.length === 0 ? "text" : photoPages.length === pages.length ? "ocr" : "mixed";
  return { pages, pageCount: doc.numPages, method, imagePages: photoPages.length, unreadablePages: unreadable.sort((a, b) => a - b) };
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
  if (file.size > MAX_BYTES) throw new ExtractError("This file is larger than 25 MB. Please compress it or split it into smaller files.");
  if (file.size === 0) throw new ExtractError("This file is empty.");

  onProgress("Reading the file…");
  if (kind === "application/pdf") return readPdf(file, onProgress);
  if (kind.includes("wordprocessingml")) return readDocx(file);
  if (kind.includes("presentationml")) return readPptx(file);
  if (kind === "text/plain") {
    return { pages: [{ page: null, text: await file.text() }], pageCount: null, method: "text", imagePages: 0, unreadablePages: [] };
  }
  const [r] = await ocrImages([file], onProgress, () => "Reading text from the photo…");
  const ok = r.confidence >= MIN_OCR_CONFIDENCE;
  return { pages: [{ page: 1, text: ok ? r.text : "" }], pageCount: 1, method: "ocr", imagePages: 1, unreadablePages: ok ? [] : [1] };
}
