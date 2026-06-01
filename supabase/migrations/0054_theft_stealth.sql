-- ============================================================================
-- BibSync — theft is stealth. The victim must NOTICE they've been robbed (their
-- coins drop) and decide to claim; the app must never reveal it. Remove all
-- client read access and the realtime feed for thefts — only the service role
-- (the claim action) ever reads them. Supersedes the policy/realtime in 0052.
-- ============================================================================

drop policy if exists thefts_select_own on public.thefts;

do $$
begin
  alter publication supabase_realtime drop table public.thefts;
exception when others then null;
end $$;
