// AI Tutor chats are deleted 30 days after their last message unless the student keeps them (D-056).
export const CHAT_KEEP_DAYS = 30;

/** Whole days left before an un-kept chat is deleted (0 = deleted at the next daily clean-up). */
export function chatDaysLeft(lastMessageAt: string, now = Date.now()): number {
  const ageDays = (now - new Date(lastMessageAt).getTime()) / 86_400_000;
  return Math.max(0, Math.ceil(CHAT_KEEP_DAYS - ageDays));
}

export function expiryLabel(kept: boolean, lastMessageAt: string, now = Date.now()): string {
  if (kept) return "Kept";
  const d = chatDaysLeft(lastMessageAt, now);
  return d <= 1 ? "Deletes within a day unless kept" : `Deletes in ${d} days unless kept`;
}
