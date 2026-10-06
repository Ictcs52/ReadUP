import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { CloudAccount } from '../useCloudAccount';
import { studentLoginEmail, type Student, type StudentCredentials } from '../cloud';
import { Icon } from './Icon';

export function TeacherPanel({ account, pending, onSelect, onLogout, onSignedIn, syncNow, refreshCloud, exportCsv, conflicts }: {
  account: CloudAccount; pending: number; conflicts: number;
  onSelect: (student: Student | null) => void; onLogout: () => void; onSignedIn: (role: 'student' | 'teacher') => void;
  syncNow: () => Promise<void>; refreshCloud: () => void; exportCsv: () => void;
}) {
  const [url, setUrl] = useState(''); const [key, setKey] = useState('');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [loginId, setLoginId] = useState('');
  const [loginRole, setLoginRole] = useState<'student' | 'teacher'>('student');
  const [showPassword, setShowPassword] = useState(false);
  const [credentials, setCredentials] = useState<StudentCredentials | null>(null);
  useEffect(() => { setCredentials(null); setPassword(''); setShowPassword(false); }, [account.user?.id]);
  const [code, setCode] = useState(''); const [name, setName] = useState(''); const [className, setClassName] = useState('');
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  async function action(fn: () => Promise<void>) {
    setBusy(true); setMessage('');
    try { await fn(); } catch (error) { setMessage(error instanceof Error ? error.message : 'ทำรายการไม่สำเร็จ กรุณาลองอีกครั้ง'); }
    finally { setBusy(false); }
  }
  async function login(event: FormEvent) {
    event.preventDefault();
    await action(async () => {
      const identity = loginRole === 'teacher' ? email.trim() : studentLoginEmail(loginId);
      const { error } = await account.client!.auth.signInWithPassword({ email: identity, password });
      if (error) throw new Error(loginRole === 'teacher' ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาลองอีกครั้ง' : 'เลขประจำตัวหรือรหัสผ่านไม่ถูกต้อง ลองอีกครั้งหรือติดต่อครู');
      setPassword(''); setShowPassword(false); onSignedIn(loginRole);
    });
  }
  async function access(s: Student, kind: 'register' | 'reset' | 'disable' | 'enable') {
    if (kind === 'reset' && !window.confirm(/^[0-9]{4}$/.test(s.login_id ?? '') ? `คืนรหัสผ่านเริ่มต้น RT-${s.login_id} ให้ ${s.display_name}?` : `ออกรหัสผ่านใหม่ให้ ${s.display_name}? รหัสผ่านเดิมจะใช้เข้าเรียนไม่ได้`)) return;
    if (kind === 'disable' && !window.confirm(`พักบัญชี ${s.display_name}? ผู้เรียนจะเข้าเรียนและส่งผลไม่ได้จนกว่าจะเปิดอีกครั้ง`)) return;
    await action(async () => { const result = await account.studentAccess(s, kind); setCredentials(result.password ? result : null); setMessage(kind === 'disable' ? 'พักบัญชีแล้ว' : kind === 'enable' ? 'เปิดบัญชีแล้ว' : 'บัญชีพร้อมใช้ ส่งรหัสให้ผู้เรียนได้'); });
  }
  function configure(event: FormEvent) {
    event.preventDefault(); setMessage('');
    try { account.configure(url, key); setKey(''); } catch (error) { setMessage((error as Error).message); }
  }
  return <>
    <div className="page-heading"><div><span className="eyebrow pink">{!account.user?'ยินดีต้อนรับ':account.learner?'พื้นที่ของฉัน':'จัดการบัญชีและการเข้าเรียน'}</span><h1 tabIndex={-1}>{!account.user?'เข้าสู่ระบบ':account.learner?'บัญชีของฉัน':'ผู้เรียน'}</h1><p>{!account.user?'เลือกประเภทบัญชี แล้วเข้าสู่พื้นที่ของคุณ':account.learner?'ฝึกด้วยตัวเอง ดาวและผลฝึกเป็นของเธอ':'ครูลงทะเบียนให้ นักเรียนเข้าเรียนเอง และเก็บผลแยกเป็นรายคน'}</p></div></div>
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
    {account.client && !account.user && <section className="cloud-panel auth-panel unified-auth" aria-label="แบบฟอร์มเข้าสู่ระบบ">
      <fieldset className="login-roles"><legend>ประเภทบัญชี</legend><div className="role-options">{(['student','teacher'] as const).map(role=><label key={role} className={loginRole===role?'selected':''}><input type="radio" name="login-role" value={role} checked={loginRole===role} disabled={busy} onChange={()=>{setLoginRole(role);setPassword('');setMessage('');setShowPassword(false);}}/><Icon name={role==='student'?'book':'shield'} size={21}/><span>{role==='student'?'นักเรียน':'ครู'}</span></label>)}</div></fieldset>
      <p className="login-help">{loginRole==='student'?'ใช้เลขประจำตัวและรหัสผ่านที่ครูให้':'ใช้บัญชีอีเมลที่ผู้ดูแลเปิดสิทธิ์ครูไว้แล้ว'}</p>
      <form className="cloud-form" onSubmit={login}>
        {loginRole==='student'?<label>เลขประจำตัว<input key="student-login" value={loginId} onChange={e=>setLoginId(e.target.value)} inputMode="numeric" autoComplete="username" placeholder="เลขประจำตัว 4 หลัก" maxLength={10} pattern="([0-9]{4}|[0-9]{10})" required disabled={busy}/></label>:<label>อีเมลครู<input key="teacher-login" type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" placeholder="name@example.com" required disabled={busy}/></label>}
        <label>รหัสผ่าน<input type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required disabled={busy}/></label>
        <label className="password-visibility"><input type="checkbox" checked={showPassword} onChange={e=>setShowPassword(e.target.checked)}/>แสดงรหัสผ่าน</label>
        <button className="primary" disabled={busy} type="submit">{busy?'กำลังเข้าสู่ระบบ…':'เข้าสู่ระบบ'}<Icon name="arrow"/></button>
      </form>
      {loginRole==='student'?<p className="login-footnote">ยังไม่มีรหัสหรือลืมรหัสผ่าน? ติดต่อครูผู้ดูแล</p>:<button className="text-button" disabled={busy || !email.trim()} onClick={()=>void action(async()=>{const {error}=await account.client!.auth.resetPasswordForEmail(email.trim(),{redirectTo:window.location.origin+import.meta.env.BASE_URL});if(error)throw new Error('ส่งลิงก์ไม่สำเร็จ กรุณาลองอีกครั้ง');setMessage('หากอีเมลนี้มีบัญชี ให้ตรวจอีเมลเพื่อเปลี่ยนรหัสผ่าน');})}>ลืมรหัสผ่าน</button>}
    </section>}
    {account.user && account.recovery && <section className="cloud-panel auth-panel"><h2>ตั้งรหัสผ่านใหม่</h2><form className="cloud-form" onSubmit={e=>{e.preventDefault();void action(async()=>{const {error}=await account.client!.auth.updateUser({password});if(error)throw new Error('เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาลองอีกครั้ง');setPassword('');account.setRecovery(false);setMessage('เปลี่ยนรหัสผ่านแล้ว');});}}><label>รหัสผ่านใหม่<input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={8} required autoComplete="new-password"/></label><button className="primary" disabled={busy}>บันทึกรหัสผ่านใหม่</button></form></section>}
    {account.user && <div className="teacher-account"><div><strong>{account.teacher?.display_name ?? account.learner?.display_name ?? 'บัญชีผู้ใช้'}</strong><span>{account.learner ? `เลขประจำตัว ${account.learner.code}${account.learner.class_name ? ` · ${account.learner.class_name}` : ''}` : account.user.email}</span></div><div className="cloud-actions"><button className="text-button" disabled={busy || account.checking} onClick={account.reload}>{account.learner?'ตรวจบัญชีอีกครั้ง':'โหลดรายชื่ออีกครั้ง'}<Icon name="replay" size={18}/></button><button className="secondary" disabled={busy} onClick={onLogout}>ออกจากระบบ<Icon name="lock" size={18}/></button></div></div>}
    {account.learner && <section className="cloud-panel"><h2>พร้อมฝึกแล้ว {account.learner.display_name}</h2><p>ดาวและผลฝึกจะบันทึกในบัญชีของเธอ ครูดูความก้าวหน้าได้</p><button className="primary" onClick={()=>onSelect(account.learner)}>เริ่มฝึกของฉัน<Icon name="arrow"/></button><div className="cloud-actions student-sync"><button className="secondary" disabled={busy} onClick={()=>void action(syncNow)}>ส่งผลตอนนี้</button><button className="secondary" disabled={busy} onClick={refreshCloud}>โหลดผลล่าสุด</button><button className="text-button" onClick={exportCsv}>ส่งออก CSV</button></div>{pending>0&&<p>มี {pending} รอบฝึกรอส่ง เก็บผลในเครื่องแล้ว</p>}{conflicts>0&&<p role="alert">ผลรอบนี้เปลี่ยนจากอีกเครื่อง ส่งออกผลก่อนโหลดผลล่าสุด</p>}</section>}
    {account.teacher && !account.recovery && <>
      {credentials && <section className="cloud-panel credential-card" aria-label="รหัสเข้าเรียนที่สร้างแล้ว"><h2>บัญชีของ {credentials.student.display_name} พร้อมแล้ว</h2><p>ส่งเลขประจำตัวและรหัสผ่านให้ผู้เรียนเพื่อเข้าสู่ระบบ</p><dl><dt>ชื่อผู้ใช้ (เลขประจำตัว)</dt><dd>{credentials.loginId}</dd><dt>รหัสผ่านนักเรียน</dt><dd>{credentials.password}</dd></dl><div className="cloud-actions"><button className="secondary" disabled={busy} onClick={()=>void action(async()=>{await navigator.clipboard.writeText(`ReadTech Companion\nผู้เรียน: ${credentials.student.display_name}\nชั้น: ${credentials.student.class_name || '—'}\nเว็บ: ${window.location.origin}${import.meta.env.BASE_URL}\nชื่อผู้ใช้: ${credentials.loginId}\nรหัสผ่าน: ${credentials.password}`);setMessage('คัดลอกรหัสแล้ว');})}>คัดลอกรหัสให้ผู้เรียน</button><button className="text-button" onClick={()=>setCredentials(null)}>เก็บรหัสแล้ว ปิดส่วนนี้</button></div></section>}

      <div className="student-grid"><section className="cloud-panel"><h2>เพิ่มผู้เรียน</h2><p>ครูกรอกเลขประจำตัว ชื่อ–สกุล และชั้น นักเรียนใช้เลขประจำตัวเข้าสู่ระบบ</p><form className="cloud-form" onSubmit={e=>{e.preventDefault();void action(async()=>{setCredentials(await account.addStudent(code,name,className));setCode('');setName('');setClassName('');setMessage('ลงทะเบียนแล้ว ส่งรหัสให้ผู้เรียนเพื่อเข้าเรียนเองได้');});}}><label>เลขประจำตัว (4 หลัก)<input value={code} onChange={e=>setCode(e.target.value)} inputMode="numeric" placeholder="เช่น 0123" pattern="[0-9]{4}" minLength={4} maxLength={4} required autoComplete="off"/></label><label>ชื่อ–สกุล<input value={name} onChange={e=>setName(e.target.value)} placeholder="ชื่อและนามสกุลของนักเรียน" maxLength={100} required autoComplete="off"/></label><label>ชั้น<input value={className} onChange={e=>setClassName(e.target.value)} placeholder="เช่น ป.1/1" maxLength={30} required autoComplete="off"/></label><p className="login-help">ชื่อผู้ใช้: {code || 'เลขประจำตัว 4 หลัก'} · รหัสผ่านเริ่มต้น: RT-{code || 'เลขประจำตัว'}</p><button className="primary" disabled={busy}>เพิ่มผู้เรียน<Icon name="arrow"/></button></form></section>
      <section className="cloud-panel"><h2>ผู้เรียนของฉัน <span className="pill">{account.students.length} คน</span></h2><p>{account.students.length?'นักเรียนเข้าเองได้ด้วยรหัส ครูเลือกชื่อเมื่อต้องการดูรายงานหรือฝึกด้วยกัน':'ยังไม่มีผู้เรียน เพิ่มคนแรกได้จากแบบฟอร์ม'}</p><div className="student-list">{account.students.map(s=><article key={s.id} className={'student-card '+(account.student?.id===s.id?'selected':'')}><span className="student-avatar" aria-hidden="true">{s.display_name.slice(0,1)}</span><div><h3>{s.display_name}</h3><small>เลขประจำตัว {s.code}{s.class_name ? ` · ${s.class_name}` : ''}{s.login_id && s.login_id !== s.code ? ` · รหัสเข้าเรียนเดิม ${s.login_id}` : s.login_id ? '' : ' · ยังไม่มีบัญชีเข้าเรียน'}</small>{s.login_id && <small className="login-status">{s.login_enabled === false ? 'พักบัญชี' : 'เข้าเรียนเองได้'}</small>}<div className="student-controls"><button className="secondary" disabled={busy} onClick={()=>onSelect(s)} aria-label={`เลือกผู้เรียน ${s.display_name}`}>{account.student?.id===s.id?'กำลังเลือก':'ดูผล / ฝึกกับครู'}<Icon name="arrow" size={18}/></button><button className="text-button" disabled={busy} onClick={()=>void access(s, s.login_id ? 'reset' : 'register')}>{s.login_id ? /^[0-9]{4}$/.test(s.login_id) ? 'คืนรหัสผ่านเริ่มต้น' : 'ออกรหัสผ่านใหม่' : 'สร้างบัญชีเข้าเรียน'}</button>{s.login_id&&<button className="text-button" disabled={busy} onClick={()=>void access(s,s.login_enabled===false?'enable':'disable')}>{s.login_enabled===false?'เปิดบัญชี':'พักบัญชี'}</button>}</div></div></article>)}</div></section></div>
      {account.student && <section className="cloud-panel cloud-summary"><h2>ผลของ {account.student.display_name}</h2><p>{pending?`มี ${pending} รอบฝึกรอส่งเข้าฐานข้อมูล`:'ผลที่บันทึกของผู้เรียนนี้ส่งเข้าฐานข้อมูลแล้ว'}</p><div className="cloud-actions"><button className="secondary" disabled={busy} onClick={()=>void action(syncNow)}>ส่งผลตอนนี้<Icon name="replay" size={18}/></button><button className="secondary" disabled={busy} onClick={refreshCloud}>โหลดผลล่าสุด</button><button className="text-button" onClick={exportCsv}>ส่งออก CSV<Icon name="download" size={18}/></button></div>{conflicts>0&&<p className="cloud-message" role="alert">พบผลที่เปลี่ยนจากอีกเครื่อง ส่งออกฉบับในเครื่องก่อนเลือกใช้ผลกลาง</p>}</section>}
      <button className="text-button" onClick={()=>onSelect(null)}>กลับไปโหมดทดลองในเครื่อง</button>
    </>}
  </>;
}
