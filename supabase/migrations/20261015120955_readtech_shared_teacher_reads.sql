-- Approved teachers share read access. Account management, assessments and
-- session writes keep their existing owner-only authorization.
alter policy readtech_student_read on public.readtech_students
using (exists (select 1 from public.readtech_teachers t where t.id = (select auth.uid()) and t.active));
alter policy readtech_session_read on public.readtech_sessions
using (exists (select 1 from public.readtech_teachers t where t.id = (select auth.uid()) and t.active));
alter policy readtech_reading_select on public.readtech_reading_assessments
using (exists (select 1 from public.readtech_teachers t where t.id = (select auth.uid()) and t.active));
alter policy readtech_prepost_select on public.readtech_prepost_assessments
using (exists (select 1 from public.readtech_teachers t where t.id = (select auth.uid()) and t.active));
