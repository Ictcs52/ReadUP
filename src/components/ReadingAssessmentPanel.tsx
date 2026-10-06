import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Student } from '../cloud';
import { fetchReadingAssessments, saveReadingAssessment } from '../readingAssessments';
import type { ReadingAssessment, ReadingInput } from '../readingAssessments';
import { parseReadingDraft, readingAccuracy, readingCsv, filterReadings, READING_HELP, READING_PARTICIPATION, READING_CONFIDENCE } from '../readingDomain.mjs';
import { Icon } from './Icon';
import { ReadingProgress } from './ReadingProgress';

function localDate(value = new Date().toISOString()) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}T${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
}
function freshDraft(row?: ReadingAssessment) {
  return { assessed_at: localDate(row?.assessed_at), reading_text: row?.reading_text ?? '', correct_words: row ? String(row.correct_words) : '', incorrect_words: row ? String(row.incorrect_words) : '', letter_swaps: String(row?.letter_swaps ?? 0), skipped_words: String(row?.skipped_words ?? 0), stops: String(row?.stops ?? 0), reading_seconds: row?.reading_seconds == null ? '' : String(row.reading_seconds), help_level: row?.help_level ?? '', participation: row?.participation ?? '', confidence: row?.confidence ?? '', note: row?.note ?? '' };
}
function Accuracy({ correct, incorrect }: { correct: number; incorrect: number }) {
  const result = readingAccuracy(correct, incorrect);
  if (!result) return <p className="reading-accuracy">กรอกจำนวนคำเพื่อคำนวณเปอร์เซ็นต์อ่านถูก</p>;
  return <div className={'reading-accuracy '+(result.reached?'reached':'below')}><strong>อ่านถูก {result.percentage.toLocaleString('th-TH',{maximumFractionDigits:2})}%</strong><span>{correct} จาก {result.total} คำ · {result.reached?'ถึงเป้าหมาย 80%':'ยังไม่ถึงเป้าหมาย 80%'}</span></div>;
}

