import { useEffect, useMemo, useRef, useState } from 'react';
import type { Student } from '../cloud';
import { Icon } from './Icon';

type AccessAction = 'register' | 'reset' | 'disable' | 'enable';
function statusOf(student: Student) {
  return !student.login_id ? 'unregistered' : student.login_enabled === false ? 'paused' : 'ready';
}
const statusLabels = { ready: 'พร้อมเข้าเรียน', paused: 'พักบัญชี', unregistered: 'ยังไม่มีบัญชี' };
const collator = new Intl.Collator('th', { numeric: true, sensitivity: 'base' });

export function StudentRoster({ students, selectedId, busy, onSelect, onAccess, onAdd }: {
  students: Student[]; selectedId?: string; busy: boolean;
  onSelect: (student: Student) => void;
  onAccess: (student: Student, action: AccessAction) => Promise<void>;
  onAdd: (code: string, name: string, className: string) => Promise<boolean>;
}) {
  const [query, setQuery] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [adding, setAdding] = useState(false);
  const [managing, setManaging] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [className, setClassName] = useState('');
  const addButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  useEffect(() => {
    if (!adding && !busy && restoreFocus.current) { restoreFocus.current = false; addButton.current?.focus(); }
  }, [adding, busy]);
  const classes = useMemo(() => [...new Set(students.map(s => s.class_name?.trim() || ''))].sort(collator.compare), [students]);
  const filtered = useMemo(() => {
    const terms = query.normalize('NFC').trim().toLocaleLowerCase('th').split(/\s+/).filter(Boolean);
    return students.filter(s => {
      const text = `${s.display_name} ${s.code} ${s.login_id || ''} ${s.class_name || ''}`.normalize('NFC').toLocaleLowerCase('th');
      return terms.every(term => text.includes(term)) && (!classFilter || (s.class_name?.trim() || '') === (classFilter === '__none__' ? '' : classFilter)) && (!statusFilter || statusOf(s) === statusFilter);
    }).sort((a, b) => collator.compare(a.code, b.code) || collator.compare(a.display_name, b.display_name));
  }, [students, query, classFilter, statusFilter]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const visible = filtered.slice(start, start + pageSize);
  const hasFilters = Boolean(query || classFilter || statusFilter);
  function clearFilters() { setQuery(''); setClassFilter(''); setStatusFilter(''); setPage(1); }
  function closeForm() { restoreFocus.current = true; setAdding(false); }
  return <section className="cloud-panel roster-panel" aria-labelledby="roster-title">
    <div className="roster-heading"><div><h2 id="roster-title">ผู้เรียนของฉัน <span className="pill">{students.length} คน</span></h2><p>เลือกผู้เรียนเพื่อดูผลหรือฝึกกับครู</p></div><button ref={addButton} className="primary" disabled={busy} aria-expanded={adding} aria-controls="student-registration" onClick={()=>setAdding(value=>!value)}>เพิ่มผู้เรียน<Icon name="arrow" size={18}/></button></div>
    {adding && <section id="student-registration" className="roster-registration" aria-labelledby="registration-title">
      <h3 id="registration-title">ลงทะเบียนผู้เรียน</h3><p>นักเรียนใช้เลขประจำตัวเข้าเรียนเอง ผลฝึกเก็บแยกเป็นรายคน</p>
      <form className="cloud-form roster-registration-form" onSubmit={async event=>{
        event.preventDefault(); if (busy) return;
        if (await onAdd(code, name, className)) {
          setQuery(code.trim()); setClassFilter(''); setStatusFilter(''); setPage(1);
          setCode(''); setName(''); setClassName(''); closeForm();
        }
      }}>
        <label>เลขประจำตัว (4 หลัก)<input autoFocus value={code} onChange={event=>setCode(event.target.value)} inputMode="numeric" placeholder="เช่น 0123" pattern="[0-9]{4}" minLength={4} maxLength={4} required autoComplete="off" disabled={busy}/></label>
        <label>ชื่อ–สกุล<input value={name} onChange={event=>setName(event.target.value)} placeholder="ชื่อและนามสกุล" maxLength={100} required autoComplete="off" disabled={busy}/></label>
        <label>ชั้น<input value={className} onChange={event=>setClassName(event.target.value)} placeholder="เช่น ป.1/1" maxLength={30} required autoComplete="off" disabled={busy}/></label>
        <p className="registration-hint">ชื่อผู้ใช้: {code || 'เลขประจำตัว 4 หลัก'} · รหัสผ่านเริ่มต้น: RT-{code || 'เลขประจำตัว'}</p>
        <div className="cloud-actions"><button className="primary" disabled={busy} type="submit">{busy ? 'กำลังลงทะเบียน…' : 'บันทึกผู้เรียน'}<Icon name="check" size={18}/></button><button className="text-button" disabled={busy} type="button" onClick={closeForm}>ยกเลิก</button></div>
      </form>
    </section>}
    <div className="roster-filters">
      <label className="roster-search">ค้นหาผู้เรียน<input type="search" value={query} onChange={event=>{setQuery(event.target.value);setPage(1);}} placeholder="ชื่อ หรือเลขประจำตัว"/></label>
      <label>ชั้นเรียน<select aria-label="ชั้นเรียน" value={classFilter} onChange={event=>{setClassFilter(event.target.value);setPage(1);}}><option value="">ทุกชั้น</option>{classes.map(value=><option key={value || '__none__'} value={value || '__none__'}>{value || 'ยังไม่ระบุชั้น'}</option>)}</select></label>
      <label>สถานะบัญชี<select aria-label="สถานะบัญชี" value={statusFilter} onChange={event=>{setStatusFilter(event.target.value);setPage(1);}}><option value="">ทุกสถานะ</option>{Object.entries(statusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    </div>
    <div className="roster-result"><p role="status">{hasFilters ? `พบ ${filtered.length} จาก ${students.length} คน` : `ทั้งหมด ${students.length} คน`}{filtered.length > 0 ? ` · แสดง ${start+1}–${Math.min(start+pageSize,filtered.length)}` : ''}</p>{hasFilters && <button className="text-button" onClick={clearFilters}>ล้างตัวกรอง<Icon name="close" size={16}/></button>}</div>
    {visible.length > 0 ? <>
      <div className="roster-columns" aria-hidden="true"><span>ชื่อ / เลขประจำตัว</span><span>ชั้น</span><span>สถานะ</span><span>การจัดการ</span></div>
      <div className="roster-list">{visible.map(student=><article key={student.id} className={'roster-row '+(selectedId===student.id?'selected':'')} aria-label={student.display_name}>
        <div className="roster-identity"><h3>{student.display_name}</h3><small>เลขประจำตัว {student.code}{student.login_id && student.login_id !== student.code ? ` · รหัสเข้าเรียนเดิม ${student.login_id}` : ''}</small>{selectedId===student.id && <small className="roster-selected">กำลังเลือก</small>}</div>
        <span className="roster-class">{student.class_name || 'ยังไม่ระบุชั้น'}</span>
        <span className={'roster-status '+statusOf(student)}>{statusLabels[statusOf(student)]}</span>
        <div className="roster-actions"><button className="secondary" disabled={busy} onClick={()=>onSelect(student)} aria-label={`เลือกผู้เรียน ${student.display_name}`}>ดูผล / ฝึก<Icon name="arrow" size={16}/></button><button className="text-button" aria-label={`จัดการบัญชี ${student.display_name}`} aria-expanded={managing===student.id} aria-controls={`student-actions-${student.id}`} disabled={busy} onClick={()=>setManaging(managing===student.id?null:student.id)}>จัดการ</button></div>
        {managing===student.id && <div id={`student-actions-${student.id}`} className="roster-manage-actions"><span>บัญชีของ {student.display_name}</span><button className="text-button" disabled={busy} onClick={()=>void onAccess(student,student.login_id?'reset':'register')}>{student.login_id ? /^[0-9]{4}$/.test(student.login_id) ? 'คืนรหัสผ่านเริ่มต้น' : 'ออกรหัสผ่านใหม่' : 'สร้างบัญชีเข้าเรียน'}</button>{student.login_id && <button className="text-button" disabled={busy} onClick={()=>void onAccess(student,student.login_enabled===false?'enable':'disable')}>{student.login_enabled===false?'เปิดบัญชี':'พักบัญชี'}</button>}</div>}
      </article>)}</div>
    </> : <div className="roster-empty"><Icon name="book" size={28}/><h3>{students.length ? 'ไม่พบผู้เรียนที่ตรงกับตัวกรอง' : 'ยังไม่มีผู้เรียน'}</h3><p>{students.length ? 'ลองเปลี่ยนคำค้น ชั้นเรียน หรือสถานะบัญชี' : 'กด “เพิ่มผู้เรียน” เพื่อลงทะเบียนคนแรก'}</p></div>}
    {filtered.length > 0 && <div className="roster-footer"><label>แสดงต่อหน้า<select aria-label="แสดงต่อหน้า" value={pageSize} onChange={event=>{setPageSize(Number(event.target.value));setPage(1);}}>{[10,20,50].map(size=><option key={size} value={size}>{size} คน</option>)}</select></label><nav aria-label="หน้ารายชื่อผู้เรียน"><button className="secondary" disabled={currentPage===1} onClick={()=>setPage(currentPage-1)} aria-label="รายชื่อหน้าก่อนหน้า"><Icon name="back" size={18}/></button><span>หน้า {currentPage} / {pageCount}</span><button className="secondary" disabled={currentPage===pageCount} onClick={()=>setPage(currentPage+1)} aria-label="รายชื่อหน้าถัดไป"><Icon name="arrow" size={18}/></button></nav></div>}
  </section>;
}
