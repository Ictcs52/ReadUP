import { useState } from 'react';
import type { FormEvent } from 'react';
import type { CloudAccount } from '../useCloudAccount';
import type { Student } from '../cloud';
import { Icon } from './Icon';

export function TeacherPanel({ account, pending, onSelect, onLogout, syncNow, refreshCloud, exportCsv, conflicts }: {
  account: CloudAccount; pending: number; conflicts: number;
  onSelect: (student: Student | null) => void; onLogout: () => void;
  syncNow: () => Promise<void>; refreshCloud: () => void; exportCsv: () => void;
}) {
  const [url, setUrl] = useState(''); const [key, setKey] = useState('');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [code, setCode] = useState(''); const [name, setName] = useState('');
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  async function action(fn: () => Promise<void>) {
    setBusy(true); setMessage('');
    try { await fn(); } catch (error) { setMessage(error instanceof Error ? error.message : 'ทำรายการไม่สำเร็จ กรุณาลองอีกครั้ง'); }
    finally { setBusy(false); }
  }
  async function login(event: FormEvent) {
    event.preventDefault();
    await action(async () => {
      const result = await account.client!.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) throw new Error('เข้าสู่ระบบไม่สำเร็จ ตรวจอีเมลและรหัสผ่าน แล้วลองอีกครั้ง');
      setPassword('');
    });
  }
  function configure(event: FormEvent) {
    event.preventDefault(); setMessage('');
    try { account.configure(url, key); setKey(''); } catch (error) { setMessage((error as Error).message); }
  }
  return <>
    <div className="page-heading"><div><span className="eyebrow pink">พื้นที่ของครู</span><h1 tabIndex={-1}>ผู้เรียนและบัญชีครู</h1><p>เลือกผู้เรียนก่อนฝึก เพื่อเก็บความก้าวหน้าแยกเป็นรายคน</p></div></div>
    {(!account.configReady || account.checking) && <p className="cloud-message" role="status">กำลังตรวจการเชื่อมต่อ…</p>}
    {(message || account.message) && <p className="cloud-message" role="alert">{message || account.message}</p>}
    {account.configReady && !account.config && <section className="cloud-panel">
      <span className="cloud-symbol"><Icon name="shield" size={28}/></span><h2>เชื่อมฐานข้อมูลกลาง</h2>
      <p>ยังไม่ได้ตั้งค่า Supabase ผลการทดลองปัจจุบันยังเก็บเฉพาะเครื่องนี้</p>
      <details className="cloud-setup"><summary>ตั้งค่าฐานข้อมูลสำหรับผู้ดูแล</summary>
        <p>ติดตั้งฐานข้อมูลและเพิ่มบัญชีครูตาม <a href="https://github.com/Ictcs52/ReadUP/blob/main/docs/CLOUD_SETUP.md" target="_blank" rel="noreferrer">คู่มือตั้งค่า</a> ก่อนกรอกค่าการเชื่อมต่อ</p>
        <form onSubmit={configure} className="cloud-form"><label>Project URL<input type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://ชื่อโปรเจกต์.supabase.co" required autoComplete="off"/></label><label>Publishable key<input value={key} onChange={e=>setKey(e.target.value)} required autoComplete="off" placeholder="sb_publishable_…"/></label><small>ใช้เฉพาะคีย์สาธารณะ ไม่ใช้ Secret หรือ service_role key</small><button className="primary" type="submit">บันทึกการเชื่อมต่อ<Icon name="arrow"/></button></form>
      </details>
    </section>}
    {account.client && !account.user && <section className="cloud-panel auth-panel"><span className="cloud-symbol"><Icon name="lock" size={28}/></span><h2>เข้าสู่ระบบครู</h2><p>ใช้บัญชีที่ผู้ดูแลเปิดสิทธิ์ไว้แล้ว</p><form className="cloud-form" onSubmit={login}><label>อีเมลครู<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" required/></label><label>รหัสผ่าน<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required minLength={6}/></label><button className="primary" disabled={busy} type="submit">{busy?'กำลังเข้าสู่ระบบ…':'เข้าสู่ระบบ'}<Icon name="arrow"/></button></form><button className="text-button" disabled={busy || !email.trim()} onClick={()=>void action(async()=>{const {error}=await account.client!.auth.resetPasswordForEmail(email.trim(),{redirectTo:window.location.origin+import.meta.env.BASE_URL});if(error)throw new Error('ส่งลิงก์ไม่สำเร็จ กรุณาลองอีกครั้ง');setMessage('หากอีเมลนี้มีบัญชี ให้ตรวจอีเมลเพื่อเปลี่ยนรหัสผ่าน');})}>ลืมรหัสผ่าน</button></section>}
    {account.user && account.recovery && <section className="cloud-panel auth-panel"><h2>ตั้งรหัสผ่านใหม่</h2><form className="cloud-form" onSubmit={e=>{e.preventDefault();void action(async()=>{const {error}=await account.client!.auth.updateUser({password});if(error)throw new Error('เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาลองอีกครั้ง');setPassword('');account.setRecovery(false);setMessage('เปลี่ยนรหัสผ่านแล้ว');});}}><label>รหัสผ่านใหม่<input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={8} required autoComplete="new-password"/></label><button className="primary" disabled={busy}>บันทึกรหัสผ่านใหม่</button></form></section>}
    {account.user && <div className="teacher-account"><div><strong>{account.teacher?.display_name ?? 'บัญชีครู'}</strong><span>{account.user.email}</span></div><div className="cloud-actions"><button className="text-button" disabled={busy || account.checking} onClick={account.reload}>โหลดรายชื่ออีกครั้ง<Icon name="replay" size={18}/></button><button className="secondary" disabled={busy} onClick={onLogout}>ออกจากระบบ<Icon name="lock" size={18}/></button></div></div>}
    {account.teacher && !account.recovery && <>
      <div className="student-grid"><section className="cloud-panel"><h2>เพิ่มผู้เรียน</h2><p>ใช้ชื่อเรียกและรหัสที่ครูกำหนด ไม่ต้องให้นักเรียนจำรหัสผ่าน</p><form className="cloud-form" onSubmit={e=>{e.preventDefault();void action(async()=>{await account.addStudent(code,name);setCode('');setName('');setMessage('เพิ่มผู้เรียนแล้ว เลือกผู้เรียนเพื่อเริ่มฝึกได้');});}}><label>รหัสผู้เรียน<input value={code} onChange={e=>setCode(e.target.value)} placeholder="เช่น RT001" pattern="[A-Za-z0-9_-]{2,32}" maxLength={32} required autoComplete="off"/></label><label>ชื่อเรียกผู้เรียน<input value={name} onChange={e=>setName(e.target.value)} placeholder="เช่น นักอ่านคนที่ 1" maxLength={50} required autoComplete="off"/></label><button className="primary" disabled={busy}>เพิ่มผู้เรียน<Icon name="arrow"/></button></form></section>
      <section className="cloud-panel"><h2>ผู้เรียนของฉัน <span className="pill">{account.students.length} คน</span></h2><p>{account.students.length?'เลือกผู้เรียน แล้วเปิดบทเรียนหรือรายงานของคนนี้':'ยังไม่มีผู้เรียน เพิ่มคนแรกได้จากแบบฟอร์ม'}</p><div className="student-list">{account.students.map(s=><article key={s.id} className={'student-card '+(account.student?.id===s.id?'selected':'')}><span className="student-avatar" aria-hidden="true">{s.display_name.slice(0,1)}</span><div><h3>{s.display_name}</h3><small>{s.code}</small></div><button className="secondary" onClick={()=>onSelect(s)} aria-label={`เลือกผู้เรียน ${s.display_name}`}>{account.student?.id===s.id?'กำลังเลือก':'เลือก'}<Icon name="arrow" size={18}/></button></article>)}</div></section></div>
      {account.student && <section className="cloud-panel cloud-summary"><h2>ผลของ {account.student.display_name}</h2><p>{pending?`มี ${pending} รอบฝึกรอส่งเข้าฐานข้อมูล`:'ผลที่บันทึกของผู้เรียนนี้ส่งเข้าฐานข้อมูลแล้ว'}</p><div className="cloud-actions"><button className="secondary" disabled={busy} onClick={()=>void action(syncNow)}>ส่งผลตอนนี้<Icon name="replay" size={18}/></button><button className="secondary" disabled={busy} onClick={refreshCloud}>โหลดผลล่าสุด</button><button className="text-button" onClick={exportCsv}>ส่งออก CSV<Icon name="download" size={18}/></button></div>{conflicts>0&&<p className="cloud-message" role="alert">พบผลที่เปลี่ยนจากอีกเครื่อง ส่งออกฉบับในเครื่องก่อนเลือกใช้ผลกลาง</p>}</section>}
      <button className="text-button" onClick={()=>onSelect(null)}>กลับไปโหมดทดลองในเครื่อง</button>
    </>}
  </>;
}
