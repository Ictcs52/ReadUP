import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { cloudClient, readCloudConfig, saveCloudConfig, type CloudConfig, type Student, type Teacher } from './cloud';
import { clearPrivateCache } from './storage';

export function useCloudAccount() {
  const [config, setConfig] = useState<CloudConfig | null>(null);
  const [configReady, setConfigReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
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
    setUser(null); setTeacher(null); setStudents([]); setStudent(null);
    if (!client) return;
    const { data } = client.auth.onAuthStateChange((event, session) => {
      const nextId = session?.user.id ?? null;
      if (identity.current !== nextId) { setTeacher(null); setStudents([]); setStudent(null); identity.current = nextId; }
      setUser(session?.user ?? null);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
    });
    return () => { data.subscription.unsubscribe(); client.auth.stopAutoRefresh(); };
  }, [client]);

  useEffect(() => {
    let alive = true;
    if (!client || !user) { setTeacher(null); setStudents([]); setStudent(null); setChecking(false); return; }
    setChecking(true); setMessage('');
    void (async () => {
      const profile = await client.from('readtech_teachers').select('id,display_name,active').eq('id', user.id).maybeSingle();
      if (profile.error) throw profile.error;
      if (!profile.data?.active) {
        if (alive) { setTeacher(null); setStudents([]); setStudent(null); setMessage('บัญชีนี้ยังไม่ได้รับสิทธิ์ครู ให้ผู้ดูแลเพิ่มสิทธิ์ก่อน'); }
        return;
      }
      const result = await client.from('readtech_students').select('id,teacher_id,code,display_name,created_at').eq('teacher_id', user.id).order('created_at');
      if (result.error) throw result.error;
      if (alive) {
        const list = result.data as Student[];
        setTeacher(profile.data); setStudents(list);
        const saved = sessionStorage.getItem('readtech-student:' + config!.url + ':' + user.id);
        setStudent(list.find(s => s.id === saved) ?? null);
      }
    })().catch(() => { if (alive) setMessage('เชื่อมฐานข้อมูลไม่ได้ ตรวจการเชื่อมต่อและการติดตั้งฐานข้อมูล แล้วลองโหลดอีกครั้ง'); }).finally(() => { if (alive) setChecking(false); });
    return () => { alive = false; };
  }, [client, user?.id, refresh]);

  function configure(url: string, key: string) { setConfig(saveCloudConfig(url, key)); setMessage(''); }
  function selectStudent(value: Student | null) {
    setStudent(value);
    if (user && config) {
      const key = 'readtech-student:' + config.url + ':' + user.id;
      if (value) sessionStorage.setItem(key, value.id); else sessionStorage.removeItem(key);
    }
  }
  async function addStudent(code: string, name: string) {
    if (!client || !teacher) throw new Error('กรุณาเข้าสู่ระบบครูก่อน');
    code = code.trim(); name = name.trim();
    if (!/^[A-Za-z0-9_-]{2,32}$/.test(code) || !name || name.length > 50) throw new Error('รหัสใช้ตัวอักษรอังกฤษ/ตัวเลข 2–32 ตัว และชื่อเรียกไม่เกิน 50 ตัว');
    const { data, error } = await client.from('readtech_students').insert({ teacher_id: teacher.id, code, display_name: name }).select('id,teacher_id,code,display_name,created_at').single();
    if (error) throw new Error(error.code === '23505' ? 'รหัสผู้เรียนนี้มีอยู่แล้ว ใช้รหัสอื่นได้' : 'เพิ่มผู้เรียนไม่สำเร็จ กรุณาลองอีกครั้ง');
    setStudents(list => [...list, data]); return data as Student;
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
  return { config, configReady, client, user, teacher, students, student, checking, message, recovery, setRecovery, configure, selectStudent, addStudent, signOut, reload: () => setRefresh(x => x + 1) };
}

export type CloudAccount = ReturnType<typeof useCloudAccount>;
