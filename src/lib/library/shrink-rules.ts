// When to make an upload smaller. Pure functions so they can be unit-tested.

export const SHRINK_MIN_BYTES = 5 * 1024 * 1024; // only files over 5 MB
export const SHRINK_MIN_PHOTO_SHARE = 0.5; // ...that are at least half photo pages
export const SHRINK_MIN_SAVING = 0.15; // keep the smaller copy only if it saves at least 15%

export function shouldShrinkPdf(sizeBytes: number, pageCount: number | null, photoPages: number) {
  if (!pageCount || sizeBytes < SHRINK_MIN_BYTES) return false;
  return photoPages / pageCount >= SHRINK_MIN_PHOTO_SHARE;
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
