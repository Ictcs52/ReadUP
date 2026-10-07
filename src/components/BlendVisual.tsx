import type { Question } from '../types';
import { Illustration } from './Art';
import { vowelName } from './VowelVisual';

export function BlendVisual({ question, revealed }: { question: Question; revealed: boolean }) {
  const blend=question.blend!;
  const showWord=blend.model || revealed;
  return <div className="blend-visual">
    {question.previousWord ? <div className="vowel-change"><small>คำเดิม</small><strong>{question.previousWord}</strong><p>เปลี่ยนสระเป็น <b>{vowelName(blend.vowel)}</b></p></div> : <Illustration kind={question.art} label={question.word} className="question-art"/>}
    <div className="blend-parts" aria-label={`${blend.consonant} กับสระ ${vowelName(blend.vowel)}${showWord?` ประสมเป็น ${question.word}`:''}`}>
      <div><small>พยัญชนะ</small><strong>{blend.consonant}</strong></div>
      <span aria-hidden="true">+</span>
      <div><small>สระ</small><strong>{vowelName(blend.vowel)}</strong></div>
      <span aria-hidden="true">=</span>
      <div className={'blend-word '+(showWord?'revealed':'')}><small>{showWord?'คำ':'ลองประสม'}</small><strong>{showWord?question.word:'?'}</strong></div>
    </div>
  </div>;
}
