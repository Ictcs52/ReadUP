import { useEffect, useRef, useState } from 'react';
import { WordBuilder } from './components/WordBuilder';
import type { MouseEvent, ReactNode } from 'react';
import curriculum from './data/lessons.json';
import { defaultData } from './storage';
import { answerPraise, practiceRewards } from './rewardsDomain.mjs';
import { RewardsPanel } from './components/RewardsPanel';
import { breakDue, practiceElapsed } from './practiceTime.mjs';
import { exportCsv, orderedOptions, percent, resultCategory, reviewItems, summarize } from './domain.mjs';
import type { Lesson, Observation, Session } from './types';
import { useCloudAccount } from './useCloudAccount';
import { markChanged, useLearningStore } from './useLearningStore';
import { matchesGrade } from './gradeLevels';
import { ReportStudentPicker } from './components/ReportStudentPicker';
import { PrePostPanel } from './components/PrePostPanel';
import { ReadingAssessmentPanel } from './components/ReadingAssessmentPanel';
import { LearnerHistory } from './components/LearnerHistory';
import { TeacherPanel } from './components/TeacherPanel';
import { Icon } from './components/Icon';
import { BookFriend, Illustration } from './components/Art';
import { AnswerStars } from './components/AnswerStars';
import { VowelGlyph, VowelVisual, vowelName } from './components/VowelVisual';
import { BlendVisual } from './components/BlendVisual';
import { disposeFeedbackSound, playFeedbackSound, stopFeedbackSound } from './feedbackAudio';
import { playLessonAudio, preferredThaiVoice, recordingCount, stopLessonAudio, thaiVoices } from './learningAudio';

const lessons = curriculum.lessons as Lesson[];
const lessonLevel = (id: number) => Math.ceil(id / 5);
type Page = 'home' | 'lessons' | 'rewards' | 'report' | 'settings' | 'about' | 'exercise' | 'result' | 'account';
const nav = [
  { id: 'home', text: 'หน้าหลัก', icon: 'home' },
  { id: 'lessons', text: 'บทเรียนของฉัน', icon: 'book' },
  { id: 'rewards', text: 'รางวัลของฉัน', icon: 'star' },
  { id: 'account', text: 'สำหรับครู', icon: 'shield' }
] as const;

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); return () => ref.current?.close(); }, []);
  return <dialog ref={ref} aria-labelledby="dialog-title" onCancel={e => { e.preventDefault(); onClose(); }}>
    <div className="dialog-top"><h2 id="dialog-title">{title}</h2><button className="icon-button" aria-label="ปิดหน้าต่าง" onClick={onClose}><Icon name="close" /></button></div>
    {children}
  </dialog>;
}

