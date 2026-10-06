import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { cloudClient, readCloudConfig, saveCloudConfig, manageStudentLogin, studentColumns, type CloudConfig, type Student, type Teacher } from './cloud';
import { isGradeLevel } from './gradeLevels';
import { clearPrivateCache } from './storage';

export function useCloudAccount() {
  const [config, setConfig] = useState<CloudConfig | null>(null);
  const [configReady, setConfigReady] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [learner, setLearner] = useState<Student | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [student, setStudent] = useState<Student | null>(null);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const identity = useRef<string | null>(null);
  const client = useMemo(() => config ? cloudClient(config) : null, [config]);

  useEffect(() => {
    let alive = true;
    readCloudConfig().then(value => { if (alive) setConfig(value); }).catch(() => { if (alive) setMessage('ยังอ่านการตั้งค่าฐานข้อมูลไม่ได้ ผู้ดูแลสามารถตั้งค่าในหน้านี้ได้'); }).finally(() => { if (alive) setConfigReady(true); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    setUser(null); setTeacher(null); setLearner(null); setStudents([]); setStudent(null);
    setAuthReady(false);
    if (!client) return;
    const { data } = client.auth.onAuthStateChange((event, session) => {
      const nextId = session?.user.id ?? null;
      if (identity.current !== nextId) { setTeacher(null); setLearner(null); setStudents([]); setStudent(null); identity.current = nextId; }
      setUser(session?.user ?? null);
      setAuthReady(true);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
    });
    return () => { data.subscription.unsubscribe(); client.auth.stopAutoRefresh(); };
  }, [client]);

  useEffect(() => {
    let alive = true;
    if (!client || !user) { setTeacher(null); setLearner(null); setStudents([]); setStudent(null); setChecking(false); return; }
    setChecking(true); setMessage('');
    void (async () => {
      const profile = await client.from('readtech_teachers').select('id,display_name,active').eq('id', user.id).maybeSingle();
      if (profile.error) throw profile.error;
      if (!profile.data?.active) {
        const own = await client.from('readtech_students').select(studentColumns).eq('auth_user_id', user.id).eq('login_enabled', true).maybeSingle();
        if (own.error) throw own.error;
        if (alive) { setTeacher(null); setLearner(own.data); setStudents([]); setStudent(own.data); if (!own.data) setMessage('บัญชีนี้ยังไม่ได้รับสิทธิ์ครู หรือบัญชีนักเรียนถูกพักใช้งาน ให้ติดต่อครูผู้ดูแล'); }
        return;
      }
      const result = await client.from('readtech_students').select(studentColumns).eq('teacher_id', user.id).order('created_at');
      if (result.error) throw result.error;
      if (alive) {
        const list = result.data as Student[];
        setTeacher(profile.data); setLearner(null); setStudents(list);
        const saved = sessionStorage.getItem('readtech-student:' + config!.url + ':' + user.id);
        setStudent(list.find(s => s.id === saved) ?? null);
      }
    })().catch(() => { if (alive) { setTeacher(null); setLearner(null); setStudents([]); setStudent(null); setMessage('เชื่อมฐานข้อมูลไม่ได้ จึงยังเปิดพื้นที่ส่วนตัวไม่ได้ กรุณาลองโหลดอีกครั้ง'); } }).finally(() => { if (alive) setChecking(false); });
    return () => { alive = false; };
  }, [client, user?.id, refresh]);

  function configure(url: string, key: string) { setConfig(saveCloudConfig(url, key)); setMessage(''); }
  function selectStudent(value: Student | null) {
    if (!teacher || (value && !students.some(s => s.id === value.id))) return;
    setStudent(value);
    if (user && config) {
      const key = 'readtech-student:' + config.url + ':' + user.id;
      if (value) sessionStorage.setItem(key, value.id); else sessionStorage.removeItem(key);
    }
  }
  async function addStudent(code: string, name: string, className: string) {
    if (!client || !teacher) throw new Error('กรุณาเข้าสู่ระบบครูก่อน');
    code = code.trim(); name = name.trim(); className = className.trim();
    if (!/^[0-9]{4}$/.test(code)) throw new Error('เลขประจำตัวต้องเป็นตัวเลข 4 หลัก');
    if (!name || name.length > 100 || !isGradeLevel(className)) throw new Error('กรอกชื่อ–สกุลไม่เกิน 100 ตัว และเลือกชั้น ป.1–ป.6');
    const result = await manageStudentLogin(client, { action: 'register', code, name, className });
    setStudents(list => [...list, result.student]); return result;
  }
  async function studentAccess(value: Student, action: 'register' | 'reset' | 'disable' | 'enable') {
    if (!client || !teacher) throw new Error('กรุณาเข้าสู่ระบบครูก่อน');
    const result = await manageStudentLogin(client, { action, studentId: value.id });
    setStudents(list => list.map(s => s.id === value.id ? result.student : s));
    setStudent(s => s?.id === value.id ? result.student : s);
    return result;
  }
  async function editStudent(value: Student, code: string, name: string, className: string) {
    if (!client || !teacher || !students.some(s=>s.id===value.id)) throw new Error('ไม่มีสิทธิ์แก้ข้อมูลผู้เรียนนี้');
    const result = await manageStudentLogin(client, { action: 'edit', studentId: value.id, code, name, className,
      expected: { code: value.code, name: value.display_name, className: value.class_name || '' } });
    setStudents(list=>list.map(s=>s.id===value.id?result.student:s));
    setStudent(s=>s?.id===value.id?result.student:s);
    return result;
  }
  async function signOut() {
    if (!client || !config) return;
    const owner = user?.id;
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) throw new Error('ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง');
    if (owner) {
      sessionStorage.removeItem('readtech-student:' + config.url + ':' + owner);
      await clearPrivateCache('workspace:' + config.url + ':' + owner + ':');
    }
    setRecovery(false); setMessage('');
  }
  return { config, configReady, authReady, client, user, teacher, learner, students, student, checking, message, recovery, setRecovery, configure, selectStudent, addStudent, studentAccess, editStudent, signOut, reload: () => setRefresh(x => x + 1) };
}

export type CloudAccount = ReturnType<typeof useCloudAccount>;
