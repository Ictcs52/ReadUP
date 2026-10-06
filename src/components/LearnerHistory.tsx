import { useState } from 'react';
import type { Lesson, Session } from '../types';
import { summarize } from '../domain.mjs';
import { Icon } from './Icon';

export function LearnerHistory({ sessions, lessons, onContinue, onLessons }: {
  sessions: Session[]; lessons: Lesson[]; onContinue: (lessonId: number) => void; onLessons: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const history = [...sessions].sort((a, b) => b.startedAt - a.startedAt);
  const total = summarize(sessions.flatMap(s => s.records));
  const finished = sessions.filter(s => s.status === 'complete');
  const stars = total.independent + total.retried + total.assisted;
  return <section className="cloud-panel learner-history" aria-labelledby="practice-history-title">
    <h2 id="practice-history-title">ประวัติการฝึกของฉัน</h2>
    <p>ทุกครั้งที่ฝึก คืออีกก้าวของเธอ</p>
    <dl className="practice-summary" aria-label="สรุปการฝึกของฉัน">
      <div><dt>บทที่ฝึกครบ</dt><dd>{new Set(finished.map(s => s.lessonId)).size}<small> บท</small></dd></div>
      <div><dt>ฝึกครบหนึ่งช่วง</dt><dd>{finished.length}<small> ครั้ง</small></dd></div>
      <div><dt>ดาวที่สะสม</dt><dd>{stars}<small> ดวง</small></dd></div>
    </dl>
    {!history.length ? <div className="practice-empty"><Icon name="book" size={32}/><h3>ยังไม่มีประวัติการฝึก</h3><p>เริ่มบทเรียนแรก แล้วกลับมาดูก้าวเล็ก ๆ ของเธอที่นี่ได้เลย</p><button className="primary" onClick={onLessons}>เลือกบทเรียน<Icon name="arrow" size={18}/></button></div> : <>
      <p className="practice-count">{expanded || history.length <= 10 ? `ฝึกทั้งหมด ${history.length} ครั้ง` : `แสดง 10 ครั้งล่าสุด จาก ${history.length} ครั้ง`}</p>
      <ol className="practice-list">{(expanded ? history : history.slice(0, 10)).map(s => {
        const result = summarize(s.records);
        const earned = result.independent + result.retried + result.assisted;
        return <li key={s.id}><article className="practice-entry">
          <div className="practice-entry-main"><h3>{lessons.find(l => l.id === s.lessonId)?.title ?? `บทเรียนที่ ${s.lessonId}`}</h3><time dateTime={new Date(s.startedAt).toISOString()}>{new Date(s.startedAt).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</time><p>ทำไป {s.records.length} / {s.questionIndices.length} ข้อ</p></div>
          <div className="practice-entry-result"><span className="pill">{s.status === 'complete' ? 'ฝึกครบแล้ว' : s.status === 'active' ? 'กำลังฝึก' : 'พักรอบนี้ไว้'}</span><span className="practice-stars"><Icon name="star" size={18}/>{earned} ดวง</span>{s.status === 'active' && <button className="secondary" onClick={()=>onContinue(s.lessonId)}>ฝึกต่อ<Icon name="arrow" size={16}/></button>}</div>
        </article></li>;
      })}</ol>
      {history.length > 10 && <button className="text-button" onClick={()=>setExpanded(value=>!value)}>{expanded ? 'แสดงเฉพาะล่าสุด' : 'ดูประวัติทั้งหมด'}</button>}
    </>}
  </section>;
}
