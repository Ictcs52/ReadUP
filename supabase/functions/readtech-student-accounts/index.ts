import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};
const columns = 'id,teacher_id,code,display_name,created_at,auth_user_id,login_id,login_enabled';
function reply(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers }); }
function digits(length: number) {
  // Rejection sampling avoids biased modulo conversion and preserves leading zeroes.
  let result = '';
  while (result.length < length) {
    for (const byte of crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (byte < 250) result += String(byte % 10);
      if (result.length === length) break;
    }
  }
  return result;
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  const bearer = req.headers.get('Authorization');
  if (!bearer?.startsWith('Bearer ')) return reply({ error: 'กรุณาเข้าสู่ระบบครูก่อน' }, 401);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // Validate with Auth before using any privileged table or account operation.
  const { data: identity, error: authError } = await admin.auth.getUser(bearer.slice(7));
  if (authError || !identity.user) return reply({ error: 'กรุณาเข้าสู่ระบบครูก่อน' }, 401);
  const teacherId = identity.user.id;
  const { data: teacher, error: teacherError } = await admin.from('readtech_teachers').select('id').eq('id', teacherId).eq('active', true).maybeSingle();
  if (teacherError) return reply({ error: 'ตรวจสิทธิ์ไม่สำเร็จ กรุณาลองอีกครั้ง' }, 503);
  if (!teacher) return reply({ error: 'บัญชีนี้ไม่มีสิทธิ์ลงทะเบียนผู้เรียน' }, 403);

  try {
    if (Number(req.headers.get('Content-Length') ?? 0) > 2048) return reply({ error: 'ข้อมูลยาวเกินไป' }, 400);
    const raw = await req.text();
    if (raw.length > 2048) return reply({ error: 'ข้อมูลยาวเกินไป' }, 400);
    const body = JSON.parse(raw);
    if (!['register', 'reset', 'disable', 'enable'].includes(body.action)) return reply({ error: 'คำสั่งไม่ถูกต้อง' }, 400);
    let student: any = null;
    if (body.studentId) {
      if (!/^[0-9a-f-]{36}$/i.test(body.studentId)) return reply({ error: 'ผู้เรียนไม่ถูกต้อง' }, 400);
      const { data, error } = await admin.from('readtech_students').select(columns).eq('id', body.studentId).eq('teacher_id', teacherId).maybeSingle();
      if (error) return reply({ error: 'อ่านผู้เรียนไม่สำเร็จ' }, 503);
      if (!data) return reply({ error: 'ไม่พบผู้เรียนในความดูแลของครู' }, 403);
      student = data;
    }
    if (body.action !== 'register' && !student?.auth_user_id) return reply({ error: 'สร้างบัญชีเข้าเรียนให้ผู้เรียนก่อน' }, 400);
    if (body.action === 'disable' || body.action === 'enable') {
      const { data, error } = await admin.from('readtech_students').update({ login_enabled: body.action === 'enable' }).eq('id', student.id).eq('teacher_id', teacherId).select(columns).single();
      if (error) return reply({ error: 'เปลี่ยนสถานะบัญชีไม่สำเร็จ' }, 503);
      return reply({ student: data, loginId: data.login_id, password: '' });
    }
    const password = digits(12);
    if (body.action === 'reset') {
      const { error } = await admin.auth.admin.updateUserById(student.auth_user_id, { password });
      if (error) return reply({ error: 'ออกรหัสผ่านใหม่ไม่สำเร็จ' }, 503);
      return reply({ student, loginId: student.login_id, password });
    }
    if (student?.auth_user_id) return reply({ error: 'มีบัญชีเข้าเรียนแล้ว ใช้ปุ่มออกรหัสผ่านใหม่ได้' }, 409);
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!student && (!/^[A-Za-z0-9_-]{2,32}$/.test(code) || !name || name.length > 50)) return reply({ error: 'กรอกรหัสผู้เรียน 2–32 ตัวและชื่อเรียกไม่เกิน 50 ตัว' }, 400);
    if (!student) {
      const { data: duplicate, error } = await admin.from('readtech_students').select('id').eq('teacher_id', teacherId).eq('code', code).maybeSingle();
      if (error) return reply({ error: 'ตรวจรหัสผู้เรียนไม่สำเร็จ' }, 503);
      if (duplicate) return reply({ error: 'รหัสผู้เรียนนี้มีอยู่แล้ว ใช้รหัสอื่นได้' }, 409);
    }
    let authUser: any = null;
    let loginId = '';
    for (let attempt = 0; attempt < 3; attempt++) {
      loginId = digits(10);
      const { data, error } = await admin.auth.admin.createUser({
        email: `student-${loginId}@students.readup.invalid`, password, email_confirm: true,
        app_metadata: { readtech_role: 'student' },
      });
      if (!error && data.user) { authUser = data.user; break; }
      if (error?.code !== 'email_exists') return reply({ error: 'สร้างบัญชีไม่สำเร็จ กรุณาลองอีกครั้ง' }, 503);
    }
    if (!authUser) return reply({ error: 'สร้างรหัสไม่สำเร็จ กรุณาลองอีกครั้ง' }, 503);
    // Conditional linking prevents simultaneous teacher requests from replacing an account.
    const result = student
      ? await admin.from('readtech_students').update({ auth_user_id: authUser.id, login_id: loginId, login_enabled: true }).eq('id', student.id).eq('teacher_id', teacherId).is('auth_user_id', null).select(columns).single()
      : await admin.from('readtech_students').insert({ teacher_id: teacherId, code, display_name: name, auth_user_id: authUser.id, login_id: loginId, login_enabled: true }).select(columns).single();
    if (result.error) {
      await admin.auth.admin.deleteUser(authUser.id);
      return reply({ error: result.error.code === '23505' ? 'รหัสผู้เรียนซ้ำ กรุณาโหลดรายชื่ออีกครั้ง' : 'บันทึกบัญชีไม่สำเร็จ กรุณาโหลดรายชื่อก่อนลองใหม่' }, 409);
    }
    return reply({ student: result.data, loginId, password });
  } catch { return reply({ error: 'ทำรายการไม่สำเร็จ กรุณาลองอีกครั้ง' }, 400); }
});
