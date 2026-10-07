import { useEffect, useState } from 'react';
import type { Lesson, Session } from '../types';
import { practiceRewards } from '../rewardsDomain.mjs';
import { BookFriend } from './Art';
import { Icon } from './Icon';

export function RewardsPanel({ sessions, lessons }: { sessions: Session[]; lessons: Lesson[] }) {
  const [now,setNow]=useState(Date.now);
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(timer);},[]);
  const reward=practiceRewards(sessions,lessons,now);
  const levels=[...new Set(reward.trophies.map(t=>Math.ceil(t.id/5)))];
  return <>
    <section className="reward-banner"><BookFriend/><div><h2>ความพยายามของเธอมีค่าเสมอ</h2><p>ทุกครั้งที่ลอง คือก้าวเล็ก ๆ ของเธอ</p></div></section>
    <dl className="reward-totals" aria-label="รางวัลที่สะสม"><div><dt><Icon name="trophy"/>ถ้วยประจำบท</dt><dd>{reward.trophies.filter(t=>t.earned).length}<small> / {lessons.length} ถ้วย</small></dd></div><div><dt><Icon name="coin"/>เหรียญภารกิจ</dt><dd>{reward.coins}<small> / {reward.missions.length} เหรียญ</small></dd></div><div><dt><Icon name="flame"/>ฝึกต่อเนื่อง</dt><dd>{reward.current}<small> วัน</small></dd></div></dl>
    <section className="practice-streak" aria-label="วันฝึกของฉัน"><div className="streak-heading"><div><h2>วันฝึกของฉัน</h2><p>{reward.today?'วันนี้ได้ฝึกแล้ว เก่งมาก!':'วันนี้เริ่มจากข้อเดียวก็ได้'}</p></div><span>ต่อเนื่องสูงสุด {reward.best} วัน · ฝึกทั้งหมด {reward.days} วัน</span></div><ol className="streak-week" aria-label="การฝึก 7 วันล่าสุด">{reward.recent.map(day=><li key={day.day} className={day.practiced?'practiced':''}><time dateTime={day.day}>{new Date(day.day+'T00:00:00Z').toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short'})}</time><Icon name={day.practiced?'check':'leaf'} size={20}/><span>{day.practiced?'ได้ฝึก':'พักได้'}</span></li>)}</ol><p className="fine-print">ทำกิจกรรมได้อย่างน้อย 1 ข้อจึงนับเป็นวันฝึก · วันละ 1 ครั้งตามเวลาประเทศไทย พักได้เสมอ รางวัลที่สะสมยังอยู่</p>{reward.legacyDays&&<p className="fine-print">ผลเก่าที่ไม่มีเวลาตอบรายข้อ ใช้วันที่จบรอบ หรือวันที่เริ่มรอบถ้ายังไม่จบ</p>}</section>
    <section aria-label="ถ้วยประจำบท"><h2 className="reward-section-title">ถ้วยประจำบท</h2><p className="fine-print">ทำกิจกรรมครบทุกข้อ ได้ถ้วยบทละ 1 ใบ ใช้ตัวช่วยและลองใหม่ได้ ข้อที่ข้ามกลับมาฝึกในรอบใหม่ได้</p>{levels.map(level=>{const trophies=reward.trophies.filter(t=>Math.ceil(t.id/5)===level);return <div className="trophy-level" key={level}><div className="trophy-level-heading"><h3>LEVEL {level}</h3><span>สะสมแล้ว {trophies.filter(t=>t.earned).length} / {trophies.length} ใบ</span></div><div className="trophy-grid">{trophies.map(t=><article key={t.id} className={'trophy-card '+(t.earned?'earned':'')}><Icon name="trophy" size={38}/><div><h4>บทที่ {t.id}: {t.title}</h4><span>{t.earned?'ได้รับถ้วยแล้ว':'ค่อย ๆ ฝึกเพื่อสะสมถ้วย'}</span></div></article>)}</div></div>;})}</section>
    <section aria-label="ภารกิจสะสมเหรียญ"><h2 className="reward-section-title">ภารกิจสะสมเหรียญ</h2><p className="fine-print">แต่ละภารกิจให้ 1 เหรียญครั้งเดียว เปิดดูเมื่อไรก็ไม่เพิ่มซ้ำ</p><div className="badge-grid">{reward.missions.map(m=><article className={'badge-card '+(!m.earned?'not-yet':'')} key={m.id}><span className="badge-symbol"><Icon name="coin" size={38}/></span><h3>{m.name}</h3><p>{m.detail}</p><span className="badge-state">{m.earned?'ได้รับ 1 เหรียญแล้ว':'ค่อย ๆ สะสมได้'}</span></article>)}</div></section>
  </>;
}
