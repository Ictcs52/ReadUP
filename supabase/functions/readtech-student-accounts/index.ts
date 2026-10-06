import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};
const columns = 'id,teacher_id,code,display_name,class_name,created_at,auth_user_id,login_id,login_enabled';
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
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) },
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
    if (!['register', 'reset', 'disable', 'enable', 'edit'].includes(body.action)) return reply({ error: 'คำสั่งไม่ถูกต้อง' }, 400);
    let student: any = null;
    if (body.studentId) {
      if (!/^[0-9a-f-]{36}$/i.test(body.studentId)) return reply({ error: 'ผู้เรียนไม่ถูกต้อง' }, 400);
      const { data, error } = await admin.from('readtech_students').select(columns + ',account_edit_token,account_edit_until').eq('id', body.studentId).eq('teacher_id', teacherId).maybeSingle();
      if (error) return reply({ error: 'อ่านผู้เรียนไม่สำเร็จ' }, 503);
      if (!data) return reply({ error: 'ไม่พบผู้เรียนในความดูแลของครู' }, 403);
      student = data;
    }
    if (student?.account_edit_token && Date.parse(student.account_edit_until) > Date.now()) return reply({ error: 'บัญชีนี้กำลังบันทึกข้อมูล กรุณารอสักครู่แล้วลองอีกครั้ง' }, 409);
    if (body.action === 'edit') {
      if (!student) return reply({ error: 'ไม่พบผู้เรียนในความดูแลของครู' }, 403);
      const code = typeof body.code === 'string' ? body.code.trim() : '';
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const className = typeof body.className === 'string' ? body.className.trim() : '';
      if (code !== student.code && !/^[0-9]{4}$/.test(code)) return reply({ error: 'เลขประจำตัวใหม่ต้องเป็นตัวเลข 4 หลัก' }, 400);
      if (!/^ป\.[1-6]$/.test(className)) return reply({ error: 'เลือกชั้น ป.1–ป.6' }, 400);
      if (!code || !name || name.length > 100) return reply({ error: 'กรอกเลขประจำตัว ชื่อ–สกุล และชั้นให้ครบ' }, 400);
      if (body.expected?.code !== student.code || body.expected?.name !== student.display_name || body.expected?.className !== student.class_name) return reply({ error: 'ข้อมูลเปลี่ยนจากอีกเครื่อง กรุณาโหลดรายชื่อแล้วแก้ไขใหม่' }, 409);
      const { data: duplicate, error: duplicateError } = await admin.from('readtech_students').select('id').eq('teacher_id', teacherId).eq('code', code).neq('id', student.id).maybeSingle();
      if (duplicateError) return reply({ error: 'ตรวจเลขประจำตัวไม่สำเร็จ' }, 503);
      if (duplicate) return reply({ error: 'เลขประจำตัวนี้มีอยู่แล้ว' }, 409);
      const token = crypto.randomUUID();
      const lease = await admin.from('readtech_students').update({ account_edit_token: token, account_edit_until: new Date(Date.now()+600000).toISOString() })
        .eq('id', student.id).eq('teacher_id', teacherId).eq('code', student.code).eq('display_name', student.display_name).eq('class_name', student.class_name)
        .or(`account_edit_token.is.null,account_edit_until.lt.${new Date().toISOString()}`).select('id').maybeSingle();
      if (lease.error || !lease.data) return reply({ error: 'ข้อมูลกำลังเปลี่ยน กรุณาโหลดรายชื่อแล้วลองอีกครั้ง' }, 409);
      const loginId = student.auth_user_id && code !== student.code ? code : student.login_id;
      const changeAuth = Boolean(student.auth_user_id && (loginId !== student.login_id || student.account_edit_token));
      let authChanged = false;
      let releaseLease = !student.account_edit_token;
      try {
        if (changeAuth) {
          const auth = await admin.auth.admin.updateUserById(student.auth_user_id, { email: `student-${loginId}@students.readup.invalid`, email_confirm: true });
          if (auth.error) return reply({ error: ['email_exists','email_address_not_authorized'].includes(auth.error.code || '') ? 'เลขประจำตัวนี้มีบัญชีเข้าเรียนแล้ว' : 'เปลี่ยนชื่อผู้ใช้ไม่สำเร็จ กรุณาลองอีกครั้ง' }, auth.error.code === 'email_exists' ? 409 : 503);
          authChanged = true;
        }
        const saved = await admin.from('readtech_students').update({ code, display_name: name, class_name: className, login_id: loginId, account_edit_token: null, account_edit_until: null })
          .eq('id', student.id).eq('teacher_id', teacherId).eq('account_edit_token', token).select(columns).single();
        if (saved.error) {
          if (authChanged) {
            const rollback = await admin.auth.admin.updateUserById(student.auth_user_id, { email: `student-${student.login_id}@students.readup.invalid`, email_confirm: true });
            releaseLease = !rollback.error;
          }
          return reply({ error: saved.error.code === '23505' ? 'เลขประจำตัวนี้มีอยู่แล้ว' : 'บันทึกไม่สำเร็จ กรุณาโหลดรายชื่อแล้วลองอีกครั้ง' }, 409);
        }
        releaseLease = true;
        return reply({ student: saved.data, loginId: saved.data.login_id || '', password: '' });
      } finally {
        if (releaseLease) await admin.from('readtech_students').update({ account_edit_token: null, account_edit_until: null }).eq('id',student.id).eq('teacher_id',teacherId).eq('account_edit_token',token);
      }
    }
    if (body.action !== 'register' && !student?.auth_user_id) return reply({ error: 'สร้างบัญชีเข้าเรียนให้ผู้เรียนก่อน' }, 400);
    if (body.action === 'disable' || body.action === 'enable') {
      const { data, error } = await admin.from('readtech_students').update({ login_enabled: body.action === 'enable' }).eq('id', student.id).eq('teacher_id', teacherId).select(columns).single();
      if (error) return reply({ error: 'เปลี่ยนสถานะบัญชีไม่สำเร็จ' }, 503);
      return reply({ student: data, loginId: data.login_id, password: '' });
    }
    const password = student?.login_id && /^[0-9]{4}$/.test(student.login_id) ? `RT-${student.login_id}` : digits(12);
    if (body.action === 'reset') {
      const { error } = await admin.auth.admin.updateUserById(student.auth_user_id, { password });
      if (error) return reply({ error: 'ออกรหัสผ่านใหม่ไม่สำเร็จ' }, 503);
      const safeStudent = Object.fromEntries(columns.split(',').map(key=>[key,student[key]]));
      return reply({ student: safeStudent, loginId: student.login_id, password });
    }
    if (student?.auth_user_id) return reply({ error: 'มีบัญชีเข้าเรียนแล้ว ใช้ปุ่มออกรหัสผ่านใหม่ได้' }, 409);
    const code = student?.code ?? (typeof body.code === 'string' ? body.code.trim() : '');
    const name = student?.display_name ?? (typeof body.name === 'string' ? body.name.trim() : '');
    const className = student?.class_name ?? (typeof body.className === 'string' ? body.className.trim() : '');
    if (!/^[0-9]{4}$/.test(code)) return reply({ error: 'เลขประจำตัวต้องเป็นตัวเลข 4 หลัก' }, 400);
    if (!student && !/^ป\.[1-6]$/.test(className)) return reply({ error: 'เลือกชั้น ป.1–ป.6' }, 400);
    if (!name || name.length > 100 || className.length > 30) return reply({ error: 'กรอกชื่อ–สกุลไม่เกิน 100 ตัว และชั้นไม่เกิน 30 ตัว' }, 400);
    if (!student) {
      const { data: duplicate, error } = await admin.from('readtech_students').select('id').eq('teacher_id', teacherId).eq('code', code).maybeSingle();
      if (error) return reply({ error: 'ตรวจเลขประจำตัวไม่สำเร็จ' }, 503);
      if (duplicate) return reply({ error: 'เลขประจำตัวนี้มีอยู่แล้ว' }, 409);
    }
    // A four-digit student ID identifies exactly one login across all teachers.
    const loginId = code;
    const initialPassword = `RT-${loginId}`;
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: `student-${loginId}@students.readup.invalid`, password: initialPassword, email_confirm: true,
      app_metadata: { readtech_role: 'student' },
    });
    if (createError || !created.user) return reply({ error: createError?.code === 'email_exists' ? 'เลขประจำตัวนี้มีบัญชีเข้าเรียนแล้ว' : 'สร้างบัญชีไม่สำเร็จ กรุณาลองอีกครั้ง' }, createError?.code === 'email_exists' ? 409 : 503);
    const authUser = created.user;
    // Conditional linking prevents simultaneous teacher requests from replacing an account.
    const result = student
      ? await admin.from('readtech_students').update({ auth_user_id: authUser.id, login_id: loginId, login_enabled: true }).eq('id', student.id).eq('teacher_id', teacherId).is('auth_user_id', null).select(columns).single()
      : await admin.from('readtech_students').insert({ teacher_id: teacherId, code, display_name: name, class_name: className, auth_user_id: authUser.id, login_id: loginId, login_enabled: true }).select(columns).single();
    if (result.error) {
      await admin.auth.admin.deleteUser(authUser.id);
      return reply({ error: result.error.code === '23505' ? 'รหัสผู้เรียนซ้ำ กรุณาโหลดรายชื่ออีกครั้ง' : 'บันทึกบัญชีไม่สำเร็จ กรุณาโหลดรายชื่อก่อนลองใหม่' }, 409);
    }
    return reply({ student: result.data, loginId, password: initialPassword });
  } catch { return reply({ error: 'ทำรายการไม่สำเร็จ กรุณาลองอีกครั้ง' }, 400); }
});
