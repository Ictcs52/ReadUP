import { useState } from 'react';
import type { ReadingAssessment } from '../readingAssessments';
import { readingAccuracy, READING_HELP, READING_PARTICIPATION, READING_CONFIDENCE } from '../readingDomain.mjs';

const metrics = {
  accuracy: { label: 'อ่านถูก (%)', unit: '%', value: (r: ReadingAssessment) => readingAccuracy(r.correct_words,r.incorrect_words)!.percentage },
  skipped: { label: 'อ่านข้าม (คำ)', unit: 'คำ', value: (r: ReadingAssessment) => r.skipped_words },
  help: { label: 'ความช่วยเหลือ', unit: '', value: (r: ReadingAssessment) => ['independent','prompted','guided','full'].indexOf(r.help_level) },
};
export function ReadingProgress({ rows }: { rows: ReadingAssessment[] }) {
  const [metric,setMetric] = useState<keyof typeof metrics>('accuracy');
  const [selected,setSelected] = useState<string | null>(null);
  const chronological = [...rows].sort((a,b)=>Date.parse(a.assessed_at)-Date.parse(b.assessed_at)||a.id.localeCompare(b.id));
  // A long series remains available in the date-filtered history and CSV.
  const points = chronological.slice(-30);
  const chosen = points.find(r=>r.id===selected) ?? points.at(-1);
  const config = metrics[metric];
  const max = metric==='accuracy'?100:metric==='help'?3:Math.max(1,...points.map(config.value));
  const x = (i: number) => points.length===1?270:58+i*424/(points.length-1);
  const y = (r: ReadingAssessment) => 166-config.value(r)*130/max;
  const label = (r: ReadingAssessment) => metric==='help'?READING_HELP[r.help_level]:`${config.value(r).toLocaleString('th-TH',{maximumFractionDigits:2})} ${config.unit}`;
  return <section className="reading-progress" aria-label="ความก้าวหน้าการอ่าน">
    <div className="reading-history-heading"><h3>ความก้าวหน้าการอ่าน</h3><label>กราฟที่แสดง<select aria-label="กราฟที่แสดง" value={metric} onChange={e=>setMetric(e.target.value as keyof typeof metrics)}>{Object.entries(metrics).map(([value,config])=><option key={value} value={value}>{config.label}</option>)}</select></label></div>
    <p className="reading-field-help">เทียบผลเมื่อใช้ชุดคำ จำนวนคำ และความช่วยเหลือใกล้เคียงกัน แต่ละจุดคือหนึ่งครั้งที่ครูประเมิน</p>
    {!points.length?<p>ไม่มีบันทึกในช่วงวันที่เลือก</p>:<>
      {chronological.length>30&&<p className="reading-field-help">กราฟแสดง 30 ครั้งล่าสุดในช่วงนี้ ประวัติและ CSV มีครบทุกครั้ง</p>}
      <svg className="reading-chart" viewBox="0 0 520 210" role="img" aria-label={`กราฟ${config.label} ${points.length} ครั้ง เรียงจากเก่าไปใหม่ ดูค่าจริงในรายละเอียดด้านล่าง`}>
        {[0,0.5,1].map(f=><g key={f}><line x1="58" x2="482" y1={166-f*130} y2={166-f*130} stroke="#d8dfeb"/><text x="48" y={171-f*130} textAnchor="end">{metric==='help'?(f===0?'เอง':f===1?'ต่อเนื่อง':''):Number((max*f).toFixed(1))}</text></g>)}
        {metric==='accuracy'&&<><line x1="58" x2="482" y1="62" y2="62" stroke="#536887" strokeDasharray="5 4"/><text x="482" y="55" textAnchor="end">เป้าหมาย 80%</text></>}
        <polyline points={points.map((r,i)=>`${x(i)},${y(r)}`).join(' ')} fill="none" stroke="#4663aa" strokeWidth="3"/>
        {points.map((r,i)=><circle key={r.id} cx={x(i)} cy={y(r)} r={r.id===chosen?.id?6:4} fill="#304c92"><title>{new Date(r.assessed_at).toLocaleString('th-TH')} · {label(r)} · {r.reading_text||'ไม่ระบุชุดคำ'}</title></circle>)}
        <text x="58" y="196">เก่า</text><text x="482" y="196" textAnchor="end">ใหม่</text>
      </svg>
      <label className="reading-point-select">ดูรายละเอียดจุดในกราฟ<select aria-label="ดูรายละเอียดจุดในกราฟ" value={chosen?.id} onChange={e=>setSelected(e.target.value)}>{points.map((r,i)=><option key={r.id} value={r.id}>{i+1}. {new Date(r.assessed_at).toLocaleString('th-TH')} · {label(r)}</option>)}</select></label>
      {chosen&&<div className="reading-point-detail" aria-live="polite"><strong>{config.label}: {label(chosen)}</strong><p>ชุดคำ: {chosen.reading_text||'ยังไม่ระบุ'} · ทั้งหมด {chosen.correct_words+chosen.incorrect_words} คำ</p><p>ความช่วยเหลือ: {READING_HELP[chosen.help_level]}</p><p>การมีส่วนร่วม: {chosen.participation ? READING_PARTICIPATION[chosen.participation] : 'ยังไม่ได้สังเกต'}</p><p>ความมั่นใจ: {chosen.confidence ? READING_CONFIDENCE[chosen.confidence] : 'ยังไม่ได้สังเกต'}</p></div>}
    </>}
  </section>;
}