export default function App() {
  const account = useCloudAccount();
  const store = useLearningStore(account);
  const authorized = Boolean(account.user && ((account.teacher?.active && account.teacher.id === account.user.id) || (account.learner?.auth_user_id === account.user.id)));
  const canOpenReport = Boolean(account.teacher?.active && account.user?.id === account.teacher.id);
  const teacherReportOnly = Boolean(canOpenReport && store.cloud);
  const canPractice = authorized && !teacherReportOnly;

  const { data, setData, loaded, storageMessage, setStorageMessage } = store;
  const [page, setPage] = useState<Page>('home');
  const [reportGrade, setReportGrade] = useState('');
  const canReport = Boolean(store.cloud && canOpenReport && matchesGrade(account.student?.class_name,reportGrade));
  useEffect(()=>setReportGrade(''),[account.user?.id]);
  useEffect(()=>{if(page==='report' && account.student && !matchesGrade(account.student.class_name,reportGrade))account.selectStudent(null);},[page,reportGrade,account.student?.id,account.student?.class_name]);
  const [level, setLevel] = useState(1);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pause, setPause] = useState(false);
  const [breakReminder, setBreakReminder] = useState(false);
  const [confirmStart, setConfirmStart] = useState<{ id: number; indices?: number[] } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [confirmRefresh, setConfirmRefresh] = useState(false);
  const [audioMessage, setAudioMessage] = useState('');
  const [chosen, setChosen] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [celebrating, setCelebrating] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [visible, setVisible] = useState(!document.hidden);
  const mainRef = useRef<HTMLElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const current = data.sessions.find(s => s.id === sessionId);
  const active = [...data.sessions].reverse().find(s => s.status === 'active');
  const lesson = lessons.find(l => l.id === current?.lessonId);
  const levelLessons = lessons.filter(l => lessonLevel(l.id) === level);
  const question = current && lesson ? lesson.questions[current.questionIndices[current.index]] : null;
  const completed = data.sessions.filter(s => s.status === 'complete');
  const total = summarize(data.sessions.flatMap(s => s.records));
  const review = reviewItems(data.sessions);
  const completedLessons = new Set(completed.map(s => s.lessonId));

  useEffect(() => {
    const change = () => { setVisible(!document.hidden); if (document.hidden) { stopFeedbackSound(); stopLessonAudio(); } };
    document.addEventListener('visibilitychange', change);
    const refreshVoices = () => setVoices(thaiVoices());
    refreshVoices();
    window.speechSynthesis?.addEventListener('voiceschanged', refreshVoices);
    return () => { document.removeEventListener('visibilitychange', change); window.speechSynthesis?.removeEventListener('voiceschanged', refreshVoices); stopLessonAudio(); disposeFeedbackSound(); };
  }, []);

  useEffect(() => {
    setSessionId(null); setSelectedReport(null); setPause(false); setBreakReminder(false); setConfirmReset(false);
    setConfirmStart(null); setConfirmRefresh(false); setConfirmLogout(false);
    stopLessonAudio(); setPage(p => p === 'account' || p === 'report' ? p : account.teacher && account.student ? 'report' : 'home');
  }, [store.scope]);

  useEffect(() => { if (account.recovery) setPage('account'); }, [account.recovery]);
  useEffect(() => { if (page === 'report' && !canOpenReport) setPage('account'); }, [page, canOpenReport]);

  useEffect(() => {
    setChosen(null); setFeedback(''); setAudioMessage(''); setCelebrating(false);
    stopLessonAudio();
    mainRef.current?.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [page, sessionId, current?.index]);

  useEffect(() => { if (current?.answered && page === 'exercise') nextRef.current?.focus({ preventScroll: true }); }, [current?.answered, page]);

  useEffect(() => {
    if (!celebrating) return;
    const timer = window.setTimeout(() => setCelebrating(false), 1400);
    return () => clearTimeout(timer);
  }, [celebrating]);

  useEffect(() => {
    if (!data.settings.sound || !data.settings.effectsSound) stopFeedbackSound();
    if (!data.settings.sound) stopLessonAudio();
  }, [data.settings.sound, data.settings.effectsSound]);

  useEffect(() => {
    if (!canPractice || page !== 'exercise' || pause || breakReminder || confirmLogout || confirmRefresh || confirmStart || !visible || !current || current.answered || current.status !== 'active') return;
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const elapsed = Math.min(1500, now - last); last = now;
      setData(d => ({ ...d, sessions: d.sessions.map(s => s.id === sessionId ? { ...s, currentMs: s.currentMs + elapsed } : s) }));
    }, 1000);
    return () => clearInterval(timer);
  }, [canPractice, page, pause, breakReminder, confirmLogout, confirmRefresh, confirmStart, visible, sessionId, current?.answered, current?.status]);

  useEffect(() => {
    if (canPractice && page === 'exercise' && visible && !pause && !breakReminder && !confirmLogout && !confirmRefresh && !confirmStart && breakDue(current,data.settings.breakMinutes)) {
      stopLessonAudio(); stopFeedbackSound(); setBreakReminder(true);
    }
  }, [canPractice,page,visible,pause,breakReminder,confirmLogout,confirmRefresh,confirmStart,current,data.settings.breakMinutes]);

  function acknowledgeBreak() {
    updateSession(s=>({...s,breakAcknowledgedMs:practiceElapsed(s)}));
    setBreakReminder(false);
  }
  function go(next: Page) { if (teacherReportOnly && ['home','exercise','result'].includes(next)) next='report'; setPause(false); setBreakReminder(false); setPage((!authorized && next !== 'about') || (next === 'report' && !canOpenReport) ? 'account' : next); }
  function buttonSound(event: MouseEvent<HTMLDivElement>) {
    if (!data.settings.sound || !data.settings.effectsSound) return;
    const target = event.target instanceof Element ? event.target.closest('button') : null;
    if (target && !target.disabled) playFeedbackSound('click');
  }
  function updateSession(fn: (s: Session) => Session) {
    if (!canPractice) return;
    setData(d => ({ ...d, sessions: d.sessions.map(s => s.id === sessionId ? markChanged(fn(s)) : s) }));
  }
  function start(id: number, indices?: number[], approved = false) {
    if (!canPractice) { go(canOpenReport?'report':'account'); return; }
    if (active && active.lessonId === id && !indices && !approved) { setSessionId(active.id); go('exercise'); return; }
    if (active && !approved) { setConfirmStart({ id, indices }); return; }
    const target = lessons.find(l => l.id === id)!;
    const session: Session = { id: crypto.randomUUID(), lessonId: id, contentVersion: 1, localRevision: 1, startedAt: Date.now(), status: 'active', questionIndices: indices ?? target.questions.map((_, i) => i), index: 0, records: [], wrongAttempts: 0, hintLevel: 0, currentMs: 0, answered: false };
    setData(d => ({ ...d, sessions: [...d.sessions.map(s => s.status === 'active' ? markChanged({ ...s, status: 'ended' as const, endedAt: Date.now() }) : s), session] }));
    setSessionId(session.id); setConfirmStart(null); go('exercise');
  }
  function answer(value: string) {
    if (!current || !question || current.answered || current.status !== 'active') return;
    stopLessonAudio();
    setChosen(value);
    if (value === question.letter) {
      setFeedback(answerPraise(current.wrongAttempts,current.hintLevel));
      setCelebrating(true);
      if (data.settings.sound && data.settings.effectsSound) playFeedbackSound('success');
      updateSession(s => ({ ...s, answered: true, records: [...s.records, { questionIndex: s.questionIndices[s.index], letter: question.letter, word: question.word, category: resultCategory(s.wrongAttempts, s.hintLevel), wrongAttempts: s.wrongAttempts, hintLevel: s.hintLevel, activeMs: s.currentMs, answeredAt: Date.now() }] }));
    } else {
      setFeedback('ค่อย ๆ ดู แล้วลองอีกครั้งนะ ใช้ปุ่มช่วยได้');
      updateSession(s => ({ ...s, wrongAttempts: s.wrongAttempts + 1 }));
    }
  }
  function skip() {
    if (!current || !question || current.answered) return;
    setFeedback('เก็บข้อนี้ไว้ฝึกอีกครั้งได้เสมอ');
    updateSession(s => ({ ...s, answered: true, records: [...s.records, { questionIndex: s.questionIndices[s.index], letter: question.letter, word: question.word, category: 'skipped', wrongAttempts: s.wrongAttempts, hintLevel: s.hintLevel, activeMs: s.currentMs, answeredAt: Date.now() }] }));
  }
  function next() {
    if (!current || !current.answered) return;
    if (current.index + 1 === current.questionIndices.length) {
      updateSession(s => ({ ...s, status: 'complete', endedAt: Date.now() }));
      go('result');
    } else updateSession(s => ({ ...s, index: s.index + 1, wrongAttempts: 0, hintLevel: 0, currentMs: 0, answered: false, wordDraft: undefined }));
  }
  function help() {
    if (!current || !question || current.answered) return;
    const hint = Math.min(3, current.hintLevel + 1);
    updateSession(s => ({ ...s, hintLevel: hint }));
    if (hint === 2 && data.settings.sound) playLessonAudio(question.speech, data.settings, setAudioMessage);
  }
  function retryChoice() {
    if (!canPractice || !current || current.answered) return;
    stopLessonAudio(); setAudioMessage(''); setChosen(null); setCelebrating(false);
    if (lesson?.mode==='build-word') updateSession(s=>({...s,wordDraft:undefined}));
    setFeedback('ลองเลือกใหม่ได้เลย ใช้ปุ่มช่วยได้');
    requestAnimationFrame(()=>mainRef.current?.querySelector<HTMLButtonElement>('.letter-option:not(:disabled)')?.focus({preventScroll:true}));
  }
  function exportResults() {
    const blob = new Blob([exportCsv(data.sessions, lessons, account.student)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = account.student ? `ReadTech-${account.student.code}-results.csv` : 'ReadTech-results.csv';
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function observe(id: string, field: keyof Observation, value: string) {
    setData(d => ({ ...d, sessions: d.sessions.map(s => s.id === id ? markChanged({ ...s, observation: { attention: 'ยังไม่ได้สังเกต', reading: 'ยังไม่ได้ประเมิน', note: '', ...s.observation, [field]: value } }) : s) }));
  }

  function requestLogout() {
    if (store.cloud && store.pending) setConfirmLogout(true);
    else void logout();
  }

  async function logout() {
    try { await account.signOut(); setConfirmLogout(false); }
    catch (error) { setStorageMessage((error as Error).message); }
  }
  async function refreshCloud(replaceDrafts = false) {
    try { await store.refreshCloud(replaceDrafts); setConfirmRefresh(false); }
    catch { setStorageMessage('ยังโหลดผลล่าสุดไม่ได้ ผลในเครื่องยังอยู่ กรุณาลองอีกครั้ง'); }
  }

  if (!account.configReady || (account.config && !account.authReady) || account.checking) return <div className="loading"><BookFriend/><p>กำลังตรวจบัญชีของคุณ…</p></div>;
  if (!authorized || account.recovery) return <div className="public-shell">
    <a className="skip-link" href="#main">ข้ามไปเนื้อหาหลัก</a>
    <header className="public-header"><button className="brand" onClick={()=>go('account')} aria-label="ReadTech Companion หน้าเข้าสู่ระบบ"><span className="brand-mark"><Icon name="book" size={27}/></span><span>ReadTech<small>COMPANION</small></span></button><button className="text-button" onClick={()=>go(page==='about'?'account':'about')}>{page==='about'?'กลับเข้าสู่ระบบ':'เกี่ยวกับ ReadTech'}</button></header>
    {page==='about'&&!account.recovery?<main id="main" className="public-about"><span className="eyebrow pink">READTECH COMPANION</span><h1 tabIndex={-1}>เพื่อนร่วมทางการฝึกอ่าน</h1><BookFriend/><p>ฝึกทีละคำ พัฒนาไปทีละขั้น ผ่านภาพ เสียง และกิจกรรมสั้น ๆ</p><p>ครูลงทะเบียนผู้เรียนและติดตามผล นักเรียนใช้รหัสจากครูเพื่อเข้าเรียนด้วยตัวเอง ข้อมูลและกิจกรรมส่วนตัวเปิดหลังเข้าสู่ระบบเท่านั้น</p><p>รุ่นทดลองมีแบบฝึก 12 บท: LEVEL 1 และ LEVEL 2 ครบระดับละ 5 บท และ LEVEL 3 เริ่ม 2 บท บทอื่นเป็นแผนพัฒนา คะแนนเกมแยกจากการประเมินอ่านออกเสียงโดยครู</p><button className="primary" onClick={()=>go('account')}>เข้าสู่ระบบ<Icon name="arrow"/></button></main>:<main id="main" className="login-layout">
      <section className="login-intro" aria-label="แนะนำ ReadTech"><span className="hero-tag"><Icon name="leaf" size={16}/>ทุกก้าวเล็ก ๆ มีความหมาย</span><h2>ฝึกทีละคำ<br/>พัฒนาไปทีละขั้น<br/><span>อ่านได้อย่างมั่นใจ</span></h2><p>พื้นที่ฝึกอ่านของเธอ<br/>พร้อมเรียนรู้ในจังหวะของตัวเอง</p><BookFriend className="login-friend"/><span className="login-intro-note"><Icon name="heart" size={18}/>ครูดูแล · นักเรียนฝึกด้วยตัวเอง</span></section>
      <div className="login-card"><TeacherPanel account={account} pending={0} conflicts={0} onSelect={()=>{}} onLogout={()=>void logout()} onSignedIn={role=>{setPage(role==='teacher'?'account':'home');}} syncNow={async()=>{}} refreshCloud={()=>{}} exportCsv={()=>{}}/></div>
    </main>}
    <footer className="public-footer">ฝึกทีละคำ พัฒนาไปทีละขั้น · ReadTech Companion</footer>
  </div>;

  if (!loaded) return <div className="loading"><BookFriend /><p>กำลังเตรียมพื้นที่ฝึกอ่าน…</p></div>;

  function lessonCard(l: Lesson) {
    const done = completedLessons.has(l.id);
    const inProgress = active?.lessonId === l.id;
    return <article className={'lesson-card adventure-card adventure-'+l.id+(done?' completed':'')+(inProgress?' continuing':'')} key={l.id}>
      <div className={'lesson-symbol tone-' + l.id}><span className="lesson-number" aria-hidden="true">{l.id}</span><Icon name={(l.mode==='blend'||l.mode==='change-vowel'||l.mode==='build-word')?'puzzle':l.mode==='word-picture'?'book':(l.mode==='vowel'||l.mode==='listen-word')?'sound':['letters','sound','puzzle','leaf','book'][l.id - 1]} size={28} /></div>
      <div className="lesson-card-copy"><span className="eyebrow">บทที่ {l.id} · 5 กิจกรรม</span><h3>{l.title}</h3><p>{l.description}</p>{(done||inProgress)&&<span className="lesson-state"><Icon name={inProgress?'replay':'check'} size={15}/>{inProgress?'กำลังฝึก · ไปต่อได้เลย':'ทำครบแล้ว · กลับมาฝึกได้'}</span>}</div>
      {canPractice && <button className={'lesson-action ' + (done ? 'done' : '')} onClick={() => start(l.id)} aria-label={`${inProgress ? 'ฝึกต่อ' : done ? 'ฝึกอีกครั้ง' : 'เริ่มฝึก'} ${l.title}`}><span>{inProgress ? 'ฝึกต่อ' : done ? 'ฝึกอีกครั้ง' : 'เริ่มฝึก'}</span><Icon name={done ? 'replay' : 'arrow'} /></button>}
    </article>;
  }

  return <div className={`app ${['home','lessons','rewards','exercise','result'].includes(page)?'learner-space':''} ${data.settings.largeText ? 'large-text' : ''} ${data.settings.calm ? 'calm' : ''}`} onClickCapture={buttonSound}>
    <a className="skip-link" href="#main">ข้ามไปเนื้อหาหลัก</a>
    {page !== 'exercise' && <aside className="sidebar">
      <button className="brand" onClick={() => go('home')} aria-label="ReadTech Companion หน้าหลัก"><span className="brand-mark"><Icon name="book" size={27} /></span><span>ReadTech<small>COMPANION</small></span></button>
      <div className="sidebar-line" />
      <p className="nav-label">พื้นที่ของฉัน</p>
      <nav aria-label="เมนูหลัก">{nav.map(n => <button key={n.id} className={'nav-item ' + ((page === n.id || (n.id === 'account' && page === 'report')) ? 'active' : '')} aria-current={(page === n.id || (n.id === 'account' && page === 'report')) ? 'page' : undefined} onClick={() => go(n.id)}><Icon name={n.icon} /><span>{n.id==='account'&&account.learner?'บัญชีของฉัน':n.text}</span>{(page === n.id || (n.id === 'account' && page === 'report')) && <i />}</button>)}</nav>
      <div className="sidebar-bottom"><div className="gentle-note"><Icon name="heart" /><p>ไม่ต้องรีบก็ได้<br/><strong>เติบโตในจังหวะของเรา</strong></p></div><button className="nav-item" onClick={() => go('settings')}><Icon name="settings" />ปรับการใช้งาน</button><button className="about-link" onClick={() => go('about')}>เกี่ยวกับนวัตกรรม · รุ่นทดลอง 0.1</button></div>
    </aside>}

    <div className={'workspace ' + (page === 'exercise' ? 'focused' : '')}>
      <header className="topbar">
        <div className="topbar-title">{page === 'exercise' ? <button className="text-button" onClick={() => setPause(true)}><Icon name="back" />พัก / กลับหน้าหลัก</button> : <><span className="mobile-brand">ReadTech</span><span className="desktop-kicker">ฝึกทีละคำ พัฒนาไปทีละขั้น</span></>}</div>
        <div className="topbar-right">{store.cloud ? <><button className="learner-chip" onClick={()=>go('account')}><Icon name="shield" size={16}/>{account.student!.display_name}</button><span className="local-badge">{store.syncing?'กำลังส่งผล…':store.pending?`รอส่ง ${store.pending} รอบ`:store.syncMessage?'ยังโหลดผลกลางไม่ได้':data.sessions.length?'บันทึกกลางแล้ว':'พร้อมบันทึกกลาง'}</span></> : <span className="local-badge"><Icon name="shield" size={16}/>{account.teacher?'ตัวอย่างบทเรียนครู · แยกจากผลผู้เรียน':'โหมดทดลอง · ข้อมูลอยู่ในเครื่องนี้'}</span>}<nav className="topbar-actions" aria-label="เมนูบัญชี"><button className="settings-button" aria-label="ปรับการใช้งาน" onClick={() => page === 'exercise' ? setPause(true) : go('settings')}><Icon name={page === 'exercise' ? 'pause' : 'settings'} /></button><button className="topbar-logout" onClick={requestLogout}><Icon name="lock" size={18}/><span>ออกจากระบบ</span></button></nav></div>
      </header>
      {storageMessage && <div className="storage-warning" role="alert"><Icon name="info" /><span>{storageMessage}</span><button className="text-button" onClick={exportResults}>ส่งออกผล</button></div>}
      {store.cloud && store.syncMessage && <div className="storage-warning" role="status"><Icon name="info"/><span>{store.syncMessage}</span><button className="text-button" onClick={()=>go('account')}>จัดการผล</button></div>}
      <main id="main" ref={mainRef}>
        {account.teacher && (page === 'account' || page === 'report') && <div className="teacher-area">
          <p className="teacher-area-label">สำหรับครู</p>
          <nav className="teacher-area-tabs" aria-label="เมนูสำหรับครู">
            <button className={page === 'account' ? 'active' : ''} aria-current={page === 'account' ? 'page' : undefined} onClick={()=>go('account')}><Icon name="shield" size={18}/>ผู้เรียน</button>
            <button className={page === 'report' ? 'active' : ''} aria-current={page === 'report' ? 'page' : undefined} onClick={()=>go('report')}><Icon name="chart" size={18}/>รายงานผู้เรียน</button>
          </nav>
        </div>}
        {page === 'account' && <TeacherPanel account={account} pending={store.pending} conflicts={store.conflicts} onSelect={s=>{setReportGrade('');account.selectStudent(s);setPage(account.teacher && s?'report':'home');}} onLogout={requestLogout} onSignedIn={role=>go(role==='teacher'?'account':'home')} syncNow={store.syncNow} refreshCloud={()=>store.pending?setConfirmRefresh(true):void refreshCloud()} exportCsv={exportResults}/>}
        {page === 'account' && account.learner && store.cloud && <LearnerHistory sessions={data.sessions} lessons={lessons} onContinue={id=>start(id)} onLessons={()=>go('lessons')}/>}
        {page === 'home' && <>

          <div className="page-heading"><div><span className="eyebrow pink">เพื่อนฝึกอ่านของเธอ</span><h1 tabIndex={-1}>สวัสดี นักอ่านคนเก่ง <span className="hello-spark" aria-hidden="true">✦</span></h1><p>วันนี้มาค่อย ๆ เรียนรู้ไปด้วยกันนะ</p></div><span className="pill"><span className="status-dot"/>พร้อมเริ่มต้นเสมอ</span></div>
          <section className="hero" aria-labelledby="hero-title">
            <div className="hero-copy"><span className="hero-tag"><Icon name="leaf" size={16}/>ทุกก้าวเล็ก ๆ มีความหมาย</span><h2 id="hero-title">ฝึกทีละคำ<br/>พัฒนาไปทีละขั้น<br/><span>อ่านได้อย่างมั่นใจ</span></h2><p>ดูภาพ ฟังเสียง แล้วลองด้วยตัวเอง<br/>ไม่ต้องรีบ เราฝึกซ้ำได้เสมอ</p><button className="primary" onClick={() => start(active?.lessonId ?? lessons.find(l => !completedLessons.has(l.id))?.id ?? 1)}><Icon name={active ? 'replay' : 'book'} />{active ? 'ฝึกต่อจากครั้งก่อน' : 'เริ่มฝึกวันนี้'}<Icon name="arrow" /></button><span className="hero-meta"><Icon name="clock" size={16}/>ครั้งละประมาณ 5–10 นาที · พักได้ทุกเมื่อ</span></div>
            <div className="hero-art"><span className="art-orbit"/><span className="art-letter art-letter-one" aria-hidden="true">ก</span><span className="art-letter art-letter-two" aria-hidden="true">ม</span><span className="art-star" aria-hidden="true">✦</span><BookFriend className="hero-friend"/><span className="friend-caption">ฉันจะอยู่ข้าง ๆ เธอนะ</span></div>
          </section>
          <div className="learning-rhythm" aria-label="วิธีฝึกของเรา"><span><Icon name="book"/>ดูภาพ</span><Icon name="arrow" size={18}/><span><Icon name="sound"/>ฟังเสียง</span><Icon name="arrow" size={18}/><span><Icon name="star"/>ลองด้วยตัวเอง</span></div>
          <aside className="new-lesson-link"><div><span className="eyebrow">บทใหม่ · LEVEL {lessonLevel(lessons.at(-1)!.id)}</span><strong>{lessons.at(-1)?.title}</strong></div><button className="secondary" onClick={()=>{setLevel(lessonLevel(lessons.at(-1)!.id));go('lessons');}}>ดูบทใหม่<Icon name="arrow" size={18}/></button></aside>
          <section className="stats-grid" aria-label="ความก้าวหน้าในเครื่องนี้">
            <div className="stat"><span className="stat-icon pink-bg"><Icon name="book" /></span><div><span className="stat-number">{completedLessons.size}<small> / {lessons.length} บท</small></span><span className="stat-label">กิจกรรมที่ทำครบ</span></div></div>
            <div className="stat"><span className="stat-icon gold-bg"><Icon name="star" /></span><div><span className="stat-number">{total.independent + total.retried + total.assisted}<small> ดวง</small></span><span className="stat-label">ดาวจากการทำกิจกรรม</span></div></div>
            <div className="stat"><span className="stat-icon green-bg"><Icon name="leaf" /></span><div><span className="stat-number">{completed.length}<small> ครั้ง</small></span><span className="stat-label">ฝึกครบหนึ่งช่วง</span></div></div>
          </section>
          <div className="home-columns"><section className="lesson-section"><div className="section-title"><div><span className="eyebrow">LEVEL 1</span><h2>พยัญชนะมหาสนุก</h2></div><button className="text-button" onClick={() => go('lessons')}>ดูบทเรียนทั้งหมด<Icon name="arrow" size={18}/></button></div><div className="lesson-list">{lessons.slice(0,3).map(lessonCard)}</div></section>
            <aside className="review-card"><span className="small-label"><Icon name="replay" size={18}/>ฝึกซ้ำได้เสมอ</span><h2>อีกนิดก็คล่องขึ้น</h2><p>{review.length ? 'กลับมาลองกิจกรรมที่เคยใช้ตัวช่วย หรืออยากฝึกอีกครั้ง' : 'ยังไม่มีข้อที่ต้องทบทวน ลองเริ่มบทเรียนแรกกันนะ'}</p><div className="review-letters">{(review.length ? review.slice(0,3).map(r=>r.letter) : ['ก','ม','ป']).map((letter,i)=><span key={i}>{vowelName(letter)}</span>)}</div><button className="secondary" onClick={() => review.length ? start(review[0].lessonId, review.filter(r=>r.lessonId===review[0].lessonId).map(r=>r.questionIndex)) : start(1)}>{review.length ? 'ลองกิจกรรมเดิมอีกครั้ง' : 'รู้จักตัวอักษรกัน'}<Icon name="arrow" size={18}/></button><div className="small-divider"/><p className="gentle-tip"><Icon name="help" size={19}/>ใช้ปุ่มช่วยได้ ไม่เสียดาว</p></aside>
          </div>
        </>}

        {page === 'lessons' && <>
          <div className="page-heading"><div><span className="eyebrow pink">เรียนรู้ในจังหวะของเรา</span><h1 tabIndex={-1}>บทเรียนของฉัน</h1><p>{teacherReportOnly?'ครูดูรายการบทเรียนได้ นักเรียนทำแบบฝึกผ่านบัญชีของตนเอง':'เลือกบทที่อยากฝึก หรือกลับมาทบทวนได้เสมอ'}</p></div></div>
          <div className="level-tabs" role="tablist" aria-label="ระดับบทเรียน">{curriculum.levels.map(l=><button role="tab" aria-selected={level===l.id} aria-controls="level-panel" id={`level-tab-${l.id}`} key={l.id} onClick={()=>setLevel(l.id)} className={level===l.id?'selected':''}>LEVEL {l.id}<span>{lessons.some(lesson=>lessonLevel(lesson.id)===l.id)?'พร้อมฝึก':'แผนบทเรียน'}</span></button>)}</div>
          <section className="level-panel" id="level-panel" role="tabpanel" aria-labelledby={`level-tab-${level}`}>
            <div className="section-title"><div><span className="eyebrow">LEVEL {level}</span><h2>{curriculum.levels[level-1].title}</h2><p>{curriculum.levels[level-1].subtitle}</p></div><span className="pill">{levelLessons.length?`${levelLessons.length} บทเรียนพร้อมทดลอง`:'กำลังเตรียมเนื้อหา'}</span></div>
            {levelLessons.length>0 && <div className="lesson-list">{levelLessons.map(lessonCard)}</div>}
            {levelLessons.length<5 && <><p className="notice planned-notice">{levelLessons.length?'บทอื่นในระดับนี้ยังอยู่ระหว่างเตรียมเนื้อหา':'ระดับนี้เป็นแผนการพัฒนา ยังไม่มีแบบฝึกให้ใช้งาน และยังไม่ใช่บทเรียนที่ผ่านการตรวจเนื้อหา'}</p>{curriculum.levels[level-1].lessons.map((title,i)=>({title,id:(level-1)*5+i+1})).filter(l=>!lessons.some(ready=>ready.id===l.id)).map(l=><div key={l.id} className="planned-lesson"><span className="planned-number">{l.id}</span><div><h3>{l.title}</h3><p>อยู่ระหว่างเตรียมกิจกรรม</p></div><Icon name="clock"/></div>)}</>}
          </section>
        </>}

        {page === 'exercise' && canPractice && current && lesson && question && <div className="exercise-wrap">
          <div className="exercise-heading"><div><span className="eyebrow pink">บทที่ {lesson.id} · {curriculum.levels[lessonLevel(lesson.id)-1].title}</span><h1 tabIndex={-1}>{lesson.title}</h1></div><span className="pill">ข้อ {current.index+1} จาก {current.questionIndices.length}</span></div>
          <div className="progress-track" role="progressbar" aria-label="กิจกรรมที่ทำแล้ว" aria-valuemin={0} aria-valuemax={current.questionIndices.length} aria-valuenow={current.index + Number(current.answered)}><span style={{width: `${(current.index + Number(current.answered))/current.questionIndices.length*100}%`}}/></div>
          <div className="question-steps" aria-hidden="true">{current.questionIndices.map((_,i)=><span key={i} className={i<current.index || (i===current.index&&current.answered)?'step-done':i===current.index?'step-now':''}>{i<current.index || (i===current.index&&current.answered)?<Icon name="check" size={18}/>:i+1}</span>)}</div>
          <section className="exercise-card">
            <h2 className="instruction">{question.prompt ?? (lesson.mode === 'listen' ? 'ฟัง แล้วแตะตัวอักษร' : lesson.mode === 'initial' ? 'ภาพนี้ขึ้นต้นด้วยตัวอะไร?' : lesson.mode === 'match' ? 'แตะตัวอักษร แล้วแตะช่องจับคู่' : 'เลือกตัวอักษรที่เหมือนตัวอย่าง')}</h2>
            <div className="exercise-toolbar exercise-support" role="group" aria-label="ฟังและขอความช่วยเหลือ">
              <button className="audio-button" aria-label={question.promptSpeech?'ฟังคำถาม':lesson.mode==='initial'?'ฟังชื่อภาพ':'ฟังตัวอย่าง'} disabled={!data.settings.sound} onClick={()=>playLessonAudio(question.promptSpeech ?? question.speech,data.settings,setAudioMessage)}><Icon name="sound"/><span>ฟัง</span></button>
              <button className="secondary" aria-label={current.hintLevel===3?'ดูตัวอย่างอีกครั้ง':'ช่วยทีละนิด'} disabled={current.answered} onClick={help}><Icon name="help"/><span>{current.hintLevel===3?'ดูตัวอย่าง':'ช่วย'}</span></button>
            </div>
            <span className="audio-status exercise-audio-status" role="status">{!data.settings.sound?'ปิดเสียงอยู่ เปิดได้ในหน้าปรับการใช้งาน':audioMessage || 'ฟังซ้ำได้ตามต้องการ'}</span>
            <div className={'question-visual ' + (lesson.mode==='shape'?'shape-only':'')}>
              {(lesson.mode==='blend'||lesson.mode==='change-vowel') ? <BlendVisual question={question} revealed={current.hintLevel===3 || current.answered}/> : lesson.mode==='vowel' ? <VowelVisual question={question}/> : (lesson.mode==='listen'||lesson.mode==='listen-word') && current.hintLevel===0 ? <div className="listen-orb"><Icon name="sound" size={70}/><span>พร้อมแล้ว กดฟังเลย</span></div> : <>
                {lesson.mode !== 'shape' && <Illustration kind={question.art} label={question.word} className="question-art"/>}
                {lesson.mode !== 'initial' && lesson.mode !== 'listen' && lesson.mode !== 'listen-word' && lesson.mode !== 'word-picture' && lesson.mode !== 'build-word' && <div className="target-letter" aria-label={`ตัวอย่าง ${question.letter}`}>{question.letter}</div>}
              </>}
            </div>
            {current.hintLevel>0 && <div className="hint-box" role="status"><span className="hint-title"><Icon name="help" size={18}/>ตัวช่วย {current.hintLevel}/3</span><p>{current.hintLevel===1 ? ((lesson.mode==='listen-word'||lesson.mode==='word-picture'||lesson.mode==='build-word') ? 'ดูภาพ แล้วลองนึกถึงเสียงของคำนี้นะ' : question.blend ? `ดู ${question.blend.consonant} แล้ววางสระ ${vowelName(question.blend.vowel)}${question.blend.vowel==='า'?'ด้านขวา':question.blend.vowel==='ี'?'ด้านบน':'ด้านล่าง'}` : question.vowelClue ?? `ภาพนี้คือ ${question.word} ค่อย ๆ ดูรูปตัวอักษรนะ`) : current.hintLevel===2 ? ((lesson.mode==='listen-word'||lesson.mode==='word-picture'||lesson.mode==='build-word') ? 'กดฟังซ้ำ แล้วลองเลือกคำที่ได้ยินนะ' : `ฟังอีกครั้ง: ${question.speech}`) : <>ดูตัวอย่าง: <strong className="hint-letter">{lesson.mode==='vowel'?vowelName(question.letter):question.letter}</strong> — {question.speech} แล้วลองเลือกด้วยตัวเอง</>}</p></div>}
            {lesson.mode==='build-word' ? <WordBuilder question={question} draft={current.wordDraft ?? {consonant:'',vowel:''}} locked={current.answered || (chosen!==null && current.wrongAttempts>0)} onChange={draft=>updateSession(s=>({...s,wordDraft:draft}))} onCheck={answer}/> : <div className={'options ' + ((['blend','listen-word','change-vowel','word-picture'].includes(lesson.mode))?'blend-options ':lesson.mode==='vowel'?'vowel-options ':'') + (question.options.length===2?'two-options':'')} aria-label="ตัวเลือก">{orderedOptions(question.options, current.id+':'+current.index).map((value:string)=><button className={'letter-option ' + (chosen===value?'picked ':'') + (current.answered && chosen===value?'correct ':'')} key={value} disabled={current.answered} aria-pressed={chosen===value} aria-label={lesson.mode==='vowel'?`เลือกสระ ${vowelName(value)}`:`เลือก ${value}`} onClick={()=>lesson.mode==='match'?setChosen(value):answer(value)}>{lesson.mode==='vowel'?<VowelGlyph value={value}/>:value}</button>)}</div>}
            {(lesson.mode==='vowel' || lesson.mode==='blend' || lesson.mode==='change-vowel'||lesson.mode==='build-word') && <p className="vowel-carrier-note">ใช้ตัว อ รองสระ เพื่อให้เห็นตำแหน่งชัดเจน</p>}
            {lesson.mode==='match' && <button className={'match-slot ' + (current.answered?'matched':'')} disabled={!chosen || current.answered} onClick={()=>chosen && answer(chosen)} aria-label="วางตัวอักษรที่เลือกลงช่องจับคู่">{chosen ?? <Icon name="puzzle"/>}<span>{current.answered?'จับคู่แล้ว':'แตะที่นี่เพื่อจับคู่'}</span></button>}
            <div className="feedback-wrap">{celebrating && <AnswerStars/>}<div className={'feedback ' + (current.answered?'success':'')} role="status" aria-live="polite">{current.answered && <Icon name={current.records.at(-1)?.category==='skipped'?'leaf':'check'}/>}<span>{feedback || (current.answered ? current.records.at(-1)?.category==='skipped'?'เก็บข้อนี้ไว้ฝึกอีกครั้ง':'ทำกิจกรรมข้อนี้แล้ว ไปต่อได้เลย' : 'ลองด้วยตัวเอง หรือใช้ปุ่มช่วยได้')}</span></div></div>
            {(current.answered || (current.wrongAttempts>0 && chosen!==null)) && <div className="exercise-toolbar exercise-response" role="group" aria-label="ปุ่มทำกิจกรรมต่อ">
              {current.answered && <button ref={nextRef} className="primary next-button" aria-label={current.index+1===current.questionIndices.length?'ดูรางวัลของฉัน':'ข้อต่อไป'} onClick={next}><span>{current.index+1===current.questionIndices.length?'ดูรางวัล':'ต่อไป'}</span><Icon name="arrow"/></button>}
              {!current.answered && current.wrongAttempts>0 && chosen!==null && <button className="secondary retry-choice" onClick={retryChoice}><Icon name="replay"/><span>ลองใหม่</span></button>}
            </div>}
            <div className="exercise-bottom-actions">{!current.answered && <button className="text-button" onClick={skip}>ฝึกข้อนี้ภายหลัง</button>}<button className="text-button exercise-home" onClick={()=>go('home')}><Icon name="home" size={18}/><span>กลับหน้าแรก</span></button></div>
          </section>
          <p className="exercise-footer"><Icon name="heart" size={17}/>ไม่มีการจับเวลาแข่งขัน · พักได้ทุกเมื่อ</p>
        </div>}

        {page === 'result' && canPractice && current && lesson && <section className="result-card"><div className="result-friend"><BookFriend/><span className="reward-medal"><Icon name="star" size={40}/></span></div><span className="eyebrow pink">ขอบคุณที่ตั้งใจฝึก</span><h1 tabIndex={-1}>ทำกิจกรรมครบแล้ว!</h1><p>{lesson.title}</p><div className="result-stars" aria-hidden="true">{'★'.repeat(current.records.filter(r=>r.category!=='skipped').length)}</div><div className="result-summary"><strong>{current.records.filter(r=>r.category!=='skipped').length} ดาว</strong><span>จากกิจกรรมที่ทำได้ในรอบนี้</span></div><div className="result-earned"><p><Icon name="coin" size={18}/>สะสมเหรียญภารกิจ {practiceRewards(data.sessions,lessons).coins} เหรียญ</p>{practiceRewards([current],lessons).trophies.some(t=>t.id===lesson.id&&t.earned)&&<p><Icon name="trophy" size={18}/>เก็บถ้วยประจำบทนี้แล้ว · บทละ 1 ใบ</p>}</div><p>ทุกครั้งที่ลอง คือก้าวเล็ก ๆ ที่สำคัญ<br/>อยากพัก หรือกลับมาฝึกอีกครั้งก็ได้</p><div className="result-actions"><button className="primary" onClick={()=>go('home')}><Icon name="home"/>กลับหน้าหลัก</button><button className="secondary" onClick={()=>start(lesson.id)}>ฝึกอีกครั้ง<Icon name="replay"/></button></div><button className="text-button result-rewards-link" onClick={()=>go('rewards')}>ดูรางวัลที่สะสม<Icon name="arrow" size={18}/></button><p className="fine-print">ดาวแสดงการทำกิจกรรม ไม่ใช่ผลประเมินการอ่านออกเสียง</p></section>}

        {page === 'rewards' && <>
          <div className="page-heading"><div><span className="eyebrow pink">เก็บความภูมิใจไว้ด้วยกัน</span><h1 tabIndex={-1}>รางวัลของฉัน</h1><p>ไม่มีการหักดาว และไม่ต้องแข่งกับใคร</p></div></div>
          <RewardsPanel sessions={data.sessions} lessons={lessons}/>
        </>}

        {page === 'report' && canOpenReport && <>
          <ReportStudentPicker students={account.students} selected={account.student} grade={reportGrade} onGrade={setReportGrade} onSelect={account.selectStudent}/>
          {!canReport && <><div className="page-heading"><div><h1 tabIndex={-1}>รายงานผู้เรียน</h1><p>เลือกผู้เรียนเพื่อดูความก้าวหน้าและผลการฝึก</p></div></div><section className="empty-state"><Icon name="chart" size={48}/><h2>{account.students.length ? 'เลือกผู้เรียนที่ต้องการดูรายงาน' : 'ยังไม่มีผู้เรียนในความดูแล'}</h2><p>{account.students.length ? 'เลือกรายชื่อด้านบน แล้วรายงานของคนนั้นจะแสดงที่นี่' : 'เพิ่มผู้เรียนก่อน เมื่อเริ่มฝึก ผลจะปรากฏในหน้านี้'}</p>{!account.students.length && <button className="primary" onClick={()=>go('account')}>เพิ่มผู้เรียน<Icon name="arrow"/></button>}</section></>}
        </>}
        {page === 'report' && canReport && <>
          <div className="page-heading"><div><span className="eyebrow pink">ติดตามกิจกรรม ไม่ตัดสินผู้เรียน</span><h1 tabIndex={-1}>รายงานผู้เรียน</h1><p>{store.cloud?`ติดตามความก้าวหน้าของ ${account.student!.display_name}`:'ผลจากการทดลองบนเครื่องนี้'}</p></div><button className="secondary" disabled={!data.sessions.some(s=>s.records.length)} onClick={exportResults}><Icon name="download"/>ส่งออก CSV</button></div>
          <ReadingAssessmentPanel key={account.student!.id} client={account.client!} student={account.student!} teacherId={account.teacher!.id}/>
          <PrePostPanel key={'prepost-'+account.student!.id} client={account.client!} student={account.student!} teacherId={account.teacher!.id}/>
          <div className="notice"><Icon name="shield"/><div><strong>{store.cloud?`รายงานของ ${account.student!.display_name} · ${account.student!.code}`:'โหมดทดลอง · ผลเฉพาะในเครื่องนี้'}</strong><p>{store.cloud?'ผลฝึกมาจากบัญชีนักเรียน ครูดูรายงานและบันทึกข้อสังเกตได้':'ใช้เมนูสำหรับครูเพื่อเข้าสู่ระบบครูและเลือกผู้เรียน หากทดลองโดยไม่เชื่อมฐานข้อมูล ผลจะอยู่ในเบราว์เซอร์นี้'} คะแนนกิจกรรมแยกจากการประเมินอ่านออกเสียงของครู</p></div></div>
          <div className="report-stats">{[{label:'ทำได้เองครั้งแรก',value:total.independent},{label:'ทำได้หลังลองใหม่',value:total.retried},{label:'ทำได้หลังช่วย',value:total.assisted},{label:'เก็บไว้ฝึกภายหลัง',value:total.skipped}].map(x=><div className="report-stat" key={x.label}><strong>{x.value}<small> ข้อ</small></strong><span>{x.label}</span></div>)}</div>
          <p className="fine-print">จากกิจกรรมที่บันทึก {total.total} ข้อ · ทำได้เองครั้งแรก {percent(total.independent,total.total)}% · ไม่รวมข้อที่ยังไม่ได้ทำในรอบที่ค้างอยู่</p>
          {!data.sessions.length ? <section className="empty-state"><Icon name="chart" size={48}/><h2>ยังไม่มีผลการฝึก</h2><p>เมื่อทำกิจกรรม ผลจะปรากฏที่นี่</p><p>ให้นักเรียนเข้าสู่ระบบด้วยบัญชีของตนเองเพื่อเริ่มฝึก</p></section> : <>
            <div className="report-table-wrap"><table><caption>{store.cloud?`รอบการฝึกของ ${account.student!.display_name}`:'รอบการฝึกในเครื่องนี้'}</caption><thead><tr><th>บทเรียน / วันที่</th><th>ทำแล้ว</th><th>เองครั้งแรก</th><th>หลังลองใหม่</th><th>หลังช่วย</th><th>สถานะ</th><th>รายละเอียด</th></tr></thead><tbody>{[...data.sessions].reverse().map(s=>{const counts=summarize(s.records);return <tr key={s.id}><td><strong>{lessons.find(l=>l.id===s.lessonId)?.title}</strong><small>{new Date(s.startedAt).toLocaleString('th-TH',{dateStyle:'short',timeStyle:'short'})}</small></td><td>{s.records.length}/{s.questionIndices.length}</td><td>{counts.independent}</td><td>{counts.retried}</td><td>{counts.assisted}</td><td><span className="table-pill">{s.status==='complete'?'ครบกิจกรรม':s.status==='active'?'ฝึกต่อได้':'จบรอบก่อนครบ'}</span></td><td><button className="text-button" onClick={()=>setSelectedReport(selectedReport===s.id?null:s.id)} aria-expanded={selectedReport===s.id}>ดูผล<Icon name="arrow" size={16}/></button></td></tr>})}</tbody></table></div>
            {selectedReport && (()=>{const s=data.sessions.find(x=>x.id===selectedReport)!; return <section className="report-detail"><h2>รายละเอียด: {lessons.find(l=>l.id===s.lessonId)?.title}</h2><p className="fine-print">เวลาที่ทำกิจกรรมประมาณ {Math.round(s.records.reduce((a,r)=>a+r.activeMs,0)/1000)} วินาที ไม่รวมช่วงพักและซ่อนหน้าเว็บ</p><div className="word-results">{s.records.map((r,i)=><div key={i}><strong>{r.letter===r.word?r.word:`${vowelName(r.letter)} · ${r.word}`}</strong><span>{{independent:'ทำได้เองครั้งแรก',retried:'ทำได้หลังลองใหม่',assisted:'ทำได้หลังช่วย',skipped:'เก็บไว้ฝึกภายหลัง'}[r.category]}</span><small>ตัวช่วย {r.hintLevel}/3 · ลองไม่ตรง {r.wrongAttempts} ครั้ง</small></div>)}</div><h3>บันทึกจากการสังเกตของครู</h3><div className="observation-grid"><label>ระดับสมาธิ<select value={s.observation?.attention??'ยังไม่ได้สังเกต'} onChange={e=>observe(s.id,'attention',e.target.value)}>{['ยังไม่ได้สังเกต','จดจ่อได้ด้วยตนเอง','ต้องเตือนเป็นบางครั้ง','ต้องช่วยกำกับต่อเนื่อง'].map(x=><option key={x}>{x}</option>)}</select></label><label>การอ่านออกเสียง (ประเมินแยกจากเกม)<select value={s.observation?.reading??'ยังไม่ได้ประเมิน'} onChange={e=>observe(s.id,'reading',e.target.value)}>{['ยังไม่ได้ประเมิน','อ่านตัวอย่างที่ครูกำหนดได้เอง','อ่านตัวอย่างได้หลังช่วย','ควรฝึกการอ่านเพิ่มเติม'].map(x=><option key={x}>{x}</option>)}</select></label></div><label className="note-label">ข้อสังเกต (ไม่ใส่ชื่อจริงหรือข้อมูลสุขภาพ)<textarea maxLength={500} value={s.observation?.note??''} onChange={e=>observe(s.id,'note',e.target.value)} placeholder="ระบุคำที่ครูให้ลองอ่าน และสิ่งที่สังเกตได้"/></label></section>})()}
          </>}
        </>}

        {page === 'settings' && <>
          <div className="page-heading"><div><span className="eyebrow pink">ปรับให้สบายสำหรับเรา</span><h1 tabIndex={-1}>ปรับการใช้งาน</h1><p>ผู้ดูแลช่วยเลือกการตั้งค่าที่เหมาะกับผู้เรียนได้</p></div></div>
          <section className="settings-panel">{[{key:'largeText',title:'ตัวหนังสือใหญ่ขึ้น',detail:'ขยายคำสั่งและข้อความประกอบ'},{key:'sound',title:'เปิดเสียง',detail:'เปิดเสียงตัวอย่าง เสียงปุ่ม และเสียงฉลอง ไม่มีการบันทึกไมโครโฟน'},{key:'effectsSound',title:'เสียงปุ่มและเสียงฉลอง',detail:'เสียงสั้นเมื่อกดปุ่ม และทำนองนุ่ม ๆ เมื่อตอบถูก ปิดแยกจากเสียงอ่านได้'},{key:'recordedFirst',title:'ใช้ไฟล์เสียงบทเรียนก่อน',detail:'ใช้ไฟล์ที่ครูตรวจแล้วเมื่อมี ถ้าไม่มีจะใช้เสียงภาษาไทยในเครื่อง'},{key:'calm',title:'โหมดสงบ',detail:'ลดการเคลื่อนไหว ดาวจะแสดงแบบนิ่ง ปิดโหมดนี้เพื่อให้ดาวเด้ง'}].map(x=><label key={x.key} className="setting-row"><span><strong>{x.title}</strong><small>{x.detail}</small></span><input type="checkbox" checked={Boolean(data.settings[x.key as keyof typeof data.settings])} onChange={e=>setData(d=>({...d,settings:{...d.settings,[x.key]:e.target.checked}}))}/></label>)}</section>
          <section className="settings-panel"><h2>พักระหว่างฝึก</h2><label className="setting-row"><span><strong>เตือนพักเมื่อฝึกครบ</strong><small>นับเฉพาะเวลาฝึก ไม่รวมช่วงพักหรือซ่อนหน้าเว็บ เลือกฝึกต่อได้โดยไม่จบรอบ</small></span><select aria-label="ช่วงเวลาเตือนพัก" value={data.settings.breakMinutes} onChange={e=>setData(d=>({...d,settings:{...d.settings,breakMinutes:Number(e.target.value) as 0|5|10}}))}><option value={5}>5 นาที</option><option value={10}>10 นาที</option><option value={0}>ไม่เตือน</option></select></label></section>
          <section className="settings-panel voice-panel"><h2>เสียงฝึกอ่าน</h2><p>{recordingCount()>0?`มีไฟล์เสียงบทเรียน ${recordingCount()} รายการ`:'ยังไม่ได้เพิ่มไฟล์เสียงครู ขณะนี้ใช้เสียงภาษาไทยที่มีในอุปกรณ์'} ควรฟังและตรวจการออกเสียงก่อนใช้สอน</p><div className="voice-controls"><label htmlFor="thai-voice">เลือกเสียงภาษาไทย<select id="thai-voice" disabled={!voices.length} value={voices.some(v=>v.voiceURI===data.settings.voiceURI)?data.settings.voiceURI:''} onChange={e=>setData(d=>({...d,settings:{...d.settings,voiceURI:e.target.value}}))}><option value="">{voices.length?`อัตโนมัติ · ${preferredThaiVoice(voices)?.name}`:'เครื่องนี้ไม่มีเสียงภาษาไทย'}</option>{voices.map(v=><option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>)}</select></label><label htmlFor="speech-rate">ความเร็วเสียงอ่าน · {data.settings.speechRate.toFixed(2)} เท่า<input id="speech-rate" type="range" min="0.65" max="1.10" step="0.05" value={data.settings.speechRate} aria-valuetext={`${data.settings.speechRate.toFixed(2)} เท่า`} onChange={e=>setData(d=>({...d,settings:{...d.settings,speechRate:Number(e.target.value)}}))}/><small>ปรับให้ชัดและมีเวลาฟัง ไม่จำเป็นต้องช้าที่สุด</small></label></div><button className="audio-button" disabled={!data.settings.sound} onClick={()=>playLessonAudio('กอ ไก่',data.settings,setAudioMessage)}><Icon name="sound"/>ทดลองฟัง กอ ไก่</button><span className="audio-status" role="status">{audioMessage || 'อัตโนมัติเลือกเปรมวดีเมื่อเครื่องนี้มีเสียงนี้ ปรับความเร็วให้ฟังเข้าใจได้'}</span></section>
          <section className="settings-panel"><h2>{account.learner?'ข้อมูลของฉัน':store.cloud?'ข้อมูลของผู้เรียนที่เลือก':'ข้อมูลในเครื่องนี้'}</h2><p>{account.learner?'ผลฝึกแยกเป็นของเธอ และเก็บสำเนาในเครื่องไว้ระหว่างรอส่ง ก่อนเปลี่ยนเครื่องให้ตรวจว่าส่งผลครบแล้ว':store.cloud?'ผลถูกส่งไปฐานข้อมูล Supabase ที่ผู้ดูแลตั้งค่า และเก็บสำเนาในเครื่องระหว่างฝึก เปลี่ยนผู้เรียนได้จากหน้าผู้เรียนโดยเก็บผลแต่ละคนแยกกัน':'โหมดทดลองเก็บผลเฉพาะในเครื่อง และอาจหายเมื่อล้างข้อมูลเบราว์เซอร์ กรุณาส่งออกผลก่อนเปลี่ยนเครื่องหรือผู้เรียน'}</p><div className="setting-actions"><button className="secondary" onClick={exportResults}><Icon name="download"/>ส่งออกผล</button>{store.cloud?<button className="text-button" onClick={()=>go('account')}>{account.learner?'บัญชีของฉัน':'เลือกผู้เรียนคนอื่น'}</button>:<button className="text-button danger" onClick={()=>setConfirmReset(true)}>ล้างผลเพื่อเปลี่ยนผู้เรียน</button>}</div></section>
        </>}

        {page === 'about' && <section className="about-panel"><span className="eyebrow pink">READTECH COMPANION · 0.1.0</span><h1 tabIndex={-1}>เพื่อนร่วมทางการฝึกอ่าน</h1><p className="about-full-title">ReadTech Companion นวัตกรรมแอปพลิเคชันช่วยฝึกอ่านและประมวลผลคำสำหรับเด็กที่มีความบกพร่องทางการเรียนรู้</p><BookFriend/><h2>สั้น · ง่าย · ซ้ำ · สนุก · เห็นผล</h2><p>ฝึกทีละคำ พัฒนาไปทีละขั้น อ่านได้อย่างมั่นใจ</p><div className="notice"><div><strong>ขอบเขตรุ่นทดลอง</strong><p>พร้อมทดลอง 12 บทเรียน: LEVEL 1 รู้จักพยัญชนะ 5 บท LEVEL 2 พยัญชนะกับสระ 5 บท และ LEVEL 3 ประสมคำง่ายและเติมส่วนที่หาย 2 บท มีบัญชีครูและโปรไฟล์ผู้เรียนเมื่อเชื่อม Supabase อีก 18 บทเป็นแผนพัฒนา มีแบบบันทึก Pre-test/Post-test โดยครู ยังไม่มีข้อสอบอัตโนมัติ การประเมินเสียงอัตโนมัติ หรือการบันทึกเสียงนักเรียน</p><p>ใช้ไฟล์เสียงบทเรียนที่เพิ่มไว้ และเสียงสังเคราะห์จากอุปกรณ์สำหรับคำที่ยังไม่มีไฟล์ ครูควรตรวจภาพ คำ และเสียงบนเครื่องจริงก่อนใช้กับเด็ก เครื่องที่ไม่มีเสียงไทยใช้ปุ่มช่วยและผู้ดูแลอ่านให้ฟังแทนได้</p><p>ยังไม่ใช่เครื่องมือวินิจฉัยหรือระบบที่รับรองผลการเรียนรู้ ต้องทดลองและปรับตามผู้เรียนแต่ละคน</p></div></div><button className="primary" onClick={()=>go('home')}>กลับหน้าหลัก<Icon name="arrow"/></button></section>}
      </main>
      {page!=='exercise' && <footer className="app-footer"><span><Icon name="heart" size={14}/>เรียนรู้ด้วยความเข้าใจ ในจังหวะของตัวเอง</span><button onClick={()=>go('about')}>ReadTech Companion · รุ่นทดลอง</button></footer>}
    </div>
    {page!=='exercise' && <nav className="mobile-nav" aria-label="เมนูหลักบนมือถือ">{nav.map(n=><button key={n.id} className={(page===n.id || (n.id==='account' && page==='report'))?'active':''} aria-current={(page===n.id || (n.id==='account' && page==='report'))?'page':undefined} onClick={()=>go(n.id)}><Icon name={n.icon}/><span>{n.id==='account'&&account.learner?'บัญชีของฉัน':n.text}</span></button>)}</nav>}
    {breakReminder && <Modal title="พักสายตาสักนิดไหม?" onClose={acknowledgeBreak}><BookFriend className="pause-friend"/><p>ฝึกมาอีก {data.settings.breakMinutes} นาทีแล้ว<br/>ยืดตัวหรือพักสักนิด แล้วกลับมาฝึกต่อได้</p><div className="dialog-actions"><button className="primary" onClick={acknowledgeBreak}>ฝึกต่อ<Icon name="arrow"/></button><button className="secondary" onClick={()=>{acknowledgeBreak();go('home');}}><Icon name="home"/>พักก่อน</button></div></Modal>}
    {pause && <Modal title="พักสักนิดก็ได้" onClose={()=>setPause(false)}><BookFriend className="pause-friend"/><p>เก็บกิจกรรมที่ทำไว้แล้ว<br/>กลับมาฝึกต่อจากเดิมได้เสมอ</p><div className="dialog-actions"><button className="primary" onClick={()=>setPause(false)}>ฝึกต่อ<Icon name="arrow"/></button><button className="secondary" onClick={()=>go('home')}><Icon name="home"/>กลับหน้าหลัก</button></div></Modal>}
    {confirmStart && <Modal title="เริ่มรอบใหม่ไหม?" onClose={()=>setConfirmStart(null)}><p>ผลที่ทำในรอบเดิมยังอยู่ในรายงาน แต่รอบเดิมจะจบก่อนครบ และจะเริ่มบทที่เลือกจากข้อแรก</p><div className="dialog-actions"><button className="primary" onClick={()=>start(confirmStart.id,confirmStart.indices,true)}>เริ่มรอบใหม่</button><button className="secondary" onClick={()=>setConfirmStart(null)}>ยังไม่เริ่ม</button></div></Modal>}
    {confirmReset && <Modal title="ล้างผลในเครื่องนี้?" onClose={()=>setConfirmReset(false)}><p>ผลการฝึก รางวัล และข้อสังเกตของครูจะถูกล้าง กู้คืนในแอปไม่ได้ กรุณาส่งออก CSV ก่อนล้างผล</p><div className="dialog-actions"><button className="secondary" onClick={exportResults}><Icon name="download"/>ส่งออกก่อน</button><button className="primary" onClick={()=>{setData(d=>({...d,sessions:[]}));setSessionId(null);setSelectedReport(null);setConfirmReset(false);go('home');}}>ยืนยันล้างผล</button><button className="text-button" onClick={()=>setConfirmReset(false)}>ยกเลิก</button></div></Modal>}
    {confirmLogout && <Modal title="ยังมีผลในเครื่องรอส่ง" onClose={()=>setConfirmLogout(false)}><p>มี {store.pending} รอบที่ยังส่งไม่สำเร็จ การออกจากระบบจะล้างสำเนาของบัญชีนี้ในเครื่อง กรุณาส่งออก CSV ก่อน หรือกลับไปส่งผลให้ครบ ผลที่ส่งกลางแล้วจะยังอยู่</p><div className="dialog-actions"><button className="secondary" onClick={exportResults}>ส่งออก CSV ก่อน</button><button className="primary" onClick={()=>void logout()}>ยืนยันออกจากระบบ</button><button className="text-button" onClick={()=>setConfirmLogout(false)}>กลับไปส่งผล</button></div></Modal>}
    {confirmRefresh && <Modal title="ใช้ผลล่าสุดจากฐานข้อมูล?" onClose={()=>setConfirmRefresh(false)}><p>ผลที่รอส่งในเครื่องนี้จะถูกแทนด้วยผลกลาง กรุณาส่งออก CSV เก็บฉบับในเครื่องก่อน หากต้องการเก็บทั้งสองฉบับให้ยกเลิก</p><div className="dialog-actions"><button className="secondary" onClick={exportResults}>ส่งออก CSV ก่อน</button><button className="primary" disabled={store.syncing} onClick={()=>void refreshCloud(true)}>ยืนยันใช้ผลกลาง</button><button className="text-button" onClick={()=>setConfirmRefresh(false)}>ยกเลิก</button></div></Modal>}
  </div>;
}
