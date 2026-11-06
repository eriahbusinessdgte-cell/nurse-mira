"use client";

// Makes photo-heavy uploads smaller, in the student's browser, for free:
// every page is re-saved as a lighter JPEG picture and put into a new PDF.
// The text Nurse Mira learns from is read before this step, so nothing is lost
// for the AI — only the stored copy is lighter.
import { renderScale, shouldShrinkImage, shouldShrinkPdf, worthKeeping } from "./shrink-rules";

const JPEG_QUALITY = 0.7;

const toJpeg = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't compress the page."))), "image/jpeg", JPEG_QUALITY),
  );

async function shrinkPdf(file: File, onProgress: (m: string) => void): Promise<File> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.mjs";
  const { PDFDocument } = await import("pdf-lib");
  const source = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const out = await PDFDocument.create();

  for (let n = 1; n <= source.numPages; n++) {
    onProgress(`Making the file smaller — page ${n} of ${source.numPages}…`);
    const page = await source.getPage(n);
    const base = page.getViewport({ scale: 1 }); // size in PDF points
    const viewport = page.getViewport({ scale: renderScale(base.width, base.height) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, viewport }).promise;
    const jpg = await out.embedJpg(await (await toJpeg(canvas)).arrayBuffer());
    const p = out.addPage([base.width, base.height]);
    p.drawImage(jpg, { x: 0, y: 0, width: base.width, height: base.height });
    canvas.width = 0;
  }
  const bytes = await out.save();
  return new File([bytes as BlobPart], file.name, { type: "application/pdf" });
}

async function shrinkImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await toJpeg(canvas);
  return new File([blob], file.name.replace(/\.(png|jpe?g)$/i, ".jpg"), { type: "image/jpeg" });
}

/**
 * Returns a smaller copy when it's worth it, otherwise null (keep the original).
 * Never throws: if anything goes wrong, the original is simply uploaded.
 */
export async function maybeShrink(
  file: File,
  kind: string,
  pageCount: number | null,
  photoPages: number,
  onProgress: (m: string) => void,
): Promise<File | null> {
  try {
    let smaller: File | null = null;
    if (kind === "application/pdf" && shouldShrinkPdf(file.size, pageCount, photoPages)) smaller = await shrinkPdf(file, onProgress);
    else if ((kind === "image/jpeg" || kind === "image/png") && shouldShrinkImage(file.size)) {
      onProgress("Making the photo smaller…");
      smaller = await shrinkImage(file);
    }
    return smaller && worthKeeping(file.size, smaller.size) ? smaller : null;
  } catch {
    return null;
  }
}
