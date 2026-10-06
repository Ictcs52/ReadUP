import { authenticatedDemo } from './fixtures';
import { test, expect, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import curriculum from '../../src/data/lessons.json' with { type: 'json' };

const require = createRequire(import.meta.url);
test.beforeEach(async ({ page }) => { await authenticatedDemo(page); });

async function home(page: Page) { await page.goto('./'); await expect(page.getByRole('button',{name:'เริ่มฝึกวันนี้',exact:true})).toBeVisible(); }
async function answerAll(page: Page, id: number) {
  const lesson = curriculum.lessons.find(l=>l.id===id)!;
  for (let i=0;i<lesson.questions.length;i++) {
    await page.getByRole('button',{name:`เลือก ${lesson.questions[i].letter}`,exact:true}).click();
    if (lesson.mode==='match') await page.getByRole('button',{name:'วางตัวอักษรที่เลือกลงช่องจับคู่'}).click();
    await page.getByRole('button',{name:i===lesson.questions.length-1?'ดูรางวัลของฉัน':'ข้อต่อไป',exact:true}).click();
  }
}
async function snapshot(page: Page) {
  return page.evaluate(()=>new Promise<any>((resolve,reject)=>{
    const open=indexedDB.open('readtech-local-v1');
    open.onsuccess=()=>{
      const db=open.result;
      const request=db.transaction('app').objectStore('app').get('snapshot');
      request.onsuccess=()=>{resolve(request.result);db.close();};
      request.onerror=()=>reject(request.error);
    }; open.onerror=()=>reject(open.error);
  }));
}

test('desktop landing page and mobile pages fit without horizontal scrolling',async({page})=>{
  await home(page);
  await page.screenshot({path:'test-results/home-desktop.png',fullPage:true});
  for(const width of [320,390,650,768]) {
    await page.setViewportSize({width,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'test-results/home-mobile.png',fullPage:true});
  await page.getByRole('button',{name:'เริ่มฝึกวันนี้',exact:true}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/exercise-mobile.png',fullPage:true});
});

test('all five lessons are usable, including tap-to-match',async({page})=>{
  await home(page);
  for(const lesson of curriculum.lessons) {
    await page.getByRole('button',{name:'บทเรียนของฉัน',exact:true}).click();
    await page.getByRole('button',{name:`เริ่มฝึก ${lesson.title}`,exact:true}).click();
    await answerAll(page,lesson.id);
    await expect(page.getByRole('heading',{name:'ทำกิจกรรมครบแล้ว!'})).toBeVisible();
    await page.getByRole('button',{name:'กลับหน้าหลัก',exact:true}).click();
  }
  await expect.poll(async()=>(await snapshot(page)).sessions.filter((s:any)=>s.status==='complete').length).toBe(5);
});

test('independent, retry, assisted and skipped results persist distinctly',async({page})=>{
  await home(page);
  await page.getByRole('button',{name:'เริ่มฝึกวันนี้',exact:true}).click();
  await page.getByRole('button',{name:'เลือก ม',exact:true}).click();
  await page.getByRole('button',{name:'เลือก ก',exact:true}).click();
  await page.getByRole('button',{name:'ข้อต่อไป',exact:true}).click();
  await page.getByRole('button',{name:'ช่วยทีละนิด',exact:true}).click();
  await page.getByRole('button',{name:'เลือก ม',exact:true}).click();
  await page.getByRole('button',{name:'ข้อต่อไป',exact:true}).click();
  await page.getByRole('button',{name:'เลือก ป',exact:true}).click();
  await page.getByRole('button',{name:'ข้อต่อไป',exact:true}).click();
  await page.getByRole('button',{name:'ฝึกข้อนี้ภายหลัง',exact:true}).click();
  await page.getByRole('button',{name:'ข้อต่อไป',exact:true}).click();
  await page.getByRole('button',{name:'เลือก บ',exact:true}).click();
  await page.getByRole('button',{name:'ดูรางวัลของฉัน',exact:true}).click();
  await expect.poll(async()=>(await snapshot(page)).sessions[0].records.length).toBe(5);
  expect((await snapshot(page)).sessions[0].records.map((r:any)=>r.category)).toEqual(['retried','assisted','independent','skipped','independent']);
  await page.reload();
  await page.getByRole('button',{name:'สำหรับครู',exact:true}).click();
  await expect(page.getByRole('heading',{name:'ผู้เรียนและบัญชีครู',exact:true})).toBeVisible();
  expect((await snapshot(page)).sessions[0].records.map((r:any)=>r.category)).toEqual(['retried','assisted','independent','skipped','independent']);
});

test('reload resumes answered question without duplicating credit and preserves hints',async({page})=>{
  await home(page);
  await page.getByRole('button',{name:'เริ่มฝึกวันนี้',exact:true}).click();
  await page.getByRole('button',{name:'ช่วยทีละนิด',exact:true}).click();
  await page.getByRole('button',{name:'เลือก ก',exact:true}).click();
  await expect.poll(async()=>(await snapshot(page)).sessions[0].answered).toBe(true);
  await page.reload();
  await page.getByRole('button',{name:'ฝึกต่อจากครั้งก่อน',exact:true}).click();
  await expect(page.getByRole('button',{name:'เลือก ก',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'ข้อต่อไป',exact:true}).click();
  await expect(page.getByText('ข้อ 2 จาก 5',{exact:true})).toBeVisible();
  expect((await snapshot(page)).sessions[0].records.length).toBe(1);
});

test('pause is keyboard dismissible and paused time is not counted',async({page})=>{
  await home(page);
  await page.getByRole('button',{name:'เริ่มฝึกวันนี้',exact:true}).click();
  await page.getByRole('button',{name:'พัก / กลับหน้าหลัก',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const before=(await snapshot(page)).sessions[0].currentMs;
  await page.waitForTimeout(1300);
  expect((await snapshot(page)).sessions[0].currentMs).toBe(before);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('planned levels never present incomplete lessons as playable',async({page})=>{
  await home(page);
  await page.getByRole('button',{name:'บทเรียนของฉัน',exact:true}).click();
  await page.getByRole('tab',{name:'LEVEL 6 แผนบทเรียน'}).click();
  await expect(page.getByText('ระดับนี้เป็นแผนการพัฒนา',{exact:false})).toBeVisible();
  await expect(page.getByText('เรื่องสั้นของฉัน',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:/เริ่มฝึก /})).toHaveCount(0);
});

test('trial results can be exported and reset requires confirmation',async({page})=>{
  await home(page);
  await page.getByRole('button',{name:'เริ่มฝึกวันนี้',exact:true}).click();
  await answerAll(page,1);
  await page.getByRole('button',{name:'ปรับการใช้งาน',exact:true}).first().click();
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'ส่งออกผล',exact:true}).click();
  const csv=await readFile((await (await download).path())!,'utf8');
  expect(csv).toContain('รู้จักพยัญชนะชุดแรก');
  await page.getByRole('button',{name:'ล้างผลเพื่อเปลี่ยนผู้เรียน'}).click();
  await page.getByRole('button',{name:'ยกเลิก',exact:true}).click();
  expect((await snapshot(page)).sessions.length).toBe(1);
  await page.getByRole('button',{name:'ล้างผลเพื่อเปลี่ยนผู้เรียน'}).click();
  await page.getByRole('button',{name:'ยืนยันล้างผล',exact:true}).click();
  await expect.poll(async()=>(await snapshot(page)).sessions.length).toBe(0);
});

test('accessibility checks for home and exercise',async({page})=>{
  await home(page);
  await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
  const violations=await page.evaluate(async()=> (await (window as any).axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map((v:any)=>({id:v.id,nodes:v.nodes.map((n:any)=>n.target)})));
  expect(violations).toEqual([]);
  await page.getByRole('button',{name:'เริ่มฝึกวันนี้',exact:true}).click();
  const exercise=await page.evaluate(async()=> (await (window as any).axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map((v:any)=>({id:v.id,nodes:v.nodes.map((n:any)=>n.target)})));
  expect(exercise).toEqual([]);
  await page.getByRole('button',{name:'พัก / กลับหน้าหลัก',exact:true}).click();
  await page.getByRole('button',{name:'กลับหน้าหลัก',exact:true}).click();
  for (const name of ['บทเรียนของฉัน','รางวัลของฉัน','สำหรับครู','ปรับการใช้งาน']) {
    await page.getByRole('button',{name,exact:true}).first().click();
    const issues=await page.evaluate(async()=> (await (window as any).axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map((v:any)=>({id:v.id,nodes:v.nodes.map((n:any)=>n.target)})));
    expect(issues, name).toEqual([]);
  }
});
