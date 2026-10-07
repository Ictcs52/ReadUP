const dayFormatter = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'});
export function thaiPracticeDay(timestamp) {
  if (!Number.isFinite(timestamp)) return null;
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = Object.fromEntries(dayFormatter.formatToParts(date).map(p=>[p.type,p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
const ordinal = day => Math.floor(Date.parse(day+'T00:00:00Z')/86400000);

/** @param {import('./types').Session[]} sessions
 * @param {import('./types').Lesson[]} lessons
 */
export function practiceRewards(sessions,lessons,now=Date.now()) {
  // Cloud/local copies and retries must not multiply rewards for the same round.
  const rounds = [...new Map(sessions.map(s=>[s.id,s])).values()];
  const today=thaiPracticeDay(now),todayNumber=ordinal(today);
  const days=new Set();let answers=0;let legacyDays=false;
  for (const s of rounds) for (const record of s.records) {
    if (!['independent','retried','assisted'].includes(record.category)) continue;
    answers++;
    const recorded = Number.isFinite(record.answeredAt);
    const timestamp = recorded ? record.answeredAt : s.endedAt ?? s.startedAt;
    const day=thaiPracticeDay(timestamp);
    if (day && ordinal(day)<=todayNumber) { days.add(day);if(!recorded)legacyDays=true; }
  }
  const dayNumbers=[...days].map(ordinal).sort((a,b)=>a-b);
  let best=0,run=0,previous=-Infinity;
  for (const day of dayNumbers) {run=day===previous+1?run+1:1;best=Math.max(best,run);previous=day;}
  let current=0,cursor=days.has(today)?todayNumber:todayNumber-1;
  const seen=new Set(dayNumbers);while(seen.has(cursor)){current++;cursor--;}
  const finished=rounds.filter(s=>{
    const lesson=lessons.find(l=>l.id===s.lessonId);
    if (!lesson || s.status!=='complete' || s.questionIndices.length!==lesson.questions.length) return false;
    const indices=new Set(s.questionIndices);
    if(indices.size!==lesson.questions.length || lesson.questions.some((_,i)=>!indices.has(i)))return false;
    // A review subset or skipped item does not count as completing all activities.
    return lesson.questions.every((_,i)=>s.records.some(r=>r.questionIndex===i&&['independent','retried','assisted'].includes(r.category)));
  });
  const trophies=lessons.map(lesson=>({id:lesson.id,title:lesson.title,earned:finished.some(s=>s.lessonId===lesson.id)}));
  const count=trophies.filter(t=>t.earned).length;
  const repeat=finished.some(s=>finished.filter(t=>t.lessonId===s.lessonId).length>=2);
  const missions=[
    {id:'first',name:'ก้าวแรกของฉัน',detail:'ทำกิจกรรมได้อย่างน้อย 1 ข้อ',earned:answers>0},
    {id:'complete',name:'ตั้งใจจนจบ',detail:'ทำกิจกรรมครบทุกข้อในหนึ่งบท',earned:count>0},
    {id:'three',name:'นักฝึกตัวอักษร',detail:'ทำกิจกรรมครบ 3 บทเรียน',earned:count>=3},
    {id:'five',name:'สะสมครบห้าบท',detail:'ทำกิจกรรมครบ 5 บทเรียนที่ไม่ซ้ำกัน',earned:count>=5},
    {id:'repeat',name:'กลับมาลองอีกครั้ง',detail:'ทำบทเดิมครบทุกข้ออย่างน้อย 2 รอบ',earned:repeat},
  ];
  return {trophies,missions,coins:missions.filter(m=>m.earned).length,current,best,days:days.size,today:days.has(today),legacyDays,
    recent:Array.from({length:7},(_,i)=>{const value=new Date((todayNumber-6+i)*86400000).toISOString().slice(0,10);return {day:value,practiced:days.has(value)};})};
}
export function answerPraise(wrongAttempts,hintLevel) {
  if (wrongAttempts>0) return 'เยี่ยมมาก! ลองอีกครั้งจนทำได้แล้ว ได้ 1 ดาว';
  if (hintLevel>0) return 'เก่งมาก! ใช้ตัวช่วยแล้วทำได้ ได้ 1 ดาว';
  return 'ทำได้แล้ว! ได้ 1 ดาว';
}
