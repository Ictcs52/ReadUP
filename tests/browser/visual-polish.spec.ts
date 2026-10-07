import {test,expect} from '@playwright/test';
import {createRequire} from 'node:module';
import {authenticatedDemo} from './fixtures';
const require=createRequire(import.meta.url);
test.beforeEach(async({page})=>{await authenticatedDemo(page);await page.goto('./');});

test('home points to the active lesson and its level without restarting the learner round',async({page})=>{
 await page.getByRole('button',{name:'บทเรียนของฉัน',exact:true}).first().click();await page.getByRole('tab',{name:'LEVEL 3 พร้อมฝึก',exact:true}).click();await page.getByRole('button',{name:'เริ่มฝึก เติมส่วนที่หาย',exact:true}).click();
 await page.getByRole('button',{name:'เลือกสระ อา',exact:true}).click();await page.getByRole('button',{name:'ตรวจคำที่สร้าง',exact:true}).click();await page.getByRole('button',{name:'ข้อต่อไป',exact:true}).click();
 await page.getByRole('button',{name:'กลับหน้าแรก',exact:true}).click();await expect(page.locator('.hero-next')).toHaveText('บทที่ 12 · เติมส่วนที่หาย');await expect(page.locator('.lesson-section h2')).toHaveText('นักต่อคำ');
 await page.getByRole('button',{name:'ดูบทเรียนทั้งหมด',exact:true}).click();await expect(page.getByRole('tab',{name:'LEVEL 3 พร้อมฝึก',exact:true})).toHaveAttribute('aria-selected','true');
 await page.getByRole('button',{name:'หน้าหลัก',exact:true}).first().click();await page.getByRole('button',{name:'ฝึกต่อจากครั้งก่อน',exact:true}).click();await expect(page.getByText('ข้อ 2 จาก 5',{exact:true})).toBeVisible();await expect(page.locator('.built-word strong')).toHaveText('ป + ?');
});

test('level tabs work by keyboard and progress and trophies reflect completed activities',async({page})=>{
 await page.getByRole('button',{name:'บทเรียนของฉัน',exact:true}).first().click();const first=page.getByRole('tab',{name:'LEVEL 1 พร้อมฝึก',exact:true});await first.focus();await page.keyboard.press('ArrowRight');await expect(page.getByRole('tab',{name:'LEVEL 2 พร้อมฝึก',exact:true})).toBeFocused();await page.keyboard.press('End');await expect(page.getByRole('tab',{name:'LEVEL 6 แผนบทเรียน',exact:true})).toBeFocused();await page.keyboard.press('ArrowRight');await expect(first).toBeFocused();await page.keyboard.press('Home');await expect(first).toBeFocused();
 await page.getByRole('tab',{name:'LEVEL 4 พร้อมฝึก',exact:true}).click();await expect(page.locator('.level-progress')).toContainText('ทำครบ 0 / 5 บท');await page.getByRole('button',{name:'เริ่มฝึก คำของฉัน',exact:true}).click();
 for(const [i,word]of ['แมว','ปลา','บ้าน','ข้าว','กล้วย'].entries()){await page.getByRole('button',{name:'เลือก '+word,exact:true}).click();await page.getByRole('button',{name:i===4?'ดูรางวัลของฉัน':'ข้อต่อไป',exact:true}).click();}
 await page.getByRole('button',{name:'กลับหน้าหลัก',exact:true}).click();await page.getByRole('button',{name:'บทเรียนของฉัน',exact:true}).first().click();await expect(page.locator('.level-progress')).toContainText('ทำครบ 1 / 5 บท');
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/polish-lessons-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'รางวัลของฉัน',exact:true}).first().click();await expect(page.locator('.trophy-level')).toHaveCount(4);await expect(page.locator('.trophy-card')).toHaveCount(20);await expect(page.locator('.trophy-level').nth(3)).toContainText('สะสมแล้ว 1 / 5 ใบ');
 await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});expect(await page.evaluate(async()=>(await(window as any).axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map((v:any)=>v.id))).toEqual([]);await page.screenshot({path:'test-results/polish-rewards-mobile.png',fullPage:true});
});

test('mobile reading shows every choice without scrolling and keeps large Thai words whole',async({page})=>{
 await page.getByRole('button',{name:'ปรับการใช้งาน',exact:true}).first().click();await page.getByRole('checkbox',{name:/^ตัวหนังสือใหญ่ขึ้น/}).check();await page.getByRole('button',{name:'หน้าหลัก',exact:true}).first().click();
 for(const [width,height]of [[320,740],[390,844]]){await page.setViewportSize({width,height});const start=await page.getByRole('button',{name:'เริ่มฝึกวันนี้',exact:true}).boundingBox();expect(start!.y+start!.height).toBeLessThan(height-80);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await page.getByRole('button',{name:'ดูบทใหม่',exact:true}).click();await page.getByRole('button',{name:'เริ่มฝึก คำของฉัน',exact:true}).click();
 for(const [i,word]of ['แมว','ปลา','บ้าน','ข้าว','กล้วย'].entries()){
  for(const [width,height]of [[320,740],[390,844]]){await page.setViewportSize({width,height});await page.evaluate(()=>scrollTo(0,0));for(const button of await page.locator('.reading-options button').all()){const box=await button.boundingBox();expect(box!.y+box!.height).toBeLessThan(height);expect(await button.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);}expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  if(i===4)await page.screenshot({path:'test-results/polish-reading-mobile.png',fullPage:true});
  await page.getByRole('button',{name:'เลือก '+word,exact:true}).click();await page.getByRole('button',{name:i===4?'ดูรางวัลของฉัน':'ข้อต่อไป',exact:true}).click();
 }
});
