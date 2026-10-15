import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { ConsonantArt } from './ConsonantArt';
import { consonants as letters } from '../data/consonants';
import { playLessonAudio, stopLessonAudio } from '../learningAudio';
import type { Settings } from '../types';

export function ConsonantIntro({ settings, onBack }: { settings: Settings; onBack: () => void }) {
  const [index, setIndex] = useState(0);
  const [message, setMessage] = useState('');
  const current = letters[index];
  useEffect(() => () => stopLessonAudio(), []);
  function select(next: number) { stopLessonAudio(); setMessage(''); setIndex(next); }
  return <section className="consonant-intro" aria-label="รู้จักกันก่อน">
    <div className="page-heading"><h1 tabIndex={-1}>รู้จักกันก่อน</h1><button className="secondary" onClick={onBack}><Icon name="back"/>กลับบทเรียน</button></div>
    <button className="audio-button" disabled={!settings.sound} onClick={() => playLessonAudio(current.speech, settings, setMessage)} aria-label={'ฟัง ' + current.speech}><Icon name="sound"/>ฟัง</button>
    <div className="intro-focus" aria-live="polite"><ConsonantArt kind={current.art} label={current.word}/><strong>{current.letter}</strong></div>
    <div className="intro-controls"><button className="secondary" disabled={index === 0} onClick={() => select(index - 1)}><Icon name="back"/>ก่อนหน้า</button><span>{index + 1} / {letters.length}</span><button className="primary" disabled={index === letters.length - 1} onClick={() => select(index + 1)}>ถัดไป<Icon name="arrow"/></button></div>
    <div className="intro-letters" aria-label="เลือกพยัญชนะ ก ถึง ฮ">{letters.map((item, i) => <button key={item.letter} className={'secondary ' + (index === i ? 'selected' : '')} aria-pressed={index === i} aria-label={'รู้จัก ' + item.letter + ' ' + item.word} onClick={() => { select(i); const heading=document.querySelector<HTMLElement>('.consonant-intro h1'); heading?.focus({preventScroll:true}); window.scrollTo({ top: 0, behavior: 'instant' }); }}>{item.letter}</button>)}</div>
    <p className={'audio-status '+(!settings.sound || /ไม่มี|ไม่สำเร็จ|ปิดเสียง/.test(message)?'':'sr-only')} role="status">{!settings.sound ? 'ปิดเสียงอยู่ เปิดได้ในหน้าปรับการใช้งาน' : message}</p>
  </section>;
}
