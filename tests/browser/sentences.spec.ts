import {test,expect,type Page} from '@playwright/test';
import {createRequire} from 'node:module';
import {authenticatedDemo} from './fixtures';
import curriculum from '../../src/data/lessons.json' with {type:'json'};
const require=createRequire(import.meta.url);
async function snapshot(page:Page){return page.evaluate(()=>new Promise<any>((resolve,reject)=>{const open=indexedDB.open('readtech-local-v1');open.onsuccess=()=>{const db=open.result;const request=db.transaction('app').objectStore('app').get('snapshot');request.onsuccess=()=>{resolve(request.result);db.close();};request.onerror=()=>reject(request.error);};open.onerror=()=>reject(open.error);}));}
async function start(page:Page,id:number){await authenticatedDemo(page);await page.goto('./');await page.getByRole('button',{name:'บทเรียนของฉัน',exact:true}).first().click();await page.getByRole('tab',{name:`LEVEL ${Math.ceil(id/5)} พร้อมฝึก`,exact:true}).click();await page.getByRole('button',{name:'เริ่มฝึก '+curriculum.lessons.find(l=>l.id===id)!.title,exact:true}).click();}

for(let id=21;id<=30;id++)test('sentence lesson '+id+' can be completed and saves its own answers and trophy',async({page})=>{
 await start(page,id);const lesson=curriculum.lessons.find(l=>l.id===id)!;
 await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
 for(const [i,q]of lesson.questions.entries()){
  await expect(page.locator('.reading-question')).toHaveText(q.reading!.question);
  for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  if(i===0){expect(await page.evaluate(async()=>(await(window as any).axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map((v:any)=>v.id))).toEqual([]);await page.setViewportSize({width:390,height:844});await page.screenshot({path:`test-results/sentence-${id}-mobile.png`,fullPage:true});}
  if(q.reading!.parts){for(const part of q.reading!.parts)await page.getByRole('button',{name:'เพิ่มส่วน '+part,exact:true}).click();await page.getByRole('button',{name:'ตรวจข้อความที่เรียง',exact:true}).click();}
  else await page.getByRole('button',{name:'เลือก '+q.letter,exact:true}).click();
  await page.getByRole('button',{name:i===4?'ดูรางวัลของฉัน':'ข้อต่อไป',exact:true}).click();
 }
 const round=(await snapshot(page)).sessions[0];expect(round.lessonId).toBe(id);expect(round.status).toBe('complete');expect(round.records.map((r:any)=>r.word)).toEqual(lesson.questions.map(q=>q.word));expect(round.records.every((r:any)=>r.category==='independent')).toBe(true);
 await page.getByRole('button',{name:'ดูรางวัลที่สะสม',exact:true}).click();await expect(page.locator('.trophy-card.earned')).toContainText('บทที่ '+id+': '+lesson.title);
});

test('sentence ordering resumes partial draft and wrong order can retry without duplicate credit',async({page})=>{
 await start(page,22);const q=curriculum.lessons.find(l=>l.id===22)!.questions[0];
 await page.getByRole('button',{name:'เพิ่มส่วน แมว',exact:true}).click();await expect.poll(async()=>(await snapshot(page)).sessions[0].wordOrder).toEqual(['แมว']);await page.reload();await page.getByRole('button',{name:'ฝึกต่อจากครั้งก่อน',exact:true}).click();await expect(page.locator('.built-word strong')).toHaveText('แมว');
 await page.getByRole('button',{name:'ย้อนหนึ่งส่วน',exact:true}).click();for(const part of [...q.reading!.parts!].reverse())await page.getByRole('button',{name:'เพิ่มส่วน '+part,exact:true}).click();await page.getByRole('button',{name:'ตรวจข้อความที่เรียง',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'ลองอีกครั้ง',exact:true}).click();await expect(page.locator('.built-word strong')).toHaveText('แตะคำด้านล่าง');
 for(const part of q.reading!.parts!)await page.getByRole('button',{name:'เพิ่มส่วน '+part,exact:true}).click();await page.getByRole('button',{name:'ตรวจข้อความที่เรียง',exact:true}).click();expect((await snapshot(page)).sessions[0].records).toMatchObject([{category:'retried',wrongAttempts:1}]);
});

test('comprehension shows the source text and gradual help, preserves large-text layout and skipped results',async({page})=>{
 await start(page,30);const q=curriculum.lessons.find(l=>l.id===30)!.questions[0];await expect(page.locator('.reading-passage')).toContainText(q.reading!.text);await expect(page.locator('.sentence-art')).toHaveCount(0);
 const support=await page.locator('.exercise-support').boundingBox();expect(support!.y+support!.height).toBeLessThanOrEqual((await page.locator('.question-visual').boundingBox())!.y);
 for(let n=1;n<=3;n++){await page.getByRole('button',{name:'ช่วยทีละนิด',exact:true}).click();if(n<3)await expect(page.locator('.hint-letter')).toHaveCount(0);else await expect(page.locator('.hint-letter')).toHaveText(q.letter);}
 await page.getByRole('button',{name:'กลับหน้าแรก',exact:true}).click();await page.getByRole('button',{name:'ปรับการใช้งาน',exact:true}).first().click();await page.getByRole('checkbox',{name:/^ตัวหนังสือใหญ่ขึ้น/}).check();await page.getByRole('button',{name:'หน้าหลัก',exact:true}).first().click();await page.getByRole('button',{name:'ฝึกต่อจากครั้งก่อน',exact:true}).click();
 for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);for(const button of await page.locator('.sentence-options button').all())expect(await button.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);}
 await page.getByRole('button',{name:'เลือก '+q.letter,exact:true}).click();await page.getByRole('button',{name:'ข้อต่อไป',exact:true}).click();await page.getByRole('button',{name:'ฝึกข้อนี้ภายหลัง',exact:true}).click();expect((await snapshot(page)).sessions[0].records.map((r:any)=>r.category)).toEqual(['assisted','skipped']);
});
