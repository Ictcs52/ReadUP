import { csvCell } from './domain.mjs';
import { READING_HELP,readingAccuracy } from './readingDomain.mjs';
export const ASSESSMENT_DOMAINS=['การจำแนกพยัญชนะและสระ','การประสมคำ','ความถูกต้องในการอ่าน','ความคล่องในการอ่าน','ความเข้าใจจากการอ่าน'];
export function parseCriteria(draft) {
 const title=String(draft.title??'').trim();if(!title||title.length>200)throw new Error('ระบุชื่อชุดประเมินไม่เกิน 200 ตัวอักษร');
 if(draft.criteria.length!==5)throw new Error('กำหนดเกณฑ์ครบ 5 ด้าน');
 const criteria=draft.criteria.map(c=>{
  const raw=String(c.max_score);if(!/^\d+(\.\d{1,2})?$/.test(raw))throw new Error('คะแนนเต็มต้องเป็นตัวเลขบวก ทศนิยมไม่เกิน 2 ตำแหน่ง');
  const max_score=Number(raw);if(max_score<=0||max_score>10000)throw new Error('คะแนนเต็มต้องมากกว่า 0 และไม่เกิน 10,000');
  const method=String(c.method??'').trim();if(!method||method.length>500)throw new Error('ระบุวิธีประเมินและเกณฑ์ให้คะแนนครบทุกด้าน ไม่เกินด้านละ 500 ตัวอักษร');
  return {max_score,method};
 });return {title,criteria};
}
export function parsePhase(draft,criteria) {
 if(draft.scores.length!==5)throw new Error('กรอกคะแนนครบ 5 ด้าน');
 const scores=draft.scores.map((raw,i)=>{if(!/^\d+(\.\d{1,2})?$/.test(String(raw)))throw new Error('กรอกคะแนนครบทุกด้าน ทศนิยมไม่เกิน 2 ตำแหน่ง');const value=Number(raw);if(value<0||value>criteria[i].max_score)throw new Error(`คะแนนด้านที่ ${i+1} ต้องไม่เกินคะแนนเต็ม ${criteria[i].max_score}`);return value;});
 const date=new Date(draft.assessed_at);if(!draft.assessed_at||!Number.isFinite(date.getTime()))throw new Error('ระบุวันและเวลาประเมิน');
 const reading_text=String(draft.reading_text??'').trim(),note=String(draft.note??'').trim();if(!reading_text||reading_text.length>500||note.length>500)throw new Error('ระบุชุดคำหรือแบบประเมินที่ใช้ และกรอกข้อความไม่เกินช่องละ 500 ตัวอักษร');
 if(!Object.hasOwn(READING_HELP,draft.help_level))throw new Error('เลือกระดับความช่วยเหลือ');
 const metrics={};for(const key of ['correct_words','incorrect_words','letter_swaps','skipped_words','stops','reading_seconds']){
  const raw=String(draft[key]??'').trim();if(!raw){metrics[key]=null;continue;}
  const max=key==='reading_seconds'?86400:10000,min=key==='reading_seconds'?1:0;
  if(!/^\d+$/.test(raw)||Number(raw)<min||Number(raw)>max)throw new Error('จำนวนคำและครั้งต้องเป็นจำนวนเต็ม 0–10,000 เวลาเป็นวินาที 1–86,400 หรือเว้นว่างหากไม่ได้บันทึก');metrics[key]=Number(raw);
 }
 if((metrics.correct_words===null)!==(metrics.incorrect_words===null))throw new Error('กรอกจำนวนคำอ่านถูกและอ่านผิดทั้งสองช่อง หรือเว้นว่างทั้งคู่');
 if(metrics.correct_words!==null&&(metrics.correct_words+metrics.incorrect_words<1||metrics.correct_words+metrics.incorrect_words>10000))throw new Error('จำนวนคำทั้งหมดต้องอยู่ระหว่าง 1–10,000');
 if(metrics.incorrect_words!==null&&metrics.skipped_words!==null&&metrics.skipped_words>metrics.incorrect_words)throw new Error('คำที่อ่านข้ามต้องนับรวมในคำอ่านผิด');
 return {...metrics,scores,assessed_at:date.toISOString(),reading_text,help_level:draft.help_level,note,comparable:Boolean(draft.comparable)};
}
export function phasePercentage(phase,criteria,index){return phase?phase.scores[index]*100/criteria[index].max_score:null;}
export function assessmentCsv(row,student){
 const headings=['เลขประจำตัว','ชื่อ–สกุล','ชั้น','ชุดประเมิน','ช่วงประเมิน','วันเวลา','ชุดคำหรือแบบประเมิน','ระดับความช่วยเหลือ','ครูยืนยันเทียบกันได้'];
 ASSESSMENT_DOMAINS.forEach(name=>headings.push(name+' คะแนน',name+' คะแนนเต็ม',name+' (%)',name+' วิธีประเมิน',name+' ผลต่าง (จุดเปอร์เซ็นต์)'));
 headings.push('อ่านถูก','อ่านผิด','อ่านถูกจริง (%)','สลับตัวอักษร','อ่านข้าม','หยุดกลางคัน','เวลาอ่าน (วินาที)','หมายเหตุ');const rows=[headings];
 for(const [stage,label] of [['pre','ก่อนฝึก'],['post','หลังฝึก']]){const phase=row[stage];if(!phase)continue;const values=[student.code,student.display_name,student.class_name,row.title,label,new Date(phase.assessed_at).toLocaleString('th-TH'),phase.reading_text,READING_HELP[phase.help_level],row.post?.comparable?'ยืนยัน':'ยังไม่ยืนยัน'];
 ASSESSMENT_DOMAINS.forEach((_,i)=>values.push(phase.scores[i],row.criteria[i].max_score,phasePercentage(phase,row.criteria,i).toFixed(2),row.criteria[i].method,stage==='post'&&row.pre&&row.post.comparable?(phasePercentage(row.post,row.criteria,i)-phasePercentage(row.pre,row.criteria,i)).toFixed(2):''));
 values.push(phase.correct_words??'',phase.incorrect_words??'',phase.correct_words===null?'':readingAccuracy(phase.correct_words,phase.incorrect_words)?.percentage.toFixed(2)??'',phase.letter_swaps??'',phase.skipped_words??'',phase.stops??'',phase.reading_seconds??'',phase.note);rows.push(values);}
 return '\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
}
export function sameAssessment(a,b){const normalize=v=>Array.isArray(v)?v.map(normalize):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,normalize(v[k])])):v;return JSON.stringify(normalize(a))===JSON.stringify(normalize(b));}
