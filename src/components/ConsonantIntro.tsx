import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { Illustration } from './Art';
import { playLessonAudio, stopLessonAudio } from '../learningAudio';
import type { Settings } from '../types';

const letters = [
  { letter: 'ก', word: 'ไก่', speech: 'กอ ไก่', art: 'chicken' },
  { letter: 'ม', word: 'ม้า', speech: 'มอ ม้า', art: 'horse' },
  { letter: 'ป', word: 'ปลา', speech: 'ปอ ปลา', art: 'fish' },
  { letter: 'ร', word: 'เรือ', speech: 'รอ เรือ', art: 'boat' },
  { letter: 'บ', word: 'ใบไม้', speech: 'บอ ใบไม้', art: 'leaf' }
];

export function ConsonantIntro({ settings, onBack, onStart }: { settings: Settings; onBack: () => void; onStart?: () => void }) {
  const [index, setIndex] = useState(0);
  const [message, setMessage] = useState('');
  const current = letters[index];
  useEffect(() => () => stopLessonAudio(), []);
  function select(next: number) { stopLessonAudio(); setMessage(''); setIndex(next); }
  return <section className="consonant-intro" aria-label="รู้จักกันก่อน">
    <div className="page-heading"><h1 tabIndex={-1}>รู้จักกันก่อน</h1><button className="secondary" onClick={onBack}><Icon name="back"/>กลับบทเรียน</button></div>
    <p>ดูภาพ · แตะฟัง · อ่านตาม</p>
    <button className="audio-button" disabled={!settings.sound} onClick={() => playLessonAudio(current.speech, settings, setMessage)} aria-label={'ฟัง ' + current.speech}><Icon name="sound"/>ฟัง</button>
    <div className="intro-focus" aria-live="polite"><Illustration kind={current.art} label={current.word}/><strong>{current.letter}</strong><span>{current.word}</span></div>
    <div className="intro-letters" aria-label="เลือกพยัญชนะ">{letters.map((item, i) => <button key={item.letter} className={'secondary ' + (index === i ? 'selected' : '')} aria-pressed={index === i} aria-label={'รู้จัก ' + item.speech} onClick={() => select(i)}>{item.letter}</button>)}</div>
    <div className="intro-controls"><button className="secondary" disabled={index === 0} onClick={() => select(index - 1)}><Icon name="back"/>ก่อนหน้า</button><span>{index + 1} / {letters.length}</span>{index < letters.length - 1 ? <button className="primary" onClick={() => select(index + 1)}>ถัดไป<Icon name="arrow"/></button> : onStart ? <button className="primary" onClick={onStart}>เริ่มฝึก<Icon name="arrow"/></button> : <button className="primary" onClick={onBack}>กลับบทเรียน</button>}</div>
    <p className="audio-status" role="status">{!settings.sound ? 'ปิดเสียงอยู่ เปิดได้ในหน้าปรับการใช้งาน' : message}</p>
  </section>;
}