export function ReadingAssessmentPanel({ client, student, teacherId }: { client: SupabaseClient; student: Student; teacherId: string }) {
  const [rows, setRows] = useState<ReadingAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const filtered = filterReadings(rows,from,to) as ReadingAssessment[];
  const invalidDates = Boolean(from && to && from > to);
  const [visible, setVisible] = useState(10);
  const [draft, setDraft] = useState(freshDraft);
  const [editing, setEditing] = useState<ReadingAssessment | null>(null);
  const [opened, setOpened] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const requestId = useRef('');
  const alive = useRef(true);
  const submitting = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  useEffect(()=>{
    let active=true;setLoading(true);setLoadError('');
    void fetchReadingAssessments(client,student.id).then(data=>{if(active)setRows(data);}).catch(err=>{if(active)setLoadError(err.message);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[client,student.id,refresh]);
  useEffect(()=>{if(opened){form.current?.scrollIntoView({block:'nearest'});form.current?.querySelector<HTMLInputElement>('input')?.focus({preventScroll:true});}},[opened,editing?.id]);
  function open(row?: ReadingAssessment) {
    setEditing(row ?? null);setDraft(freshDraft(row));requestId.current=row?.id ?? crypto.randomUUID();setError('');setMessage('');setOpened(true);
  }
  function close() { setOpened(false);setEditing(null);setError('');addButton.current?.focus(); }
  async function save(event: FormEvent) {
    event.preventDefault();if(submitting.current)return;
    let value: ReadingInput;
    try{value=parseReadingDraft(draft) as ReadingInput;}catch(err){setError((err as Error).message);return;}
    submitting.current=true;setSaving(true);setError('');setMessage('');
    try {
      const saved=await saveReadingAssessment(client,student.id,teacherId,requestId.current,value,editing?.revision);
      if(!alive.current)return;
      setRows(previous=>[saved,...previous.filter(row=>row.id!==saved.id)].sort((a,b)=>Date.parse(b.assessed_at)-Date.parse(a.assessed_at)||b.id.localeCompare(a.id)));setMessage(filterReadings([saved],from,to).length?'บันทึกผลการอ่านแล้ว':'บันทึกผลการอ่านแล้ว · รายการนี้อยู่นอกช่วงวันที่เลือก กดดูทุกวันที่เพื่อเปิดดู');close();
    }catch(err){if(alive.current)setError((err as Error).message);}finally{submitting.current=false;if(alive.current)setSaving(false);}
  }
  function exportRows() {
    const url=URL.createObjectURL(new Blob([readingCsv(filtered,student)],{type:'text/csv;charset=utf-8;'}));
    const link=document.createElement('a');link.href=url;link.download=`reading-${student.code}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const field=(key: keyof typeof draft,value:string)=>setDraft(previous=>({...previous,[key]:value}));
  const preview = /^\d+$/.test(draft.correct_words)&&/^\d+$/.test(draft.incorrect_words);
  return <section className="reading-panel" aria-label={`บันทึกการอ่านของ ${student.display_name}`}>
    <div className="reading-panel-heading"><div><h2>บันทึกการอ่านโดยครู</h2><p>ผลการอ่านจริงของ {student.display_name} · แยกจากคะแนนกิจกรรม</p></div><button ref={addButton} className="primary" disabled={loading||saving||Boolean(loadError)||opened} onClick={()=>open()}>เพิ่มบันทึกการอ่าน<Icon name="book" size={18}/></button></div>
    <p className="reading-guidance">เป้าหมายเบื้องต้น: อ่านคำถูกอย่างน้อย 80% ใช้ติดตามผลครั้งนี้ตามที่ครูบันทึก ไม่ใช่ผลรับรองการเรียนรู้หรือคะแนนก่อน–หลัง</p>
    {loading && <p role="status">กำลังโหลดบันทึกการอ่าน…</p>}
    {loadError && <div className="reading-error"><p role="alert">{loadError}</p><button className="secondary" onClick={()=>setRefresh(n=>n+1)}>ลองโหลดอีกครั้ง</button></div>}
    {message && <p className="reading-saved" role="status">{message}</p>}
    {opened && <form ref={form} className="reading-form" onSubmit={event=>void save(event)} aria-label={editing?'แก้ไขบันทึกการอ่าน':'เพิ่มบันทึกการอ่าน'}>
      <h3>{editing?'แก้ไขบันทึกการอ่าน':'ผลการอ่านครั้งนี้'}</h3>
      <fieldset disabled={saving}><legend className="sr-only">ข้อมูลการประเมินการอ่าน</legend>
        <div className="reading-fields"><label>วันและเวลาประเมิน<input type="datetime-local" value={draft.assessed_at} onChange={e=>field('assessed_at',e.target.value)} required/></label><label>คำหรือประโยคที่ใช้ประเมิน (ถ้ามี)<input value={draft.reading_text} maxLength={500} onChange={e=>field('reading_text',e.target.value)} placeholder="เช่น ไก่ ม้า ปลา หรือชื่อชุดคำที่ครูใช้"/></label></div>
        <p className="reading-field-help">อ่านผิดให้นับรวมคำที่อ่านไม่ได้และคำที่ข้าม คำทั้งหมด = อ่านถูก + อ่านผิด ส่วนสลับตัวอักษรและหยุดกลางคันนับเป็นครั้ง</p>
        <div className="reading-fields">{([{key:'correct_words',label:'จำนวนคำที่อ่านถูก (คำ)'},{key:'incorrect_words',label:'จำนวนคำที่อ่านผิด (คำ)'},{key:'letter_swaps',label:'การสลับตัวอักษร (ครั้ง)'},{key:'skipped_words',label:'การอ่านข้ามคำ (คำ)'},{key:'stops',label:'การหยุดอ่านกลางคัน (ครั้ง)'}] as const).map(item=><label key={item.key}>{item.label}<input type="number" inputMode="numeric" min={0} max={10000} step={1} required value={draft[item.key]} onChange={e=>field(item.key,e.target.value)}/></label>)}
          <label>เวลาที่ใช้ในการอ่าน (วินาที)<input type="number" inputMode="numeric" min={1} max={86400} step={1} value={draft.reading_seconds} onChange={e=>field('reading_seconds',e.target.value)} placeholder="เว้นว่างหากไม่ได้จับเวลา"/></label>
          <label className="reading-wide">ระดับความช่วยเหลือ<select aria-label="ระดับความช่วยเหลือ" required value={draft.help_level} onChange={e=>field('help_level',e.target.value)}><option value="">เลือกระดับความช่วยเหลือ</option>{Object.entries(READING_HELP).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          <label>การมีส่วนร่วม (ครูสังเกต)<select aria-label="การมีส่วนร่วม (ครูสังเกต)" value={draft.participation} onChange={e=>field('participation',e.target.value)}><option value="">ยังไม่ได้สังเกต</option>{Object.entries(READING_PARTICIPATION).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          <label>ความมั่นใจ (ครูสังเกต)<select aria-label="ความมั่นใจ (ครูสังเกต)" value={draft.confidence} onChange={e=>field('confidence',e.target.value)}><option value="">ยังไม่ได้สังเกต</option>{Object.entries(READING_CONFIDENCE).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          <p className="reading-wide reading-field-help">เลือกจากพฤติกรรมที่ครูเห็นครั้งนี้ เว้นว่างเมื่อยังไม่ได้สังเกต</p>
          <label className="reading-wide">หมายเหตุ (ถ้ามี)<textarea maxLength={500} rows={2} value={draft.note} onChange={e=>field('note',e.target.value)} placeholder="บันทึกสิ่งที่สังเกตระหว่างอ่าน"/></label>
        </div>
        <div aria-live="polite"><Accuracy correct={preview?Number(draft.correct_words):-1} incorrect={preview?Number(draft.incorrect_words):-1}/></div>
        {error && <p className="reading-error" role="alert">{error}</p>}
        <div className="reading-form-actions"><button className="primary" type="submit">{saving?'กำลังบันทึก…':'บันทึกผลการอ่าน'}<Icon name="check" size={18}/></button><button className="secondary" type="button" onClick={close}>ยกเลิก</button>{editing && <button className="text-button" type="button" onClick={()=>{close();setRefresh(n=>n+1);}}>โหลดบันทึกล่าสุด</button>}</div>
      </fieldset>
    </form>}
    {!loading&&!loadError&&!rows.length && <p className="reading-empty">ยังไม่มีบันทึกการอ่าน ครูเพิ่มได้โดยไม่ต้องรอให้นักเรียนทำกิจกรรม</p>}
    {rows.length>0 && <><div className="reading-date-filter"><label>ตั้งแต่วันที่<input type="date" value={from} onChange={e=>{setFrom(e.target.value);setVisible(10);}}/></label><label>ถึงวันที่<input type="date" value={to} onChange={e=>{setTo(e.target.value);setVisible(10);}}/></label><button className="text-button" onClick={()=>{setFrom('');setTo('');setVisible(10);}}>ดูทุกวันที่</button></div>
      {invalidDates && <p className="reading-error" role="alert">วันที่เริ่มต้นต้องไม่อยู่หลังวันที่สิ้นสุด</p>}
      <p role="status" className="reading-field-help">แสดง {filtered.length} จาก {rows.length} บันทึก · วันที่ตามอุปกรณ์นี้</p>
      {!invalidDates && <ReadingProgress rows={filtered}/>}
      <div className="reading-history-heading"><h3>ประวัติการอ่าน {filtered.length} ครั้ง</h3><button className="text-button" disabled={!filtered.length||invalidDates||loading||Boolean(loadError)} onClick={exportRows}>ส่งออกบันทึกการอ่าน CSV<Icon name="download" size={16}/></button></div>
      <ol className="reading-history">{filtered.slice(0,visible).map(row=><li key={row.id}><article><div className="reading-record-heading"><time dateTime={row.assessed_at}>{new Date(row.assessed_at).toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'})}</time><button className="text-button" disabled={opened||saving||loading||Boolean(loadError)} onClick={()=>open(row)} aria-label={`แก้ไขบันทึกการอ่าน ${new Date(row.assessed_at).toLocaleString('th-TH')}`}>แก้ไข</button></div><Accuracy correct={row.correct_words} incorrect={row.incorrect_words}/><p className="reading-field-help">ความช่วยเหลือ: {READING_HELP[row.help_level]}</p><details><summary>รายละเอียดการอ่าน</summary><dl className="reading-record-details"><div><dt>อ่านถูก / อ่านผิด</dt><dd>{row.correct_words} / {row.incorrect_words} คำ</dd></div><div><dt>สลับตัวอักษร</dt><dd>{row.letter_swaps} ครั้ง</dd></div><div><dt>อ่านข้าม</dt><dd>{row.skipped_words} คำ</dd></div><div><dt>หยุดกลางคัน</dt><dd>{row.stops} ครั้ง</dd></div><div><dt>เวลาอ่าน</dt><dd>{row.reading_seconds===null?'ไม่ได้จับเวลา':`${row.reading_seconds} วินาที`}</dd></div><div><dt>ความช่วยเหลือ</dt><dd>{READING_HELP[row.help_level]}</dd></div><div><dt>การมีส่วนร่วม</dt><dd>{row.participation ? READING_PARTICIPATION[row.participation] : 'ยังไม่ได้สังเกต'}</dd></div><div><dt>ความมั่นใจ</dt><dd>{row.confidence ? READING_CONFIDENCE[row.confidence] : 'ยังไม่ได้สังเกต'}</dd></div></dl>{row.reading_text && <p>คำหรือประโยค: {row.reading_text}</p>}{row.note && <p>หมายเหตุ: {row.note}</p>}</details></article></li>)}</ol>
      {filtered.length>visible && <button className="text-button" onClick={()=>setVisible(n=>n+10)}>ดูบันทึกเพิ่มเติม ({filtered.length-visible} ครั้ง)</button>}
    </>}
  </section>;
}
