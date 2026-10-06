begin;
-- Pure validation, SECURITY INVOKER, reads no tables and exposes no user data.
create function public.readtech_prepost_valid(criteria jsonb,pre jsonb,post jsonb) returns boolean
language plpgsql stable security invoker set search_path='' as $$
declare item jsonb; phase jsonb; key text; n numeric; idx integer; date_pre timestamptz; date_post timestamptz;
begin
 if jsonb_typeof(criteria) is distinct from 'array' or jsonb_array_length(criteria)<>5 then return false;end if;
 for item in select value from jsonb_array_elements(criteria) loop
  if jsonb_typeof(item) is distinct from 'object' or item-array['max_score','method']<>'{}'::jsonb
   or jsonb_typeof(item->'max_score') is distinct from 'number' or jsonb_typeof(item->'method') is distinct from 'string'
   or length(btrim(item->>'method')) not between 1 and 500 then return false;end if;
  n=(item->>'max_score')::numeric;if n<=0 or n>10000 or n*100<>trunc(n*100) then return false;end if;
 end loop;
 if pre is null and post is not null then return false;end if;
 foreach phase in array array[pre,post] loop
  if phase is null then continue;end if;
  if jsonb_typeof(phase) is distinct from 'object' or phase-array['scores','assessed_at','reading_text','help_level','correct_words','incorrect_words','letter_swaps','skipped_words','stops','reading_seconds','note','comparable']<>'{}'::jsonb
   or jsonb_typeof(phase->'scores') is distinct from 'array' or jsonb_array_length(phase->'scores')<>5
   or jsonb_typeof(phase->'assessed_at') is distinct from 'string' or not isfinite((phase->>'assessed_at')::timestamptz)
   or jsonb_typeof(phase->'reading_text') is distinct from 'string' or length(btrim(phase->>'reading_text')) not between 1 and 500
   or jsonb_typeof(phase->'note') is distinct from 'string' or length(phase->>'note')>500
   or jsonb_typeof(phase->'comparable') is distinct from 'boolean'
   or jsonb_typeof(phase->'help_level') is distinct from 'string' or phase->>'help_level' not in ('independent','prompted','guided','full') then return false;end if;
  for idx in 0..4 loop
   if jsonb_typeof(phase->'scores'->idx) is distinct from 'number' then return false;end if;
   n=(phase->'scores'->>idx)::numeric;if n<0 or n>(criteria->idx->>'max_score')::numeric or n*100<>trunc(n*100) then return false;end if;
  end loop;
  foreach key in array array['correct_words','incorrect_words','letter_swaps','skipped_words','stops','reading_seconds'] loop
   if not phase?key then return false;end if;
   if phase->key='null'::jsonb then continue;end if;
   if jsonb_typeof(phase->key) is distinct from 'number' then return false;end if;
   n=(phase->>key)::numeric;
   if n<>trunc(n) or n<(case when key='reading_seconds' then 1 else 0 end) or n>(case when key='reading_seconds' then 86400 else 10000 end) then return false;end if;
  end loop;
  if (phase->>'correct_words' is null)<>(phase->>'incorrect_words' is null) then return false;end if;
  if phase->>'correct_words' is not null and ((phase->>'correct_words')::integer+(phase->>'incorrect_words')::integer not between 1 and 10000) then return false;end if;
  if phase->>'skipped_words' is not null and phase->>'incorrect_words' is not null and (phase->>'skipped_words')::integer>(phase->>'incorrect_words')::integer then return false;end if;
 end loop;
 if pre is not null and post is not null then
  date_pre=(pre->>'assessed_at')::timestamptz;date_post=(post->>'assessed_at')::timestamptz;if date_post<date_pre then return false;end if;
 end if;
 return true;
exception when others then return false;
end;$$;
revoke all on function public.readtech_prepost_valid(jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.readtech_prepost_valid(jsonb,jsonb,jsonb) to authenticated,service_role;
create table public.readtech_prepost_assessments(
 id uuid primary key default gen_random_uuid(),student_id uuid not null,teacher_id uuid not null,
 title text not null check(length(btrim(title)) between 1 and 200),criteria jsonb not null,pre jsonb,post jsonb,
 revision bigint not null default 1 check(revision>0),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(student_id,teacher_id) references public.readtech_students(id,teacher_id) on delete restrict,
 check(public.readtech_prepost_valid(criteria,pre,post))
);
create index readtech_prepost_student_date on public.readtech_prepost_assessments(student_id,teacher_id,created_at desc,id desc);
create index readtech_prepost_teacher on public.readtech_prepost_assessments(teacher_id);
alter table public.readtech_prepost_assessments enable row level security;
revoke all on public.readtech_prepost_assessments from public,anon,authenticated;
grant select on public.readtech_prepost_assessments to authenticated;
grant insert(id,student_id,teacher_id,title,criteria) on public.readtech_prepost_assessments to authenticated;
grant update(pre,post) on public.readtech_prepost_assessments to authenticated;
grant all on public.readtech_prepost_assessments to service_role;
create policy readtech_prepost_select on public.readtech_prepost_assessments for select to authenticated using(
 teacher_id=(select auth.uid()) and exists(select 1 from public.readtech_teachers t where t.id=(select auth.uid()) and t.active)
 and exists(select 1 from public.readtech_students s where s.id=readtech_prepost_assessments.student_id and s.teacher_id=(select auth.uid())));
create policy readtech_prepost_insert on public.readtech_prepost_assessments for insert to authenticated with check(
 teacher_id=(select auth.uid()) and exists(select 1 from public.readtech_teachers t where t.id=(select auth.uid()) and t.active)
 and exists(select 1 from public.readtech_students s where s.id=readtech_prepost_assessments.student_id and s.teacher_id=(select auth.uid())));
create policy readtech_prepost_update on public.readtech_prepost_assessments for update to authenticated using(
 teacher_id=(select auth.uid()) and exists(select 1 from public.readtech_teachers t where t.id=(select auth.uid()) and t.active)
 and exists(select 1 from public.readtech_students s where s.id=readtech_prepost_assessments.student_id and s.teacher_id=(select auth.uid()))) with check(
 teacher_id=(select auth.uid()) and exists(select 1 from public.readtech_teachers t where t.id=(select auth.uid()) and t.active)
 and exists(select 1 from public.readtech_students s where s.id=readtech_prepost_assessments.student_id and s.teacher_id=(select auth.uid())));
create function public.readtech_prepost_revision() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if (new.id,new.student_id,new.teacher_id,new.title,new.criteria,new.created_at) is distinct from (old.id,old.student_id,old.teacher_id,old.title,old.criteria,old.created_at) then raise exception 'Assessment identity and criteria cannot change' using errcode='22023';end if;
 if new.pre is distinct from old.pre and new.post is not null then new.post=jsonb_set(new.post,'{comparable}','false'::jsonb);end if;
 new.revision=old.revision+1;new.updated_at=now();return new;
end;$$;
revoke all on function public.readtech_prepost_revision() from public,anon,authenticated;
create trigger readtech_prepost_before_update before update on public.readtech_prepost_assessments for each row execute function public.readtech_prepost_revision();
comment on table public.readtech_prepost_assessments is 'Teacher-entered paired pre/post observations using immutable teacher-defined criteria, not validated tests or game scores. Comparable is the teacher judgement.';
commit;
