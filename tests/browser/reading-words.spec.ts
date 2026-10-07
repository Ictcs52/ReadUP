import { test, expect, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { authenticatedDemo } from './fixtures';
import curriculum from '../../src/data/lessons.json' with { type: 'json' };
const require=createRequire(import.meta.url);
async function snapshot(page:Page){return page.evaluate(()=>new Promise<any>((resolve,reject)=>{const open=indexedDB.open('readtech-local-v1');open.onsuccess=()=>{const db=open.result;const request=db.transaction('app').objectStore('app').get('snapshot');request.onsuccess=()=>{resolve(request.result);db.close();};request.onerror=()=>reject(request.error);};open.onerror=()=>reject(open.error);}));}

for(const id of [16,17,18,19,20])test('level-four lesson '+id+' supports gentle help, mobile resume and its own word results and trophy',async({page})=>{
 await authenticatedDemo(page);await page.goto('./');await page.getByRole('button',{name:'ดูบทใหม่',exact:true}).click();
 await page.getByRole('tab',{name:'LEVEL 4 พร้อมฝึก',exact:true}).click();
 await expect(page.getByRole('tab',{name:'LEVEL 4 พร้อมฝึก',exact:true})).toHaveAttribute('aria-selected','true');
 await expect(page.locator('.level-panel .lesson-card')).toHaveCount(5);await expect(page.locator('.level-panel .planned-lesson')).toHaveCount(0);
 const lesson=curriculum.lessons.find(l=>l.id===id)!;const first=lesson.questions[0];await page.getByRole('button',{name:'เริ่มฝึก '+lesson.title,exact:true}).click();
 await expect(page.locator('.question-art')).toHaveAccessibleName(first.word);await expect(page.locator('.target-letter')).toHaveCount(0);await expect(page.locator('.letter-option')).toHaveCount(2);
 const support=await page.locator('.exercise-support').boundingBox();expect(support!.y+support!.height).toBeLessThanOrEqual((await page.locator('.question-visual').boundingBox())!.y);
 await page.getByRole('button',{name:'เลือก '+first.options.find(w=>w!==first.word),exact:true}).click();const popup=page.getByRole('dialog',{name:'ลองใหม่อีกทีนะ',exact:true});await expect(popup).toBeVisible();await popup.getByRole('button',{name:'ขอตัวช่วย',exact:true}).click();
 await expect(page.locator('.hint-box')).toContainText('ตัวช่วย 1/3');await expect(page.locator('.hint-letter')).toHaveCount(0);await page.getByRole('button',{name:'ช่วยทีละนิด',exact:true}).click();await expect(page.locator('.hint-letter')).toHaveCount(0);await page.getByRole('button',{name:'ช่วยทีละนิด',exact:true}).click();await expect(page.locator('.hint-letter')).toHaveText(first.word);
 await page.reload();await page.getByRole('button',{name:'ฝึกต่อจากครั้งก่อน',exact:true}).click();await expect(page.locator('.hint-box')).toContainText('ตัวช่วย 3/3');expect((await snapshot(page)).sessions[0].wrongAttempts).toBe(1);
 await page.getByRole('button',{name:'กลับหน้าแรก',exact:true}).click();await page.getByRole('button',{name:'ปรับการใช้งาน',exact:true}).first().click();await page.getByRole('checkbox',{name:/^ตัวหนังสือใหญ่ขึ้น/}).check();await page.getByRole('button',{name:'หน้าหลัก',exact:true}).click();await page.getByRole('button',{name:'ฝึกต่อจากครั้งก่อน',exact:true}).click();
 await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
 for(let i=0;i<5;i++){
  const q=lesson.questions[i];await expect(page.locator('.question-art')).toHaveAccessibleName(q.word);await expect(page.locator('.letter-option')).toHaveCount(q.options.length);
  for(const width of [1440,390,320]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  await page.screenshot({path:`test-results/reading-word-${id}-${q.art}-mobile.png`,fullPage:true});
  expect(await page.evaluate(async()=>(await(window as any).axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map((v:any)=>v.id))).toEqual([]);
  await page.getByRole('button',{name:'เลือก '+q.word,exact:true}).click();await page.getByRole('button',{name:i===4?'ดูรางวัลของฉัน':'ข้อต่อไป',exact:true}).click();
 }
 const round=(await snapshot(page)).sessions[0];expect(round.lessonId).toBe(id);expect(round.records.map((r:any)=>r.word)).toEqual(lesson.questions.map(q=>q.word));expect(round.records[0]).toMatchObject({category:'assisted',wrongAttempts:1,hintLevel:3});expect(round.records.slice(1).every((r:any)=>r.category==='independent')).toBe(true);
 await page.getByRole('button',{name:'ดูรางวัลที่สะสม',exact:true}).click();await expect(page.locator('.trophy-card.earned')).toContainText('บทที่ '+id+': '+lesson.title);await expect(page.locator('.reward-totals dd').nth(0)).toHaveText('1 / 30 ถ้วย');
});
