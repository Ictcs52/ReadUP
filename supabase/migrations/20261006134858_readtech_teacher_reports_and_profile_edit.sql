begin;
-- Serialize identity corrections across devices. These columns are written by the backend only.
alter table public.readtech_students
  add column account_edit_token uuid,
  add column account_edit_until timestamptz,
  add constraint readtech_student_edit_lease check ((account_edit_token is null) = (account_edit_until is null));
-- Changing the student ID also requires a server-side Auth username update.
revoke update (code) on public.readtech_students from authenticated;

create or replace function public.readtech_save_session(p_student_id uuid, p_payload jsonb, p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_owner uuid;
  v_is_teacher boolean;
  v_id uuid;
  v_lesson integer;
  v_version integer;
  v_started timestamptz;
  v_ended timestamptz;
  v_status text;
  v_row public.readtech_sessions%rowtype;
  v_revision bigint;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select s.teacher_id, (s.teacher_id = v_actor) into v_owner, v_is_teacher
  from public.readtech_students s
  join public.readtech_teachers t on t.id = s.teacher_id and t.active
  where s.id = p_student_id and
    (s.teacher_id = v_actor or (s.auth_user_id = v_actor and s.login_enabled));
  if v_owner is null then
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
  -- Teachers may assess an existing round, but cannot create or change learner practice.
  if v_is_teacher then
    if v_row.id is null or (p_payload - 'observation') is distinct from (v_row.payload - 'observation') then
      raise exception 'Teacher may only update observations' using errcode = '42501';
    end if;
  end if;
  if not v_is_teacher then
    p_payload := p_payload - 'observation';
    if v_row.id is not null and v_row.payload ? 'observation' then
      p_payload := p_payload || jsonb_build_object('observation', v_row.payload->'observation');
    end if;
  end if;
  if v_row.id is not null then
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
