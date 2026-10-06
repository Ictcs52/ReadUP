begin;
-- Optional teacher observations; old records remain unobserved (NULL).
-- Existing owner-only RLS and revision/identity protections still apply.
alter table public.readtech_reading_assessments
  add column participation text check (participation in ('independent','prompted','supported')),
  add column confidence text check (confidence in ('independent','encouraged','supported'));
grant insert (participation,confidence), update (participation,confidence)
  on public.readtech_reading_assessments to authenticated;
comment on column public.readtech_reading_assessments.participation is 'Teacher-observed participation at this assessment; NULL means not observed.';
comment on column public.readtech_reading_assessments.confidence is 'Teacher-observed reading confidence at this assessment; NULL means not observed, not a diagnostic score.';
commit;
