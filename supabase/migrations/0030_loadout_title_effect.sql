-- ============================================================================
-- BibSync — premium cosmetics beyond avatar emblems: a flair "title" shown next
-- to your name, and an animated name "effect". Two new loadout slots; the
-- catalogue + pricing live in src/lib/cosmetics/catalog.ts.
-- ============================================================================

alter table public.user_loadout
  add column if not exists title text,
  add column if not exists effect text;
