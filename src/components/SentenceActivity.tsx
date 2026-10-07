import type { Question } from '../types';
import { Illustration } from './Art';
import { orderedOptions } from '../domain.mjs';

export function SentenceVisual({question,hintLevel}:{question:Question;hintLevel:number}) {
  const reading=question.reading!;
  return <div className="sentence-visual">
    {(reading.pictureFirst || hintLevel>0) && question.art!=='none' && <Illustration kind={question.art} label="ภาพประกอบการอ่าน" className="sentence-art"/>}
    {reading.text && <div className="reading-passage" aria-label="ข้อความสำหรับอ่าน">{reading.chunks ? <p className="reading-chunks">{reading.chunks.map((chunk,i)=><span key={i}>{chunk}</span>)}</p> : <p>{reading.text}</p>}</div>}
    <h3 className="reading-question">{reading.question}</h3>
  </div>;
}

export function SentenceOrder({question,parts,seed,locked,onChange,onCheck}:{question:Question;parts:string[];seed:string;locked:boolean;onChange:(parts:string[])=>void;onCheck:(sentence:string)=>void}) {
  const tokens=question.reading!.parts!;
  return <div className="word-builder sentence-builder">
    <div className="built-word" role="status" aria-label={'ข้อความที่เรียง: '+(parts.join(' ')||'ยังไม่ได้เรียง')}><small>ข้อความของฉัน</small><strong>{parts.join(' ')||'แตะคำด้านล่าง'}</strong></div>
    <fieldset disabled={locked}><legend>แตะตามลำดับ แล้วตรวจคำตอบ</legend><div className="build-choices">{orderedOptions(tokens,seed).map((part:string)=><button className="letter-option" key={part} disabled={parts.includes(part)} aria-label={'เพิ่มส่วน '+part} onClick={()=>onChange([...parts,part])}>{part}</button>)}</div></fieldset>
    <div className="order-actions"><button className="secondary" disabled={locked||!parts.length} onClick={()=>onChange(parts.slice(0,-1))}>ย้อนหนึ่งส่วน</button><button className="primary" disabled={locked||parts.length!==tokens.length} onClick={()=>onCheck(parts.join(' '))}>ตรวจข้อความที่เรียง</button></div>
  </div>;
}
