import type { Question } from '../types';
import { Illustration } from './Art';

export function vowelName(value: string) {
  return ({ 'า': 'อา', 'ี': 'อี', 'ู': 'อู' } as Record<string,string>)[value] ?? value;
}

// Keep the consonant and combining vowel in one text run for correct Thai shaping.
export function VowelGlyph({ value }: { value: string }) {
  return <span className="vowel-glyph" aria-hidden="true">{vowelName(value)}</span>;
}

export function VowelVisual({ question }: { question: Question }) {
  return <div className="vowel-visual">
    <figure><Illustration kind={question.art} label={question.word} className="question-art"/><figcaption>{question.word}</figcaption></figure>
    {question.vowelExample && <div className="vowel-example" aria-label={`ตัวอย่างสระ ${vowelName(question.letter)}`}><VowelGlyph value={question.letter}/><span>สระ {vowelName(question.letter)}</span></div>}
  </div>;
}
