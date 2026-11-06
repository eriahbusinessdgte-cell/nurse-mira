export type Subject = {
  id: string;
  code: string;
  title: string;
  year_level: number;
  semester: number;
  description?: string | null;
  is_active?: boolean;
};

/** Groups subjects as Year → Semester, in curriculum order. */
export function groupSubjects<T extends Subject>(subjects: T[]) {
  const groups: { year: number; semester: number; subjects: T[] }[] = [];
  for (const s of subjects) {
    let g = groups.find((x) => x.year === s.year_level && x.semester === s.semester);
    if (!g) {
      g = { year: s.year_level, semester: s.semester, subjects: [] };
      groups.push(g);
    }
    g.subjects.push(s);
  }
  return groups.sort((a, b) => a.year - b.year || a.semester - b.semester);
}
