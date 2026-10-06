-- Run once in a Supabase project's SQL Editor, as the project administrator.
-- Teachers must be explicitly approved by the administrator; signup grants no data access.
begin;

create table public.readtech_teachers (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null check (length(trim(display_name)) between 1 and 80),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.readtech_students (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.readtech_teachers(id) on delete restrict,
  code text not null check (code ~ '^[A-Za-z0-9_-]{2,32}$'),
  display_name text not null check (length(trim(display_name)) between 1 and 50),
  created_at timestamptz not null default now(),
  unique (teacher_id, code),
  unique (id, teacher_id)
);
create table public.readtech_sessions (
  id uuid primary key,
  student_id uuid not null,
  teacher_id uuid not null,
  lesson_id integer not null check (lesson_id between 1 and 30),
  content_version integer not null default 1 check (content_version > 0),
  revision bigint not null default 1 check (revision > 0),
  started_at timestamptz not null,
  ended_at timestamptz,
  status text not null check (status in ('active','complete','ended')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz not null default now(),
  foreign key (student_id, teacher_id) references public.readtech_students(id, teacher_id) on delete restrict,
  check (ended_at is null or ended_at >= started_at)
);
create index readtech_sessions_student_date on public.readtech_sessions(student_id, started_at, id);
create index readtech_sessions_owner on public.readtech_sessions(teacher_id);

alter table public.readtech_teachers enable row level security;
alter table public.readtech_students enable row level security;
alter table public.readtech_sessions enable row level security;

revoke all on public.readtech_teachers, public.readtech_students, public.readtech_sessions from public, anon, authenticated;
grant select on public.readtech_teachers, public.readtech_students, public.readtech_sessions to authenticated;
grant insert (teacher_id, code, display_name) on public.readtech_students to authenticated;
grant update (code, display_name) on public.readtech_students to authenticated;
-- Administration through a trusted backend only, never a frontend key.
grant all on public.readtech_teachers, public.readtech_students, public.readtech_sessions to service_role;

create policy readtech_teacher_self on public.readtech_teachers for select to authenticated using (id = (select auth.uid()));
create policy readtech_student_read on public.readtech_students for select to authenticated using (
  teacher_id = (select auth.uid()) and exists(select 1 from public.readtech_teachers t where t.id = (select auth.uid()) and t.active)
);
create policy readtech_student_insert on public.readtech_students for insert to authenticated with check (
  teacher_id = (select auth.uid()) and exists(select 1 from public.readtech_teachers t where t.id = (select auth.uid()) and t.active)
);
create policy readtech_student_update on public.readtech_students for update to authenticated using (
  teacher_id = (select auth.uid()) and exists(select 1 from public.readtech_teachers t where t.id = (select auth.uid()) and t.active)
) with check (
  teacher_id = (select auth.uid()) and exists(select 1 from public.readtech_teachers t where t.id = (select auth.uid()) and t.active)
);
create policy readtech_session_read on public.readtech_sessions for select to authenticated using (
  teacher_id = (select auth.uid()) and exists(select 1 from public.readtech_teachers t where t.id = (select auth.uid()) and t.active)
);

-- Atomic version check prevents a stale/offline browser from overwriting another device.
-- SECURITY DEFINER is necessary because direct session writes are deliberately not granted.
-- Every write verifies authenticated identity, active teacher approval, and student ownership.
create function public.readtech_save_session(p_student_id uuid, p_payload jsonb, p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := auth.uid();
  v_id uuid;
  v_lesson integer;
  v_version integer;
  v_started timestamptz;
  v_ended timestamptz;
  v_status text;
  v_row public.readtech_sessions%rowtype;
  v_revision bigint;
begin
  if v_owner is null or not exists(select 1 from public.readtech_teachers where id = v_owner and active) then
    raise exception 'Teacher access required' using errcode = '42501';
  end if;
  if not exists(select 1 from public.readtech_students where id = p_student_id and teacher_id = v_owner) then
    raise exception 'Student access denied' using errcode = '42501';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 or p_payload is null
    or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 65536
    or jsonb_typeof(p_payload->'records') is distinct from 'array'
    or jsonb_typeof(p_payload->'questionIndices') is distinct from 'array'
    or jsonb_typeof(p_payload->'answered') is distinct from 'boolean'
    or jsonb_typeof(p_payload->'index') is distinct from 'number'
    or jsonb_typeof(p_payload->'lessonId') is distinct from 'number'
    or jsonb_typeof(p_payload->'startedAt') is distinct from 'number'
    or jsonb_typeof(p_payload->'wrongAttempts') is distinct from 'number'
    or jsonb_typeof(p_payload->'hintLevel') is distinct from 'number'
    or jsonb_typeof(p_payload->'currentMs') is distinct from 'number' then
    raise exception 'Invalid session' using errcode = '22023';
  end if;
  if jsonb_array_length(p_payload->'questionIndices') not between 1 and 100
    or jsonb_array_length(p_payload->'records') > jsonb_array_length(p_payload->'questionIndices')
    or (p_payload->>'index')::integer not between 0 and jsonb_array_length(p_payload->'questionIndices') - 1
    or (p_payload->>'hintLevel')::integer not between 0 and 3
    or (p_payload->>'wrongAttempts')::integer < 0 or (p_payload->>'currentMs')::numeric < 0 then
    raise exception 'Invalid question progress' using errcode = '22023';
  end if;
  v_id := (p_payload->>'id')::uuid;
  v_lesson := (p_payload->>'lessonId')::integer;
  v_version := coalesce((p_payload->>'contentVersion')::integer, 1);
  v_status := p_payload->>'status';
  v_started := to_timestamp((p_payload->>'startedAt')::double precision / 1000);
  v_ended := to_timestamp((p_payload->>'endedAt')::double precision / 1000);
  if v_id is null or v_lesson is null or v_started is null or v_status is null then
    raise exception 'Missing session fields' using errcode = '22023';
  end if;
  select * into v_row from public.readtech_sessions where id = v_id for update;
  if found then
    if v_row.teacher_id <> v_owner or v_row.student_id <> p_student_id then
      raise exception 'Session access denied' using errcode = '42501';
    end if;
    -- A response can be lost after the commit. Retrying the identical write is safe.
    if v_row.revision = p_expected_revision + 1 and v_row.payload = p_payload then
      return jsonb_build_object('id', v_id, 'revision', v_row.revision);
    end if;
    if v_row.revision <> p_expected_revision then
      raise exception 'Session changed on another device' using errcode = '40001';
    end if;
    if v_row.lesson_id <> v_lesson or v_row.content_version <> v_version or v_row.started_at <> v_started then
      raise exception 'Session identity cannot change' using errcode = '22023';
    end if;
    v_revision := v_row.revision + 1;
    update public.readtech_sessions set payload = p_payload, revision = v_revision, status = v_status,
      ended_at = v_ended, updated_at = now() where id = v_id;
  else
    if p_expected_revision <> 0 then
      raise exception 'Session revision missing' using errcode = '40001';
    end if;
    v_revision := 1;
    begin
      insert into public.readtech_sessions(id,student_id,teacher_id,lesson_id,content_version,started_at,ended_at,status,payload,revision)
      values(v_id,p_student_id,v_owner,v_lesson,v_version,v_started,v_ended,v_status,p_payload,v_revision);
    exception when unique_violation then
      raise exception 'Session changed on another device' using errcode = '40001';
    end;
  end if;
  return jsonb_build_object('id', v_id, 'revision', v_revision);
end;
$$;
revoke all on function public.readtech_save_session(uuid,jsonb,bigint) from public, anon;
grant execute on function public.readtech_save_session(uuid,jsonb,bigint) to authenticated;
commit;
