export const SOURCE_TYPES: { value: string; label: string; hint: string }[] = [
  { value: "student_notes", label: "Student reviewer or notes", hint: "Made by a student" },
  { value: "school_material", label: "School material", hint: "Lecture slides, handouts from instructors" },
  { value: "textbook", label: "Textbook or reference", hint: "Published nursing or medical book" },
  { value: "official_guidance", label: "Official guidance", hint: "DOH, PRC, WHO or other official publications" },
  { value: "review_center", label: "Review-center material", hint: "Only with permission to share" },
  { value: "other", label: "Other", hint: "" },
];

export const sourceLabel = (v: string) => SOURCE_TYPES.find((s) => s.value === v)?.label ?? v;

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 KB";
  const units = ["bytes", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n < 10 && i > 0 ? n.toFixed(1) : Math.round(n)} ${units[i]}`;
}

export const PROCESSING_LABEL: Record<string, { label: string; tone: "green" | "yellow" | "red" | "gray" }> = {
  ready: { label: "Ready", tone: "green" },
  processing: { label: "Processing", tone: "yellow" },
  uploading: { label: "Uploading", tone: "yellow" },
  failed: { label: "Needs attention", tone: "red" },
};
