import type { Question } from '../types';
import { VowelGlyph, vowelName } from './VowelVisual';

export type WordDraft = { consonant: string; vowel: string; final?: string };
export function WordBuilder({question,draft,locked,onChange,onCheck}:{question:Question;draft:WordDraft;locked:boolean;onChange:(draft:WordDraft)=>void;onCheck:(word:string)=>void}) {
 const missing=question.build!.missing;
 const consonant=missing==='vowel'?question.word[0]:draft.consonant;
 const vowel=missing==='consonant'?question.word[1]:draft.vowel;
 const finalMode=missing==='final';
 const complete=finalMode?!!draft.final:!!consonant && !!vowel;
 const word=complete?(finalMode?question.build!.baseWord!+draft.final:consonant+vowel):'';
 const placeholder=finalMode?question.build!.baseWord+' + ?':missing==='vowel'?question.word[0]+' + ?':missing==='consonant'?'? + '+vowelName(question.word[1]):'?';
 return <div className="word-builder">
  <div className="built-word" role="status" aria-label={'คำที่สร้าง: '+(word||'ยังไม่ครบ')}><small>{missing?'เติมส่วนที่หาย':'คำของฉัน'}</small><strong>{word||placeholder}</strong><span>{complete?'พร้อมแล้ว กดตรวจคำ':finalMode?'ตัวสะกดอยู่ท้ายคำ เติมส่วนท้ายให้ครบ':missing==='vowel'?'มีพยัญชนะแล้ว เติมสระนะ':missing==='consonant'?'มีสระแล้ว เติมพยัญชนะนะ':'เลือกพยัญชนะและสระ'}</span></div>
  {!finalMode && missing!=='vowel' && <fieldset disabled={locked}><legend>{missing?'เลือกพยัญชนะที่หาย':'1. เลือกพยัญชนะ'}</legend><div className="build-choices">{question.build!.consonants.map(c=><button className="letter-option" key={c} aria-label={'เลือกพยัญชนะ '+c} aria-pressed={draft.consonant===c} onClick={()=>onChange({...draft,consonant:c})}>{c}</button>)}</div></fieldset>}
  {!finalMode && missing!=='consonant' && <fieldset disabled={locked}><legend>{missing?'เลือกสระที่หาย':'2. เลือกสระ'}</legend><div className="build-choices">{question.build!.vowels.map(v=><button className="letter-option" key={v} aria-label={'เลือกสระ '+vowelName(v)} aria-pressed={draft.vowel===v} onClick={()=>onChange({...draft,vowel:v})}><VowelGlyph value={v}/></button>)}</div></fieldset>}
  {finalMode && <fieldset disabled={locked}><legend>เลือกตัวสะกดท้ายคำ</legend><div className="build-choices">{question.build!.finals!.map(f=><button className="letter-option" key={f} aria-label={'เลือกตัวสะกด '+f} aria-pressed={draft.final===f} onClick={()=>onChange({...draft,final:f})}>{f}</button>)}</div></fieldset>}
  <button className="primary check-word" disabled={locked||!complete} onClick={()=>onCheck(word)}>ตรวจคำที่สร้าง</button>
 </div>;
}
