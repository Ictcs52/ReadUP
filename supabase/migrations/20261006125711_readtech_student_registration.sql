-- Add classroom data without changing any existing account or learning history.
alter table public.readtech_students
  add column class_name text not null default '' check (length(trim(class_name)) <= 30);

alter table public.readtech_students
  drop constraint readtech_students_login_id_check,
  drop constraint readtech_students_display_name_check;
alter table public.readtech_students
  add constraint readtech_students_login_id_check check (login_id ~ '^([0-9]{4}|[0-9]{10})$'),
  add constraint readtech_students_display_name_check check (length(trim(display_name)) between 1 and 100),
  add constraint readtech_student_id_login_match check (login_id is null or length(login_id) = 10 or login_id = code);

-- Existing teacher ownership policies also apply to this profile field.
grant update (class_name) on public.readtech_students to authenticated;
