// Public connection details for Nurse Mira's Supabase project.
// These two values are designed to be public (they ship to every browser);
// data is protected by Row Level Security in the database, not by hiding them.
// Secret keys never go here — see SETUP_GUIDE.md.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://kkvsyepuguwyzndpjqea.supabase.co";

export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_RcGQa_FC_TGSfFT9vcnWDA_a81wH5QZ";
