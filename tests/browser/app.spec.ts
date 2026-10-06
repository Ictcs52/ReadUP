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
  await expect(page.getByRole('heading',{name:'ผู้เรียน',exact:true})).toBeVisible();
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

test('exercise controls offer retry only after a wrong answer and returning home preserves progress and credit',async({page})=>{
  await home(page);await page.getByRole('button',{name:'เริ่มฝึกวันนี้',exact:true}).click();
  const controls=page.getByRole('group',{name:'ปุ่มควบคุมแบบฝึก',exact:true});
  await expect(controls.getByRole('button',{name:'ฟังตัวอย่าง',exact:true})).toBeVisible();await expect(controls.getByRole('button',{name:'ช่วยทีละนิด',exact:true})).toBeVisible();
  await expect(controls.getByRole('button',{name:'ลองใหม่',exact:true})).toHaveCount(0);await expect(controls.getByRole('button',{name:'ข้อต่อไป',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'เลือก ม',exact:true}).click();await controls.getByRole('button',{name:'ลองใหม่',exact:true}).click();
  await expect(page.getByRole('button',{name:'เลือก ม',exact:true})).toHaveAttribute('aria-pressed','false');await expect(controls.getByRole('button',{name:'ลองใหม่',exact:true})).toHaveCount(0);
  await expect.poll(async()=>(await snapshot(page)).sessions[0].wrongAttempts).toBe(1);expect((await snapshot(page)).sessions[0].records).toHaveLength(0);
  await page.getByRole('button',{name:'เลือก ก',exact:true}).click();await expect(controls.getByRole('button',{name:'ข้อต่อไป',exact:true})).toBeFocused();await expect(controls.getByRole('button',{name:'ช่วยทีละนิด',exact:true})).toHaveCount(0);
  const before=(await snapshot(page)).sessions[0];expect(before.records).toHaveLength(1);expect(before.records[0].category).toBe('retried');expect(before.records[0].wrongAttempts).toBe(1);
  await page.getByRole('button',{name:'กลับหน้าแรก',exact:true}).click();await expect(page.getByRole('button',{name:'ฝึกต่อจากครั้งก่อน',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'ฝึกต่อจากครั้งก่อน',exact:true}).click();await expect(page.getByRole('button',{name:'เลือก ก',exact:true})).toBeDisabled();
  expect((await snapshot(page)).sessions[0].id).toBe(before.id);expect((await snapshot(page)).sessions[0].records).toHaveLength(1);
  await controls.getByRole('button',{name:'ข้อต่อไป',exact:true}).click();await expect(page.getByText('ข้อ 2 จาก 5',{exact:true})).toBeVisible();await expect(controls.getByRole('button',{name:'ช่วยทีละนิด',exact:true})).toBeVisible();
});

test('retry clears a tap-to-match selection without erasing the assistance level or adding a record',async({page})=>{
  await home(page);await page.getByRole('button',{name:'บทเรียนของฉัน',exact:true}).click();await page.getByRole('button',{name:'เริ่มฝึก จับคู่รูปเหมือน',exact:true}).click();
  await page.getByRole('button',{name:'เลือก ร',exact:true}).click();const slot=page.getByRole('button',{name:'วางตัวอักษรที่เลือกลงช่องจับคู่',exact:true});await slot.click();
  await page.getByRole('button',{name:'ช่วยทีละนิด',exact:true}).click();await page.getByRole('button',{name:'ลองใหม่',exact:true}).click();await expect(slot).toBeDisabled();await expect(page.getByText('ตัวช่วย 1/3',{exact:true})).toBeVisible();
  await expect.poll(async()=>(await snapshot(page)).sessions[0].hintLevel).toBe(1);expect((await snapshot(page)).sessions[0].wrongAttempts).toBe(1);expect((await snapshot(page)).sessions[0].records).toHaveLength(0);
  await page.getByRole('button',{name:'เลือก ม',exact:true}).click();await slot.click();await expect.poll(async()=>(await snapshot(page)).sessions[0].records.length).toBe(1);expect((await snapshot(page)).sessions[0].records[0].category).toBe('assisted');
});

test('bottom exercise controls fit small screens with enlarged text and remain accessible before and after answering',async({page})=>{
  await home(page);await page.getByRole('button',{name:'ปรับการใช้งาน',exact:true}).first().click();await page.getByRole('checkbox',{name:/ตัวหนังสือใหญ่ขึ้น/}).check();await page.getByRole('button',{name:'หน้าหลัก',exact:true}).click();await page.getByRole('button',{name:'เริ่มฝึกวันนี้',exact:true}).click();
  await page.getByRole('button',{name:'เลือก ม',exact:true}).click();
  for(const width of [1440,390,320]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.getByRole('button',{name:'ลองใหม่',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'กลับหน้าแรก',exact:true})).toBeVisible();}
  await page.screenshot({path:'test-results/exercise-controls-mobile.png',fullPage:true});await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
  const scan=()=>page.evaluate(async()=>(await(window as any).axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map((v:any)=>({id:v.id,nodes:v.nodes.map((n:any)=>({target:n.target,failureSummary:n.failureSummary}))})));
  expect(await scan()).toEqual([]);await page.getByRole('button',{name:'ลองใหม่',exact:true}).click();await page.getByRole('button',{name:'เลือก ก',exact:true}).click();await expect(page.getByRole('button',{name:'ข้อต่อไป',exact:true})).toBeVisible();expect(await scan()).toEqual([]);
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

async function seedTimedPractice(page: Page, minutes: 0|5|10, elapsed: number) {
  await home(page);
  await expect.poll(async()=>Boolean(await snapshot(page))).toBe(true);
  await page.evaluate(({minutes,elapsed})=>new Promise<void>((resolve,reject)=>{
    const open=indexedDB.open('readtech-local-v1');open.onsuccess=()=>{
      const db=open.result,tx=db.transaction('app','readwrite'),store=tx.objectStore('app'),get=store.get('snapshot');
      get.onsuccess=()=>{const data=get.result;data.settings.breakMinutes=minutes;data.sessions=[{id:'break-round',lessonId:1,startedAt:Date.now(),status:'active',questionIndices:[0,1,2,3,4],index:0,records:[],wrongAttempts:2,hintLevel:1,currentMs:elapsed,answered:false}];store.put(data,'snapshot');};
      tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);
    };
  }),{minutes,elapsed});
  await page.reload();await page.getByRole('button',{name:'ฝึกต่อจากครั้งก่อน',exact:true}).click();
}

test('five-minute break preserves attempts, excludes dialog time and resumes after reload',async({page})=>{
  await seedTimedPractice(page,5,300000);
  const dialog=page.getByRole('dialog',{name:'พักสายตาสักนิดไหม?',exact:true});await expect(dialog).toBeVisible();
  await expect.poll(async()=>(await snapshot(page)).sessions[0].currentMs).toBeGreaterThanOrEqual(300000);
  const paused=await snapshot(page);await page.waitForTimeout(2200);expect((await snapshot(page)).sessions[0].currentMs).toBe(paused.sessions[0].currentMs);
  for(const width of [1440,390,320]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});expect(await page.evaluate(async()=>(await(window as any).axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map((v:any)=>v.id))).toEqual([]);
  await dialog.getByRole('button',{name:'ฝึกต่อ',exact:true}).click();await expect(dialog).toHaveCount(0);
  await expect.poll(async()=>(await snapshot(page)).sessions[0].breakAcknowledgedMs).toBeGreaterThanOrEqual(300000);
  expect((await snapshot(page)).sessions[0]).toMatchObject({id:'break-round',status:'active',index:0,wrongAttempts:2,hintLevel:1,records:[]});
  await page.reload();await page.getByRole('button',{name:'ฝึกต่อจากครั้งก่อน',exact:true}).click();await expect(dialog).toHaveCount(0);
  await page.getByRole('button',{name:'เลือก ก',exact:true}).click();await page.getByRole('button',{name:'ข้อต่อไป',exact:true}).click();
  const result=await snapshot(page);expect(result.sessions[0].records[0]).toMatchObject({category:'assisted',wrongAttempts:2,hintLevel:1});
});

test('ten-minute reminder supports taking a break and keeps progress at the same question',async({page})=>{
  await seedTimedPractice(page,10,600000);
  const dialog=page.getByRole('dialog',{name:'พักสายตาสักนิดไหม?',exact:true});await expect(dialog).toContainText('10 นาที');
  await dialog.getByRole('button',{name:'พักก่อน',exact:true}).click();await expect(page.getByRole('button',{name:'ฝึกต่อจากครั้งก่อน',exact:true})).toBeVisible();
  await expect.poll(async()=>(await snapshot(page)).sessions[0].breakAcknowledgedMs).toBeGreaterThanOrEqual(600000);
  const paused=(await snapshot(page)).sessions[0].currentMs;await page.waitForTimeout(1500);expect((await snapshot(page)).sessions[0].currentMs).toBe(paused);
  await page.getByRole('button',{name:'ฝึกต่อจากครั้งก่อน',exact:true}).click();await expect(dialog).toHaveCount(0);expect((await snapshot(page)).sessions[0].index).toBe(0);
});

test('reminder setting persists and ten minutes does not prompt after only five',async({page})=>{
  await seedTimedPractice(page,10,300000);await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'กลับหน้าแรก',exact:true}).click();await page.getByRole('button',{name:'ปรับการใช้งาน',exact:true}).first().click();
  const setting=page.getByRole('combobox',{name:'ช่วงเวลาเตือนพัก',exact:true});await expect(setting).toHaveValue('10');await setting.selectOption('0');
  await expect.poll(async()=>(await snapshot(page)).settings.breakMinutes).toBe(0);await page.reload();await page.getByRole('button',{name:'ปรับการใช้งาน',exact:true}).first().click();await expect(setting).toHaveValue('0');
  await page.getByRole('button',{name:'หน้าหลัก',exact:true}).click();await page.getByRole('button',{name:'ฝึกต่อจากครั้งก่อน',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('rewards recognise real practice, award a trophy once and keep repeated training distinct',async({page})=>{
 await home(page);await page.getByRole('button',{name:'รางวัลของฉัน',exact:true}).click();
 const totals=page.locator('.reward-totals');await expect(totals.locator('dd').nth(0)).toHaveText('0 / 5 ถ้วย');await expect(totals.locator('dd').nth(1)).toHaveText('0 / 5 เหรียญ');
 await page.getByRole('button',{name:'หน้าหลัก',exact:true}).click();await page.getByRole('button',{name:'เริ่มฝึกวันนี้',exact:true}).click();
 await page.getByRole('button',{name:'เลือก ม',exact:true}).click();await page.getByRole('button',{name:'เลือก ก',exact:true}).click();await expect(page.getByText('เยี่ยมมาก! ลองอีกครั้งจนทำได้แล้ว ได้ 1 ดาว',{exact:true})).toBeVisible();
 await expect.poll(async()=>typeof (await snapshot(page)).sessions[0].records[0].answeredAt).toBe('number');
 await page.getByRole('button',{name:'กลับหน้าแรก',exact:true}).click();await page.getByRole('button',{name:'รางวัลของฉัน',exact:true}).click();await expect(totals.locator('dd').nth(1)).toHaveText('1 / 5 เหรียญ');await expect(totals.locator('dd').nth(2)).toHaveText('1 วัน');
 await page.getByRole('button',{name:'หน้าหลัก',exact:true}).click();await page.getByRole('button',{name:'ฝึกต่อจากครั้งก่อน',exact:true}).click();await page.getByRole('button',{name:'ข้อต่อไป',exact:true}).click();
 const lesson=curriculum.lessons[0];for(let i=1;i<lesson.questions.length;i++){await page.getByRole('button',{name:`เลือก ${lesson.questions[i].letter}`,exact:true}).click();await page.getByRole('button',{name:i===lesson.questions.length-1?'ดูรางวัลของฉัน':'ข้อต่อไป',exact:true}).click();}
 await expect(page.getByText('เก็บถ้วยประจำบทนี้แล้ว · บทละ 1 ใบ',{exact:true})).toBeVisible();await page.getByRole('button',{name:'ดูรางวัลที่สะสม',exact:true}).click();
 await expect(totals.locator('dd').nth(0)).toHaveText('1 / 5 ถ้วย');await expect(totals.locator('dd').nth(1)).toHaveText('2 / 5 เหรียญ');await expect(page.locator('.trophy-card.earned')).toHaveCount(1);
 await page.reload();await page.getByRole('button',{name:'รางวัลของฉัน',exact:true}).click();await expect(totals.locator('dd').nth(1)).toHaveText('2 / 5 เหรียญ');
 await page.getByRole('button',{name:'บทเรียนของฉัน',exact:true}).click();await page.getByRole('button',{name:`ฝึกอีกครั้ง ${lesson.title}`,exact:true}).click();await answerAll(page,1);await page.getByRole('button',{name:'ดูรางวัลที่สะสม',exact:true}).click();
 await expect(totals.locator('dd').nth(0)).toHaveText('1 / 5 ถ้วย');await expect(totals.locator('dd').nth(1)).toHaveText('3 / 5 เหรียญ');await expect(totals.locator('dd').nth(2)).toHaveText('1 วัน');
 await page.getByRole('button',{name:'ปรับการใช้งาน',exact:true}).first().click();await page.getByRole('checkbox',{name:/^ตัวหนังสือใหญ่ขึ้น/}).check();await page.getByRole('button',{name:'รางวัลของฉัน',exact:true}).click();
 for(const width of [1440,390,320]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await page.screenshot({path:'test-results/rewards-mobile.png',fullPage:true});await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
 expect(await page.evaluate(async()=>(await(window as any).axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map((v:any)=>({id:v.id,nodes:v.nodes.map((n:any)=>({target:n.target,summary:n.failureSummary}))})))).toEqual([]);
});

test('opening a lesson or skipping every activity gives no completed mission, trophy or practice day',async({page})=>{
 await home(page);await page.getByRole('button',{name:'เริ่มฝึกวันนี้',exact:true}).click();await page.getByRole('button',{name:'กลับหน้าแรก',exact:true}).click();await page.getByRole('button',{name:'รางวัลของฉัน',exact:true}).click();
 await expect(page.locator('.reward-totals dd').nth(1)).toHaveText('0 / 5 เหรียญ');await expect(page.locator('.reward-totals dd').nth(2)).toHaveText('0 วัน');
 await page.getByRole('button',{name:'หน้าหลัก',exact:true}).click();await page.getByRole('button',{name:'ฝึกต่อจากครั้งก่อน',exact:true}).click();
 for(let i=0;i<5;i++){await page.getByRole('button',{name:'ฝึกข้อนี้ภายหลัง',exact:true}).click();await page.getByRole('button',{name:i===4?'ดูรางวัลของฉัน':'ข้อต่อไป',exact:true}).click();}
 await expect(page.getByText('เก็บถ้วยประจำบทนี้แล้ว · บทละ 1 ใบ',{exact:true})).toHaveCount(0);await page.getByRole('button',{name:'ดูรางวัลที่สะสม',exact:true}).click();await expect(page.locator('.reward-totals dd').nth(0)).toHaveText('0 / 5 ถ้วย');await expect(page.locator('.reward-totals dd').nth(1)).toHaveText('0 / 5 เหรียญ');await expect(page.locator('.reward-totals dd').nth(2)).toHaveText('0 วัน');
});
