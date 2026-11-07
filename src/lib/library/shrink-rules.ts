// When to make an upload smaller. Pure functions so they can be unit-tested.

export const SHRINK_MIN_BYTES = 5 * 1024 * 1024; // only files over 5 MB
export const SHRINK_MIN_PHOTO_SHARE = 0.5; // ...that are at least half photo pages
export const SHRINK_MIN_SAVING = 0.15; // keep the smaller copy only if it saves at least 15%

export function shouldShrinkPdf(sizeBytes: number, pageCount: number | null, photoPages: number) {
  if (!pageCount || sizeBytes < SHRINK_MIN_BYTES) return false;
  return photoPages / pageCount >= SHRINK_MIN_PHOTO_SHARE;
}

/** For files already in the library: big files averaging over 150 KB a page are photo-heavy. */
export function looksPhotoHeavy(sizeBytes: number, pageCount: number | null, mimeType: string) {
  if (mimeType.startsWith("image/")) return shouldShrinkImage(sizeBytes);
  if (mimeType !== "application/pdf" || !pageCount || sizeBytes < SHRINK_MIN_BYTES) return false;
  return sizeBytes / pageCount >= 150 * 1024;
}

export function shouldShrinkImage(sizeBytes: number) {
  return sizeBytes > 2 * 1024 * 1024;
}

export function worthKeeping(originalBytes: number, smallerBytes: number) {
  return smallerBytes > 0 && smallerBytes <= originalBytes * (1 - SHRINK_MIN_SAVING);
}

/** Scale that renders a page so its longest side is about `target` pixels (never above 2×). */
export function renderScale(widthPt: number, heightPt: number, target = 1700) {
  return Math.min(2, target / Math.max(widthPt, heightPt));
}

/** Most pages were photographed and at most this share of them couldn't be read → store a typed copy. */
export const TYPED_COPY_MIN_PHOTO_SHARE = 0.5;
export const TYPED_COPY_MAX_UNREADABLE = 0.1;

/**
 * D-059: photographed reviewers are stored as a small typed Word copy instead of the photos —
 * but only when the reading went well, so no notes are lost.
 */
export function shouldMakeTypedCopy(x: { mime: string; pageCount: number | null; imagePages: number; unreadable: number; chars: number }) {
  if (x.chars < 300) return false;
  const pages = x.mime.startsWith("image/") ? 1 : (x.pageCount ?? 0);
  const photos = x.mime.startsWith("image/") ? 1 : x.imagePages;
  if (!pages || photos / pages < TYPED_COPY_MIN_PHOTO_SHARE) return false;
  return x.unreadable / photos <= TYPED_COPY_MAX_UNREADABLE;
}
