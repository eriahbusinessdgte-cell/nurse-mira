// Admin Settings: allowed ranges and checks (shared by the page and the save action).

export type AppSettings = {
  daily_answer_pool: number;
  daily_answer_minimum: number;
  page_reading_budget: number;
  default_tutor_mode: "tea" | "clinical";
};

export const DEFAULTS: AppSettings = {
  daily_answer_pool: 90,
  daily_answer_minimum: 5,
  page_reading_budget: 6500,
  default_tutor_mode: "tea",
};

export const LIMITS = {
  pool: { min: 10, max: 300, comfortable: 120 },
  minimum: { min: 1, max: 30 },
  pages: { min: 0, max: 9500 },
};

/** Cloudflare units one photographed page uses, on average (measured: 80–90). */
export const UNITS_PER_PAGE = 85;

export const pagesFor = (units: number) => Math.floor(units / UNITS_PER_PAGE);

/** Same rule as the database's student_daily_limit(). */
export const shareFor = (pool: number, minimum: number, activeStudents: number) =>
  Math.max(minimum, Math.floor(pool / Math.max(1, activeStudents)));

export function readSettings(rows: { key: string; value: unknown }[] | null | undefined): AppSettings {
  const get = (k: string) => rows?.find((r) => r.key === k)?.value;
  const num = (k: keyof AppSettings) => {
    const n = Number(get(k));
    return Number.isFinite(n) ? n : (DEFAULTS[k] as number);
  };
  return {
    daily_answer_pool: num("daily_answer_pool"),
    daily_answer_minimum: num("daily_answer_minimum"),
    page_reading_budget: num("page_reading_budget"),
    default_tutor_mode: get("default_tutor_mode") === "clinical" ? "clinical" : "tea",
  };
}

export type Checked = { ok: true; settings: AppSettings } | { ok: false; message: string };

export function checkSettings(input: Record<string, unknown>): Checked {
  const whole = (v: unknown) => {
    const n = Number(String(v ?? "").replace(/,/g, "").trim());
    return Number.isInteger(n) ? n : NaN;
  };
  const pool = whole(input.daily_answer_pool);
  const minimum = whole(input.daily_answer_minimum);
  const pages = whole(input.page_reading_budget);
  const mode = input.default_tutor_mode;

  if (!(pool >= LIMITS.pool.min && pool <= LIMITS.pool.max))
    return { ok: false, message: `The daily answer pool must be a whole number from ${LIMITS.pool.min} to ${LIMITS.pool.max}.` };
  if (!(minimum >= LIMITS.minimum.min && minimum <= LIMITS.minimum.max))
    return { ok: false, message: `The minimum per student must be a whole number from ${LIMITS.minimum.min} to ${LIMITS.minimum.max}.` };
  if (minimum > pool) return { ok: false, message: "The minimum per student can't be bigger than the whole pool." };
  if (!(pages >= LIMITS.pages.min && pages <= LIMITS.pages.max))
    return { ok: false, message: `The page-reading allowance must be a whole number from ${LIMITS.pages.min} to ${LIMITS.pages.max.toLocaleString()}.` };
  if (mode !== "tea" && mode !== "clinical") return { ok: false, message: "Please choose a starting tutor mode." };

  return { ok: true, settings: { daily_answer_pool: pool, daily_answer_minimum: minimum, page_reading_budget: pages, default_tutor_mode: mode } };
}
