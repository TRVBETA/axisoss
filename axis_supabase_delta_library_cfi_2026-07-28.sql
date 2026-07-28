-- AXIS library: add EPUB CFI column so the reader can resume where the user left off.
-- Safe to run multiple times. Run in Supabase SQL editor before deploying the new library.js.

ALTER TABLE IF EXISTS public.library_books
  ADD COLUMN IF NOT EXISTS location_cfi text;

-- Normalize old fake totals (150/320) to the new 0-100 percent scale.
UPDATE public.library_books
   SET total_pages = 100
 WHERE total_pages IN (150, 320);
