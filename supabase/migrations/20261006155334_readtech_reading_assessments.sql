begin;

-- Actual reading observations entered by a teacher, independent of game sessions.
create table public.readtech_reading_assessments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null,
  teacher_id uuid not null,
  assessed_at timestamptz not null default now(),
  reading_text text not null default '' check (length(reading_text) <= 500),
  correct_words integer not null check (correct_words between 0 and 10000),
  incorrect_words integer not null check (incorrect_words between 0 and 10000),
  letter_swaps integer not null default 0 check (letter_swaps between 0 and 10000),
  skipped_words integer not null default 0 check (skipped_words between 0 and 10000),
  stops integer not null default 0 check (stops between 0 and 10000),
  reading_seconds integer check (reading_seconds between 1 and 86400),
  help_level text not null check (help_level in ('independent','prompted','guided','full')),
  note text not null default '' check (length(note) <= 500),
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (student_id,teacher_id) references public.readtech_students(id,teacher_id) on delete restrict,
  check (correct_words + incorrect_words between 1 and 10000),
  check (skipped_words <= incorrect_words)
);
create index readtech_reading_student_date on public.readtech_reading_assessments(student_id,assessed_at desc,id desc);
create index readtech_reading_owner on public.readtech_reading_assessments(teacher_id);
alter table public.readtech_reading_assessments enable row level security;

revoke all on public.readtech_reading_assessments from public,anon,authenticated;
grant select on public.readtech_reading_assessments to authenticated;
grant insert (id,student_id,teacher_id,assessed_at,reading_text,correct_words,incorrect_words,letter_swaps,skipped_words,stops,reading_seconds,help_level,note)
  on public.readtech_reading_assessments to authenticated;
grant update (assessed_at,reading_text,correct_words,incorrect_words,letter_swaps,skipped_words,stops,reading_seconds,help_level,note)
  on public.readtech_reading_assessments to authenticated;
grant all on public.readtech_reading_assessments to service_role;

create policy readtech_reading_select on public.readtech_reading_assessments for select to authenticated using (
  teacher_id = (select auth.uid()) and exists(select 1 from public.readtech_teachers t where t.id = (select auth.uid()) and t.active)
  and exists(select 1 from public.readtech_students s where s.id = readtech_reading_assessments.student_id and s.teacher_id = (select auth.uid()))
);
create policy readtech_reading_insert on public.readtech_reading_assessments for insert to authenticated with check (
  teacher_id = (select auth.uid()) and exists(select 1 from public.readtech_teachers t where t.id = (select auth.uid()) and t.active)
  and exists(select 1 from public.readtech_students s where s.id = readtech_reading_assessments.student_id and s.teacher_id = (select auth.uid()))
);
create policy readtech_reading_update on public.readtech_reading_assessments for update to authenticated using (
  teacher_id = (select auth.uid()) and exists(select 1 from public.readtech_teachers t where t.id = (select auth.uid()) and t.active)
  and exists(select 1 from public.readtech_students s where s.id = readtech_reading_assessments.student_id and s.teacher_id = (select auth.uid()))
) with check (
  teacher_id = (select auth.uid()) and exists(select 1 from public.readtech_teachers t where t.id = (select auth.uid()) and t.active)
  and exists(select 1 from public.readtech_students s where s.id = readtech_reading_assessments.student_id and s.teacher_id = (select auth.uid()))
);

-- Optimistic updates use WHERE revision = the revision loaded by the editor.
-- The trigger increments it atomically, with no direct revision/identity grants.
create function public.readtech_reading_revision() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if (new.id,new.student_id,new.teacher_id,new.created_at) is distinct from (old.id,old.student_id,old.teacher_id,old.created_at) then
    raise exception 'Reading assessment identity cannot change' using errcode = '22023';
  end if;
  new.revision := old.revision + 1;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.readtech_reading_revision() from public,anon,authenticated;
create trigger readtech_reading_before_update before update on public.readtech_reading_assessments
  for each row execute function public.readtech_reading_revision();

comment on table public.readtech_reading_assessments is 'Teacher-entered reading observations; not game scores, pre/post tests, or evidence of learning effectiveness.';
comment on column public.readtech_reading_assessments.incorrect_words is 'Includes skipped or unread words; accuracy denominator is correct_words + incorrect_words.';
comment on column public.readtech_reading_assessments.reading_seconds is 'Manual reading duration in seconds; NULL means not timed.';
commit;
