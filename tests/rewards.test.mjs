import test from 'node:test';
import assert from 'node:assert/strict';
import { practiceRewards,thaiPracticeDay,answerPraise } from '../src/rewardsDomain.mjs';
const lessons=Array.from({length:5},(_,i)=>({id:i+1,title:`บท ${i+1}`,questions:[{},{}]}));
const now=Date.parse('2026-10-06T17:00:00Z'); // Midnight on 7 October in Thailand.
const round=(id,lessonId=1,time=now)=>({id,lessonId,startedAt:time,endedAt:time,status:'complete',questionIndices:[0,1],records:[0,1].map(questionIndex=>({questionIndex,category:'assisted',answeredAt:time}))});
test('reward missions and trophies are earned once from complete activities, excluding skipped and review subsets',()=>{
 const first=round('one'),reward=practiceRewards([first,first],lessons,now);
 assert.equal(reward.coins,2);assert.equal(reward.trophies.filter(t=>t.earned).length,1);assert.equal(reward.days,1);
 assert.equal(practiceRewards([first,round('two')],lessons,now).coins,3);
 const all=lessons.map(l=>round(`lesson-${l.id}`,l.id));assert.equal(practiceRewards([...all,round('repeat')],lessons,now).coins,5);
 const skipped={...first,records:first.records.map(r=>({...r,category:'skipped'}))};
 assert.equal(practiceRewards([skipped],lessons,now).coins,0);assert.equal(practiceRewards([skipped],lessons,now).days,0);
 const subset={...first,questionIndices:[0],records:[first.records[0]]};assert.equal(practiceRewards([subset],lessons,now).trophies[0].earned,false);
 const missing={...first,records:[first.records[0],first.records[0]]};assert.equal(practiceRewards([missing],lessons,now).trophies[0].earned,false);
 const active={...first,status:'active'};assert.equal(practiceRewards([active],lessons,now).coins,1);
 assert.equal(practiceRewards([{...active,records:[]}],lessons,now).coins,0);
});
test('streak uses Thai midnight, unique actual answering days and preserves yesterday until today ends',()=>{
 assert.equal(thaiPracticeDay(now-1),'2026-10-06');assert.equal(thaiPracticeDay(now),'2026-10-07');
 assert.equal(thaiPracticeDay(NaN),null);
 const records=[round('a',1,now-86400000),round('b',1,now),round('same-day',1,now+1000)];
 let reward=practiceRewards(records,lessons,now+2000);assert.equal(reward.days,2);assert.equal(reward.current,2);assert.equal(reward.best,2);assert.equal(reward.today,true);
 reward=practiceRewards(records,lessons,now+86400000);assert.equal(reward.current,2);assert.equal(reward.today,false);
 reward=practiceRewards(records,lessons,now+2*86400000);assert.equal(reward.current,0);assert.equal(reward.best,2);assert.equal(reward.coins,3);
 const overnight={...round('overnight',1,now-1000),records:[{questionIndex:0,category:'independent',answeredAt:now-1000},{questionIndex:1,category:'retried',answeredAt:now+1000}]};
 assert.equal(practiceRewards([overnight],lessons,now+2000).days,2);
 assert.equal(practiceRewards([round('future',1,now+86400000)],lessons,now).days,0);
});
test('legacy records use round dates transparently and year boundaries remain consecutive',()=>{
 const time=Date.parse('2026-12-31T17:00:00Z');
 const legacy={...round('legacy',1,time-1),records:[{questionIndex:0,category:'independent'},{questionIndex:1,category:'assisted'}]};
 const reward=practiceRewards([legacy,round('new',1,time)],lessons,time);
 assert.equal(reward.current,2);assert.equal(reward.legacyDays,true);assert.equal(reward.recent.at(-1).day,'2027-01-01');
});
test('praise recognises another attempt or using help without claiming better reading ability',()=>{
 assert.match(answerPraise(2,0),/ลองอีกครั้งจนทำได้/);assert.match(answerPraise(0,2),/ใช้ตัวช่วย/);assert.match(answerPraise(0,0),/1 ดาว/);
});
