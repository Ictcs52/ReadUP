import { useEffect, useRef, useState } from 'react';
import { GRADE_LEVELS, gradeOf } from '../gradeLevels';
import type { Student } from '../cloud';
import { Icon } from './Icon';

export function StudentEdit({ student, onSave, onClose }: {
  student: Student; onSave: (code: string, name: string, className: string) => Promise<void>; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [code, setCode] = useState(student.code);
  const [name, setName] = useState(student.display_name);
  const [className, setClassName] = useState(gradeOf(student.class_name));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { dialog.current?.showModal(); return () => dialog.current?.close(); }, []);
  const changedCode = code.trim() !== student.code;
  return <dialog ref={dialog} className="student-edit-dialog" aria-labelledby="student-edit-title" onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>
    <div className="dialog-top"><h2 id="student-edit-title">แก้ไขข้อมูลผู้เรียน</h2><button className="icon-button" aria-label="ปิดหน้าต่างแก้ไขผู้เรียน" disabled={busy} onClick={onClose}><Icon name="close"/></button></div>
    <p>แก้ข้อมูลของ {student.display_name} ผลฝึกเดิมยังอยู่ในบัญชีนี้</p>
    <form className="cloud-form" onSubmit={async event=>{
      event.preventDefault(); if(busy)return;
      setBusy(true);setError('');
      try { await onSave(code.trim(),name.trim(),className.trim());onClose(); }
      catch(error) { setError(error instanceof Error?error.message:'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง'); }
      finally { setBusy(false); }
    }}>
      <label>เลขประจำตัว<input value={code} onChange={event=>setCode(event.target.value)} inputMode="numeric" maxLength={Math.max(4,student.code.length)} pattern={changedCode || /^[0-9]{4}$/.test(student.code) ? '[0-9]{4}' : undefined} required autoComplete="off" disabled={busy}/></label>
      <label>ชื่อ–สกุล<input autoFocus value={name} onChange={event=>setName(event.target.value)} maxLength={100} required autoComplete="off" disabled={busy}/></label>
      <label>ชั้น<select aria-label="ชั้น" value={className} onChange={event=>setClassName(event.target.value as typeof className)} required disabled={busy}><option value="">เลือกชั้น</option>{GRADE_LEVELS.map(grade=><option key={grade} value={grade}>{grade}</option>)}</select></label>
      {changedCode && <p className="edit-login-note">ใช้เลขประจำตัวใหม่ 4 หลัก{student.login_id ? ' ชื่อผู้ใช้จะเปลี่ยนตามเลขใหม่ รหัสผ่านยังเป็นรหัสเดิม หากต้องการ RT-เลขใหม่ ให้กด “คืนรหัสผ่านเริ่มต้น” หลังบันทึก' : ''}</p>}
      {error && <p className="cloud-message" role="alert">{error}</p>}
      <div className="dialog-actions"><button className="primary" type="submit" disabled={busy}>{busy?'กำลังบันทึก…':'บันทึกการแก้ไข'}<Icon name="check" size={18}/></button><button className="secondary" type="button" disabled={busy} onClick={onClose}>ยกเลิก</button></div>
    </form>
  </dialog>;
}
