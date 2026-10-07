import type { Question } from '../types';
import { VowelGlyph, vowelName } from './VowelVisual';
import { orderedOptions } from '../domain.mjs';
export function OrderWord({question,parts,seed,locked,onChange,onCheck}:{question:Question;parts:string[];seed:string;locked:boolean;onChange:(parts:string[])=>void;onCheck:(word:string)=>void}){
 const vowel=(p:string)=>['า','ี','ู'].includes(p);
 const word=parts.map((p,i)=>i===0&&['า','ี','ู'].includes(p)?'อ'+p:p).join('');
 return <div className="word-builder">
  <div className="built-word" role="status" aria-label={'คำที่เรียง: '+(word||'ยังไม่ได้เรียง')}><small>คำของฉัน</small><strong>{word||'?'}</strong><span>แตะพยัญชนะก่อน แล้วแตะสระ</span></div>
  <fieldset disabled={locked}><legend>เลือกส่วนของคำตามลำดับ</legend><div className="build-choices">{orderedOptions(question.order!,seed).map((p:string)=><button className="letter-option" key={p} disabled={parts.includes(p)} aria-label={vowel(p)?'เพิ่มสระ '+vowelName(p):'เพิ่มพยัญชนะ '+p} onClick={()=>onChange([...parts,p])}>{vowel(p)?<VowelGlyph value={p}/>:p}</button>)}</div></fieldset>
  <div className="order-actions"><button className="secondary" disabled={locked||!parts.length} onClick={()=>onChange(parts.slice(0,-1))}>ย้อนหนึ่งส่วน</button><button className="primary" disabled={locked||parts.length!==question.order!.length} onClick={()=>onCheck(word)}>ตรวจคำที่เรียง</button></div>
 </div>;
}
