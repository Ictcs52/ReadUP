import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { authenticatedDemo } from './fixtures';
import curriculum from '../../src/data/lessons.json' with { type: 'json' };

const require = createRequire(import.meta.url);
for(const id of [1,3,11,13,14]) test(`retry popup encourages another try in lesson ${id}`,async({page})=>{
 await authenticatedDemo(page);await page.goto('./');
 await page.getByRole('button',{name:'บทเรียนของฉัน',exact:true}).first().click();
 await page.getByRole('tab',{name:`LEVEL ${Math.ceil(id/5)} พร้อมฝึก`,exact:true}).click();
 const lesson=curriculum.lessons.find(l=>l.id===id)!;const q=lesson.questions[0] as any;
 await page.getByRole('button',{name:'เริ่มฝึก '+lesson.title,exact:true}).click();
 const submitWrong=async()=>{
  if(q.order){for(const part of [...q.order].reverse())await page.getByRole('button',{name:['า','ี','ู'].includes(part)?'เพิ่มสระ อ'+part:'เพิ่มพยัญชนะ '+part,exact:true}).click();await page.getByRole('button',{name:'ตรวจคำที่เรียง',exact:true}).click();}
  else if(q.build){if(q.build.missing==='final')await page.getByRole('button',{name:'เลือกตัวสะกด '+q.build.finals.find((f:string)=>f!==q.word.at(-1)),exact:true}).click();else{await page.getByRole('button',{name:'เลือกพยัญชนะ '+q.word[0],exact:true}).click();await page.getByRole('button',{name:'เลือกสระ อี',exact:true}).click();}await page.getByRole('button',{name:'ตรวจคำที่สร้าง',exact:true}).click();}
  else{await page.getByRole('button',{name:'เลือก '+q.options.find((o:string)=>o!==q.letter),exact:true}).click();if(lesson.mode==='match')await page.getByRole('button',{name:'วางตัวอักษรที่เลือกลงช่องจับคู่'}).click();}
 };
 await submitWrong();const popup=page.getByRole('dialog',{name:'ลองใหม่อีกทีนะ',exact:true});
 await expect(popup).toBeVisible();await expect(popup.getByRole('button',{name:'ลองอีกครั้ง',exact:true})).toBeFocused();await expect(page.getByTestId('answer-stars')).toHaveCount(0);
 await expect(popup).toContainText('ค่อย ๆ ดู เราทำได้');
 await page.setViewportSize({width:320,height:740});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});expect(await page.evaluate(async()=>(await(window as any).axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map((v:any)=>v.id))).toEqual([]);
 if(id===1)await page.screenshot({path:'test-results/retry-popup-mobile.png',fullPage:true});
 await popup.getByRole('button',{name:'ลองอีกครั้ง',exact:true}).click();await expect(popup).toHaveCount(0);await expect(page.getByRole('button',{name:'ลองใหม่',exact:true})).toHaveCount(0);
 await submitWrong();await popup.getByRole('button',{name:'ขอตัวช่วย',exact:true}).click();await expect(page.locator('.hint-box')).toContainText('ตัวช่วย 1/3');await expect(popup).toHaveCount(0);
 await submitWrong();await page.keyboard.press('Escape');await expect(popup).toHaveCount(0);await page.getByRole('button',{name:'ลองใหม่',exact:true}).click();
 if(q.order){for(const part of q.order)await page.getByRole('button',{name:['า','ี','ู'].includes(part)?'เพิ่มสระ อ'+part:'เพิ่มพยัญชนะ '+part,exact:true}).click();await page.getByRole('button',{name:'ตรวจคำที่เรียง',exact:true}).click();}
 else if(q.build){if(q.build.missing==='final')await page.getByRole('button',{name:'เลือกตัวสะกด '+q.word.at(-1),exact:true}).click();else{await page.getByRole('button',{name:'เลือกพยัญชนะ '+q.word[0],exact:true}).click();await page.getByRole('button',{name:'เลือกสระ อา',exact:true}).click();}await page.getByRole('button',{name:'ตรวจคำที่สร้าง',exact:true}).click();}
 else{await page.getByRole('button',{name:'เลือก '+q.letter,exact:true}).click();if(lesson.mode==='match')await page.getByRole('button',{name:'วางตัวอักษรที่เลือกลงช่องจับคู่'}).click();}
 await expect(page.getByRole('button',{name:'ข้อต่อไป',exact:true})).toBeVisible();await expect(popup).toHaveCount(0);
 const records=await page.evaluate(()=>new Promise<any>(resolve=>{const request=indexedDB.open('readtech-local-v1');request.onsuccess=()=>{const db=request.result;const read=db.transaction('app').objectStore('app').get('snapshot');read.onsuccess=()=>{resolve(read.result);db.close();};};}));
 const sessions=records.sessions;expect(sessions[0].records[0]).toMatchObject({wrongAttempts:3,hintLevel:1,category:'assisted'});
});
