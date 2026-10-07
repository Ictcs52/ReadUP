import type { Question } from '../types';
import { VowelGlyph, vowelName } from './VowelVisual';

export type WordDraft = { consonant: string; vowel: string };
export function WordBuilder({question,draft,locked,onChange,onCheck}:{question:Question;draft:WordDraft;locked:boolean;onChange:(draft:WordDraft)=>void;onCheck:(word:string)=>void}) {
 const complete=!!draft.consonant && !!draft.vowel;
 const word=complete?draft.consonant+draft.vowel:'';
 return <div className="word-builder">
  <div className="built-word" role="status" aria-label={'คำที่สร้าง: '+(word||'ยังไม่ครบ')}><small>คำของฉัน</small><strong>{word||'?'}</strong><span>{complete?'พร้อมแล้ว กดตรวจคำ':'เลือกพยัญชนะและสระ'}</span></div>
  <fieldset disabled={locked}><legend>1. เลือกพยัญชนะ</legend><div className="build-choices">{question.build!.consonants.map(c=><button className="letter-option" key={c} aria-label={'เลือกพยัญชนะ '+c} aria-pressed={draft.consonant===c} onClick={()=>onChange({...draft,consonant:c})}>{c}</button>)}</div></fieldset>
  <fieldset disabled={locked}><legend>2. เลือกสระ</legend><div className="build-choices">{question.build!.vowels.map(v=><button className="letter-option" key={v} aria-label={'เลือกสระ '+vowelName(v)} aria-pressed={draft.vowel===v} onClick={()=>onChange({...draft,vowel:v})}><VowelGlyph value={v}/></button>)}</div></fieldset>
  <button className="primary check-word" disabled={locked||!complete} onClick={()=>onCheck(word)}>ตรวจคำที่สร้าง</button>
 </div>;
}
