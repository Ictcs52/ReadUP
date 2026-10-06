import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import curriculum from '../../src/data/lessons.json' with { type: 'json' };

const require = createRequire(import.meta.url);
const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const unauthorized = '33333333-3333-4333-8333-333333333333';
const first = '44444444-4444-4444-8444-444444444444';
const second = '55555555-5555-4555-8555-555555555555';
function token(id: string) {
  const base = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return base({ alg: 'HS256', typ: 'JWT' }) + '.' + base({ sub: id, role: 'authenticated', iss: 'supabase', exp: Math.floor(Date.now()/1000)+3600 }) + '.test';
}
const pupil = '88888888-8888-4888-8888-888888888888';
const peer = '99999999-9999-4999-8999-999999999999';
function mockBackend() {
  const students = [
    { id: first, teacher_id: owner, auth_user_id: pupil, login_id: '1234567890', login_enabled: true, class_name: 'ป.1/1', code: 'RT001', display_name: 'นักอ่านหนึ่ง', created_at: '2026-10-06T00:00:00Z' },
    { id: second, teacher_id: owner, auth_user_id: peer, login_id: '9876543210', login_enabled: true, class_name: 'ป.1/1', code: 'RT002', display_name: 'นักอ่านสอง', created_at: '2026-10-06T00:01:00Z' },
  ];
  const sessions = new Map<string, any>();
  const readings = new Map<string, any>();
  let failReadingWrites = false;
  let failWrites = false;
  const requests: string[] = [];
  async function install(context: BrowserContext) {
    await context.route('**/cloud-config.json', route => route.fulfill({ json: { url: 'https://readtechtest.supabase.co', publishableKey: 'sb_publishable_test' } }));
    await context.route('https://readtechtest.supabase.co/**', async route => {
      const request = route.request(), url = new URL(request.url());
      requests.push(url.pathname);
      const body = request.postDataJSON();
      const bearer = request.headers().authorization?.replace('Bearer ', '') ?? '';
      let uid = '';
      try { uid = JSON.parse(Buffer.from(bearer.split('.')[1], 'base64url').toString()).sub; } catch { /* Anonymous request. */ }
      if (url.pathname === '/auth/v1/token') {
        uid = students.find(s=>body.email===`student-${s.login_id}@students.readup.invalid`)?.auth_user_id || (body.email === 'other@example.test' ? other : body.email === 'unknown@example.test' ? unauthorized : owner);
        return route.fulfill({ json: { access_token: token(uid), token_type: 'bearer', refresh_token: 'test-refresh', expires_in: 3600, user: { id: uid, email: body.email, aud: 'authenticated', role: 'authenticated', created_at: '2026-10-06T00:00:00Z', app_metadata: {}, user_metadata: {} } } });
      }
      if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204 });
      if (url.pathname === '/rest/v1/readtech_teachers') return route.fulfill({ json: [unauthorized,pupil,peer].includes(uid) ? [] : [{ id: uid, display_name: uid === owner ? 'ครูหนึ่ง' : 'ครูสอง', active: true }] });
      if (url.pathname === '/rest/v1/readtech_students') {
        if (request.method() === 'POST') {
          const value = { ...body, id: '77777777-7777-4777-8777-777777777777', created_at: '2026-10-06T00:02:00Z' };
          students.push(value);
          return route.fulfill({ status: 201, json: value });
        }
        return route.fulfill({ json: students.filter(s => s.teacher_id === uid || (s.auth_user_id === uid && s.login_enabled)) });
      }
      if (url.pathname === '/functions/v1/readtech-student-accounts') {
        if (uid !== owner) return route.fulfill({status:403,json:{error:'ไม่มีสิทธิ์ครู'}});
        let s = students.find(s=>s.id===body.studentId);
        if (body.action === 'register' && !s) {
          s = {id:'77777777-7777-4777-8777-777777777777',teacher_id:owner,code:body.code,display_name:body.name,created_at:'2026-10-06T00:02:00Z',auth_user_id:'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaaa',login_id:body.code,login_enabled:true,class_name:body.className};students.push(s);
        }
        if (!s) return route.fulfill({status:403,json:{error:'ไม่พบผู้เรียน'}});
        if(body.action==='edit'){
          if(body.expected?.code!==s.code||body.expected?.name!==s.display_name||body.expected?.className!==s.class_name)return route.fulfill({status:409,json:{error:'ข้อมูลเปลี่ยนจากอีกเครื่อง'}});
          if(students.some(other=>other.id!==s.id&&other.code===body.code))return route.fulfill({status:409,json:{error:'เลขประจำตัวนี้มีอยู่แล้ว'}});
          if(body.code!==s.code&&s.auth_user_id)s.login_id=body.code;
          s.code=body.code;s.display_name=body.name;s.class_name=body.className;
          return route.fulfill({json:{student:s,loginId:s.login_id,password:''}});
        }
        if (body.action==='disable') s.login_enabled=false;
        if (body.action==='enable') s.login_enabled=true;
        return route.fulfill({json:{student:s,loginId:s.login_id,password:['disable','enable'].includes(body.action)?'':`RT-${s.login_id}`}});
      }
      if (url.pathname === '/rest/v1/readtech_reading_assessments') {
        const studentId=url.searchParams.get('student_id')?.replace('eq.','');
        const id=url.searchParams.get('id')?.replace('eq.','');
        if(request.method()==='GET')return route.fulfill({json:[...readings.values()].filter(row=>row.teacher_id===uid&&(!studentId||row.student_id===studentId)&&(!id||row.id===id)).sort((a,b)=>Date.parse(b.assessed_at)-Date.parse(a.assessed_at))});
        if(failReadingWrites)return route.fulfill({status:503,json:{message:'Connection unavailable'}});
        if(uid!==owner)return route.fulfill({status:403,json:{code:'42501',message:'Teacher access required'}});
        if(request.method()==='POST'){
          if(readings.has(body.id))return route.fulfill({status:409,json:{code:'23505',message:'Duplicate assessment'}});
          const value={...body,revision:1,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};readings.set(value.id,value);return route.fulfill({status:201,json:value});
        }
        if(request.method()==='PATCH'){
          const old=readings.get(id!);const revision=Number(url.searchParams.get('revision')?.replace('eq.',''));
          if(!old||old.student_id!==studentId||old.teacher_id!==uid||old.revision!==revision)return route.fulfill({json:null});
          const value={...old,...body,revision:old.revision+1,updated_at:new Date().toISOString()};readings.set(old.id,value);return route.fulfill({json:value});
        }
      }
      if (url.pathname === '/rest/v1/readtech_sessions') {
        const studentId = url.searchParams.get('student_id')?.replace('eq.', '');
        return route.fulfill({ json: [...sessions.values()].filter(s => (s.owner === uid || students.some(p => p.id === s.student_id && p.auth_user_id === uid)) && s.student_id === studentId).map(({ owner: _, student_id: __, ...row }) => row) });
      }
      if (url.pathname === '/rest/v1/rpc/readtech_save_session') {
        if (failWrites) return route.fulfill({ status: 503, json: { code: '08006', message: 'Connection unavailable' } });
        const previous = sessions.get(body.p_payload.id);
        if ((previous?.revision ?? 0) !== body.p_expected_revision) return route.fulfill({ status: 409, json: { code: '40001', message: 'Session changed on another device' } });
        const row = { id: body.p_payload.id, payload: body.p_payload, revision: (previous?.revision ?? 0)+1, owner: students.find(s=>s.id===body.p_student_id)?.teacher_id, student_id: body.p_student_id };
        sessions.set(row.id, row);
        return route.fulfill({ json: { id: row.id, revision: row.revision } });
      }
      return route.fulfill({ status: 404, json: { message: 'Unexpected endpoint' } });
    });
  }
  return { install, students, sessions, readings, requests, setFailReadingWrites:(value:boolean)=>{failReadingWrites=value;}, setFailWrites: (value: boolean) => { failWrites = value; } };
}
async function openAccount(page: Page) {
  const menu=page.getByRole('button', { name: /^(สำหรับครู|บัญชีของฉัน)$/ });
  if(await menu.count()) await menu.click();
}
async function openTeacherReport(page: Page) {
  await openAccount(page);
  await page.getByRole('button', { name: 'รายงานผู้เรียน', exact: true }).click();
}
async function login(page: Page, email = 'teacher@example.test') {
  await page.goto('./'); await openAccount(page);
  await page.getByRole('radio',{name:'ครู',exact:true}).check();
  await page.getByLabel('อีเมลครู', { exact: true }).fill(email);
  await page.getByLabel('รหัสผ่าน', { exact: true }).fill('test-password');
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();
}
async function selectFirst(page: Page) {
  await page.getByRole('button', { name: 'เลือกผู้เรียน นักอ่านหนึ่ง', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'รายงานผู้เรียน', exact: true })).toBeVisible();
}
async function keys(page: Page): Promise<string[]> {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const req = indexedDB.open('readtech-local-v1');
    req.onsuccess = () => { const db = req.result; const read = db.transaction('app').objectStore('app').getAllKeys(); read.onsuccess = () => { resolve(read.result as string[]); db.close(); }; read.onerror = () => reject(read.error); };
  }));
}

test('setup is explicit and secret keys cannot be stored', async ({ page }) => {
  await page.route('**/cloud-config.json', route => route.fulfill({ json: { url: '', publishableKey: '' } }));
  await page.goto('./'); await openAccount(page);
  await expect(page.getByText('ยังไม่ได้ตั้งค่า Supabase', { exact: false })).toBeVisible();
  await page.getByText('ตั้งค่าฐานข้อมูลสำหรับผู้ดูแล', { exact: true }).click();
  await page.getByLabel('Project URL', { exact: true }).fill('https://readtechtest.supabase.co');
  await page.getByLabel('Publishable key', { exact: true }).fill('sb_secret_do_not_store');
  await page.getByRole('button', { name: 'บันทึกการเชื่อมต่อ', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('ห้ามใช้ Secret');
  expect(await page.evaluate(() => localStorage.getItem('readtech-cloud-config'))).toBeNull();
});

test('teacher records actual reading without a game round, corrects it and keeps learner reports separate',async({page,context})=>{
  const backend=mockBackend();await backend.install(context);await login(page);await selectFirst(page);
  const panel=page.getByRole('region',{name:'บันทึกการอ่านของ นักอ่านหนึ่ง',exact:true});
  await expect(panel.getByText('ยังไม่มีบันทึกการอ่าน ครูเพิ่มได้โดยไม่ต้องรอให้นักเรียนทำกิจกรรม',{exact:true})).toBeVisible();
  await panel.getByRole('button',{name:'เพิ่มบันทึกการอ่าน',exact:true}).click();
  const form=panel.getByRole('form',{name:'เพิ่มบันทึกการอ่าน',exact:true});
  await form.getByLabel('คำหรือประโยคที่ใช้ประเมิน (ถ้ามี)',{exact:true}).fill('ไก่ ม้า ปลา');
  await form.getByLabel('จำนวนคำที่อ่านถูก (คำ)',{exact:true}).fill('8');await form.getByLabel('จำนวนคำที่อ่านผิด (คำ)',{exact:true}).fill('2');
  await form.getByLabel('การสลับตัวอักษร (ครั้ง)',{exact:true}).fill('1');await form.getByLabel('การอ่านข้ามคำ (คำ)',{exact:true}).fill('1');await form.getByLabel('การหยุดอ่านกลางคัน (ครั้ง)',{exact:true}).fill('2');
  await form.getByLabel('เวลาที่ใช้ในการอ่าน (วินาที)',{exact:true}).fill('45');await form.getByLabel('ระดับความช่วยเหลือ',{exact:true}).selectOption('guided');
  await form.getByLabel('หมายเหตุ (ถ้ามี)',{exact:true}).fill('=SUM(A1:A5)');await expect(form.getByText('8 จาก 10 คำ · ถึงเป้าหมาย 80%',{exact:true})).toBeVisible();
  for(const width of [1440,390,320]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  await page.screenshot({path:'test-results/reading-form-mobile.png',fullPage:true});
  await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
  expect(await page.evaluate(async()=>(await(window as any).axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map((v:any)=>({id:v.id,nodes:v.nodes.map((n:any)=>({target:n.target,failureSummary:n.failureSummary}))})))).toEqual([]);
  await form.getByRole('button',{name:'บันทึกผลการอ่าน',exact:true}).click();await expect(form).toHaveCount(0);
  await expect(panel.getByRole('heading',{name:'ประวัติการอ่าน 1 ครั้ง',exact:true})).toBeVisible();expect(backend.sessions.size).toBe(0);expect(backend.readings.size).toBe(1);
  const row=[...backend.readings.values()][0];expect(row.student_id).toBe(first);expect(row.correct_words).toBe(8);expect(row.reading_seconds).toBe(45);expect(row.revision).toBe(1);
  const download=page.waitForEvent('download');await panel.getByRole('button',{name:'ส่งออกบันทึกการอ่าน CSV',exact:true}).click();const file=await download;expect(file.suggestedFilename()).toBe('reading-RT001.csv');
  const csv=await readFile((await file.path())!,'utf8');expect(csv).toContain('"80.00","ถึงเป้าหมาย"');expect(csv).toContain("'=SUM(A1:A5)");
  await panel.getByRole('button',{name:/^แก้ไขบันทึกการอ่าน /}).click();const edit=panel.getByRole('form',{name:'แก้ไขบันทึกการอ่าน',exact:true});
  await edit.getByLabel('จำนวนคำที่อ่านถูก (คำ)',{exact:true}).fill('7');await edit.getByLabel('จำนวนคำที่อ่านผิด (คำ)',{exact:true}).fill('3');
  await edit.getByRole('button',{name:'บันทึกผลการอ่าน',exact:true}).click();await expect(edit).toHaveCount(0);await expect(panel.getByText('7 จาก 10 คำ · ยังไม่ถึงเป้าหมาย 80%',{exact:true})).toBeVisible();expect(backend.readings.get(row.id).revision).toBe(2);
  await page.getByRole('combobox',{name:'ผู้เรียนที่ต้องการดูรายงาน',exact:true}).selectOption(second);const otherPanel=page.getByRole('region',{name:'บันทึกการอ่านของ นักอ่านสอง',exact:true});
  await expect(otherPanel.getByText('ยังไม่มีบันทึกการอ่าน ครูเพิ่มได้โดยไม่ต้องรอให้นักเรียนทำกิจกรรม',{exact:true})).toBeVisible();await expect(otherPanel.getByText('อ่านถูก 70%',{exact:true})).toHaveCount(0);
  await page.reload();await expect(page.getByRole('button',{name:'สำหรับครู',exact:true})).toBeVisible();await openAccount(page);await selectFirst(page);await expect(panel.getByText('7 จาก 10 คำ · ยังไม่ถึงเป้าหมาย 80%',{exact:true})).toBeVisible();
});

test('reading form preserves failed writes, validates skipped words and refuses stale corrections',async({page,context})=>{
  const backend=mockBackend();await backend.install(context);await login(page);await selectFirst(page);
  const panel=page.getByRole('region',{name:'บันทึกการอ่านของ นักอ่านหนึ่ง',exact:true});await panel.getByRole('button',{name:'เพิ่มบันทึกการอ่าน',exact:true}).click();
  const form=panel.getByRole('form',{name:'เพิ่มบันทึกการอ่าน',exact:true});await form.getByLabel('จำนวนคำที่อ่านถูก (คำ)',{exact:true}).fill('4');await form.getByLabel('จำนวนคำที่อ่านผิด (คำ)',{exact:true}).fill('1');await form.getByLabel('การอ่านข้ามคำ (คำ)',{exact:true}).fill('2');await form.getByLabel('ระดับความช่วยเหลือ',{exact:true}).selectOption('independent');
  await form.getByRole('button',{name:'บันทึกผลการอ่าน',exact:true}).click();await expect(form.getByRole('alert')).toContainText('คำที่อ่านข้ามต้องนับรวม');expect(backend.readings.size).toBe(0);
  await form.getByLabel('การอ่านข้ามคำ (คำ)',{exact:true}).fill('1');backend.setFailReadingWrites(true);await form.getByRole('button',{name:'บันทึกผลการอ่าน',exact:true}).click();await expect(form.getByRole('alert')).toContainText('ข้อมูลที่กรอกยังอยู่');await expect(form.getByLabel('จำนวนคำที่อ่านถูก (คำ)',{exact:true})).toHaveValue('4');
  backend.setFailReadingWrites(false);await form.getByRole('button',{name:'บันทึกผลการอ่าน',exact:true}).click();await expect(form).toHaveCount(0);expect(backend.readings.size).toBe(1);const row=[...backend.readings.values()][0];expect(row.reading_seconds).toBeNull();
  await panel.getByRole('button',{name:/^แก้ไขบันทึกการอ่าน /}).click();const edit=panel.getByRole('form',{name:'แก้ไขบันทึกการอ่าน',exact:true});row.revision++;row.note='ฉบับที่แก้จากอีกเครื่อง';
  await edit.getByLabel('หมายเหตุ (ถ้ามี)',{exact:true}).fill('ฉบับเก่า');await edit.getByRole('button',{name:'บันทึกผลการอ่าน',exact:true}).click();await expect(edit.getByRole('alert')).toContainText('เปลี่ยนจากอีกเครื่อง');expect(row.note).toBe('ฉบับที่แก้จากอีกเครื่อง');
  await edit.getByRole('button',{name:'โหลดบันทึกล่าสุด',exact:true}).click();await expect(edit).toHaveCount(0);await panel.getByText('รายละเอียดการอ่าน',{exact:true}).click();await expect(panel.getByText('หมายเหตุ: ฉบับที่แก้จากอีกเครื่อง',{exact:true})).toBeVisible();
});

test('retrying a reading insert after a lost response uses the original ID and creates only one record',async({page,context})=>{
  const backend=mockBackend();await backend.install(context);let lost=true;
  await context.route('https://readtechtest.supabase.co/rest/v1/readtech_reading_assessments**',route=>{
    if(route.request().method()==='POST'&&lost){lost=false;const value={...route.request().postDataJSON(),revision:1,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};backend.readings.set(value.id,value);return route.fulfill({status:503,json:{message:'Response lost'}});}
    return route.fallback();
  });
  await login(page);await selectFirst(page);const panel=page.getByRole('region',{name:'บันทึกการอ่านของ นักอ่านหนึ่ง',exact:true});await panel.getByRole('button',{name:'เพิ่มบันทึกการอ่าน',exact:true}).click();
  const form=panel.getByRole('form',{name:'เพิ่มบันทึกการอ่าน',exact:true});await form.getByLabel('จำนวนคำที่อ่านถูก (คำ)',{exact:true}).fill('4');await form.getByLabel('จำนวนคำที่อ่านผิด (คำ)',{exact:true}).fill('1');await form.getByLabel('ระดับความช่วยเหลือ',{exact:true}).selectOption('independent');
  await form.getByRole('button',{name:'บันทึกผลการอ่าน',exact:true}).click();await expect(form.getByRole('alert')).toContainText('บันทึกไม่สำเร็จ');expect(backend.readings.size).toBe(1);const id=[...backend.readings.keys()][0];
  await form.getByRole('button',{name:'บันทึกผลการอ่าน',exact:true}).click();await expect(form).toHaveCount(0);expect([...backend.readings.keys()]).toEqual([id]);await expect(panel.getByRole('heading',{name:'ประวัติการอ่าน 1 ครั้ง',exact:true})).toBeVisible();
});

test('an authenticated but unapproved account cannot open student management', async ({ page, context }) => {
  const backend = mockBackend(); await backend.install(context);
  await login(page, 'unknown@example.test');
  await expect(page.getByRole('alert')).toContainText('ยังไม่ได้รับสิทธิ์ครู');
  await expect(page.getByRole('heading', { name: 'เพิ่มผู้เรียน', exact: true })).toHaveCount(0);
  expect(backend.requests).not.toContain('/functions/v1/readtech-student-accounts');
  await expect(page.getByRole('button',{name:'สำหรับครู',exact:true})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'รายงานผู้เรียน',exact:true})).toHaveCount(0);
});

test('teacher reports require approved login and a selected learner on desktop and mobile', async ({ page, context }) => {
  const backend = mockBackend(); await backend.install(context);
  for (const width of [1440,390]) {
    await page.setViewportSize({width,height:900}); await page.goto('./');
    await expect(page.getByRole('button',{name:'สำหรับครู',exact:true})).toHaveCount(0);
    await expect(page.getByRole('heading',{name:'เข้าสู่ระบบ',exact:true})).toBeVisible();
    await expect(page.getByRole('heading',{name:'รายงานผู้เรียน',exact:true})).toHaveCount(0);
  }
  await page.setViewportSize({width:1440,height:1000}); await login(page);
  await expect(page.getByRole('button',{name:'เพิ่มผู้เรียน',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'สำหรับครู',exact:true}).click();
  await expect(page.getByRole('heading',{name:'ผู้เรียน',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'รายงานผู้เรียน',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'รายงานผู้เรียน',exact:true}).click();
  await expect(page.getByRole('heading',{name:'รายงานผู้เรียน',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'เลือกผู้เรียนที่ต้องการดูรายงาน',exact:true})).toBeVisible();
  await expect(page.getByText('รายงานของ นักอ่านหนึ่ง · RT001',{exact:true})).toHaveCount(0);
  await page.getByLabel('ผู้เรียนที่ต้องการดูรายงาน',{exact:true}).selectOption(first);
  await expect(page.getByText('รายงานของ นักอ่านหนึ่ง · RT001',{exact:true})).toBeVisible();
  await page.getByLabel('ผู้เรียนที่ต้องการดูรายงาน',{exact:true}).selectOption(second);
  await expect(page.getByText('รายงานของ นักอ่านสอง · RT002',{exact:true})).toBeVisible();
  await expect(page.getByText('รายงานของ นักอ่านหนึ่ง · RT001',{exact:true})).toHaveCount(0);
  await page.getByLabel('ผู้เรียนที่ต้องการดูรายงาน',{exact:true}).selectOption('');
  await expect(page.getByRole('heading',{name:'เลือกผู้เรียนที่ต้องการดูรายงาน',exact:true})).toBeVisible();
  await openAccount(page);
  await selectFirst(page);
  await openTeacherReport(page);
  await expect(page.getByRole('heading',{name:'รายงานผู้เรียน',exact:true})).toBeVisible();
  await expect(page.getByText('รายงานของ นักอ่านหนึ่ง · RT001',{exact:true})).toBeVisible();
  for (const width of [1440,390]) {
    await page.setViewportSize({width,height:1000});
    const mainMenu=page.getByRole('navigation',{name:width>950?'เมนูหลัก':'เมนูหลักบนมือถือ',exact:true});
    await expect(mainMenu.getByRole('button')).toHaveCount(4);
    await expect(mainMenu.getByRole('button',{name:'ผู้เรียน',exact:true})).toHaveCount(0);
    await expect(mainMenu.getByRole('button',{name:'สำหรับครู',exact:true})).toHaveAttribute('aria-current','page');
    await openAccount(page);
    await expect(page.getByRole('heading',{name:'ผู้เรียน',exact:true})).toBeVisible();
    await openTeacherReport(page);
    await expect(page.getByRole('heading',{name:'รายงานผู้เรียน',exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  }
  await openAccount(page);
  await page.locator('.topbar').getByRole('button',{name:'ออกจากระบบ',exact:true}).click();
  await expect(page.getByRole('button',{name:'สำหรับครู',exact:true})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'เข้าสู่ระบบ',exact:true})).toBeVisible();
});

test('approved teacher report exports learner identity and protects CSV notes from formulas', async ({ page, context }) => {
  const backend = mockBackend(); await backend.install(context); await studentLogin(page);
  await page.getByRole('button',{name:'เริ่มฝึกวันนี้',exact:true}).click();
  const lesson=curriculum.lessons.find(l=>l.id===1)!;
  for (let i=0;i<lesson.questions.length;i++) {
    await page.getByRole('button',{name:`เลือก ${lesson.questions[i].letter}`,exact:true}).click();
    await page.getByRole('button',{name:i===lesson.questions.length-1?'ดูรางวัลของฉัน':'ข้อต่อไป',exact:true}).click();
  }
  await expect.poll(()=>[...backend.sessions.values()][0]?.payload.records.length).toBe(5);
  await expect(page.locator('.local-badge')).toHaveText('บันทึกกลางแล้ว');
  await page.locator('.topbar').getByRole('button',{name:'ออกจากระบบ',exact:true}).click();
  await expect(page.getByRole('heading',{name:'เข้าสู่ระบบ',exact:true})).toBeVisible();
  await login(page);await selectFirst(page);
  await openTeacherReport(page);
  await page.getByRole('button',{name:'ดูผล',exact:true}).click();
  await page.getByRole('textbox',{name:'ข้อสังเกต (ไม่ใส่ชื่อจริงหรือข้อมูลสุขภาพ)'}).fill('=1+1');
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'ส่งออก CSV',exact:true}).click();
  const csv=await readFile((await (await download).path())!,'utf8');
  expect(csv).toContain('RT001'); expect(csv).toContain('นักอ่านหนึ่ง'); expect(csv).toContain('"\'=1+1"');
});

test('central configuration opens teacher login on a new browser and survives a config fetch failure', async ({ page, context }) => {
  const backend = mockBackend(); await backend.install(context);
  await page.goto('./'); await openAccount(page);
  await expect(page.getByRole('heading', { name: 'เข้าสู่ระบบ', exact: true })).toBeVisible();
  await expect(page.getByLabel('Project URL', { exact: true })).toHaveCount(0);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('readtech-cloud-config')!));
  expect(saved.url).toBe('https://readtechtest.supabase.co');
  await context.route('**/cloud-config.json', route => route.abort());
  await page.reload(); await openAccount(page);
  await expect(page.getByRole('heading', { name: 'เข้าสู่ระบบ', exact: true })).toBeVisible();
  await expect(page.getByLabel('Project URL', { exact: true })).toHaveCount(0);
});

test('learner drafts persist independently and teacher registration preserves their results',async({page,context,browser})=>{
 const backend=mockBackend();backend.setFailWrites(true);await backend.install(context);await studentLogin(page);
 await page.getByRole('button',{name:'เริ่มฝึกวันนี้',exact:true}).click();await page.getByRole('button',{name:'เลือก ก',exact:true}).click();
 await page.reload();await expect(page.getByRole('button',{name:'ฝึกต่อจากครั้งก่อน',exact:true})).toBeVisible();
 const peerContext=await browser.newContext();await backend.install(peerContext);const peerPage=await peerContext.newPage();await studentLogin(peerPage,'9876543210');
 await expect(peerPage.locator('.stat-number').filter({hasText:'0 ดวง'})).toBeVisible();await peerContext.close();
 backend.setFailWrites(false);await openAccount(page);await page.getByRole('button',{name:'ส่งผลตอนนี้',exact:true}).click();
 await expect.poll(()=>[...backend.sessions.values()][0]?.payload.records.length).toBe(1);
 expect([...backend.sessions.values()][0].student_id).toBe(first);
 await page.locator('.topbar').getByRole('button',{name:'ออกจากระบบ',exact:true}).click();await expect(page.getByRole('heading',{name:'เข้าสู่ระบบ',exact:true})).toBeVisible();
 await login(page);await page.getByRole('button',{name:'เพิ่มผู้เรียน',exact:true}).click();
 await page.getByLabel('เลขประจำตัว (4 หลัก)',{exact:true}).fill('0003');await page.getByLabel('ชื่อ–สกุล',{exact:true}).fill('นักอ่านสาม');await page.getByLabel('ชั้น',{exact:true}).selectOption('ป.2');
 await page.getByRole('button',{name:'บันทึกผู้เรียน',exact:true}).click();await expect(page.getByRole('button',{name:'เลือกผู้เรียน นักอ่านสาม'})).toBeVisible();
 await page.getByRole('button',{name:'ล้างตัวกรอง',exact:true}).click();await selectFirst(page);
 await expect(page.getByRole('heading',{name:'รายงานผู้เรียน',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'ฝึกต่อจากครั้งก่อน',exact:true})).toHaveCount(0);
 expect([...backend.sessions.values()][0].payload.records.length).toBe(1);
});

test('a second browser resumes the central result and logout clears private cache while retaining trial data', async ({ page, context, browser }) => {
  const backend = mockBackend(); await backend.install(context);
  await login(page);
  await page.getByRole('button',{name:'หน้าหลัก',exact:true}).click();
  await page.getByRole('button', { name: 'เริ่มฝึกวันนี้', exact: true }).click();
  await page.getByRole('button', { name: 'เลือก ก', exact: true }).click();
  await page.getByRole('button', { name: 'พัก / กลับหน้าหลัก', exact: true }).click();
  await page.getByRole('button', { name: 'กลับหน้าหลัก', exact: true }).click();
  await openAccount(page);
  await page.locator('.topbar').getByRole('button',{name:'ออกจากระบบ',exact:true}).click();
  await expect(page.getByRole('heading',{name:'เข้าสู่ระบบ',exact:true})).toBeVisible();
  await studentLogin(page);
  await expect(page.locator('.stat-number').filter({ hasText: '0 ดวง' })).toBeVisible();
  await page.getByRole('button', { name: 'เริ่มฝึกวันนี้', exact: true }).click();
  await page.getByRole('button', { name: 'เลือก ก', exact: true }).click();
  await page.getByRole('button', { name: 'นักอ่านหนึ่ง', exact: true }).click();
  await page.getByRole('button', { name: 'ส่งผลตอนนี้', exact: true }).click();
  await expect.poll(() => [...backend.sessions.values()][0]?.payload.records.length).toBe(1);
  await expect(page.getByText('มี 1 รอบฝึกรอส่ง เก็บผลในเครื่องแล้ว',{exact:true})).toHaveCount(0);
  const secondContext = await browser.newContext(); await backend.install(secondContext);
  const anotherPage = await secondContext.newPage();
  await studentLogin(anotherPage);
  await anotherPage.getByRole('button', { name: 'ฝึกต่อจากครั้งก่อน', exact: true }).click();
  await expect(anotherPage.getByRole('button', { name: 'เลือก ก', exact: true })).toBeDisabled();
  await anotherPage.getByRole('button', { name: 'ข้อต่อไป', exact: true }).click();
  await expect(anotherPage.getByText('ข้อ 2 จาก 5', { exact: true })).toBeVisible();
  await secondContext.close();
  await page.locator('.topbar').getByRole('button', { name: 'ออกจากระบบ', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'เข้าสู่ระบบ', exact: true })).toBeVisible();
  await expect.poll(async () => (await keys(page)).filter(k => k.startsWith('workspace:')).length).toBe(0);
  expect(await keys(page)).toContain('snapshot');
  await expect(page.getByRole('button',{name:'เริ่มฝึกวันนี้',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'สำหรับครู',exact:true})).toHaveCount(0);
  expect(backend.sessions.size).toBe(1);
});

test('a conflicting draft is retained until the learner explicitly chooses the latest central result', async ({ page, context }) => {
  const backend = mockBackend(); await backend.install(context);
  await studentLogin(page);
  await page.getByRole('button', { name: 'เริ่มฝึกวันนี้', exact: true }).click();
  await page.getByRole('button', { name: 'เลือก ก', exact: true }).click();
  await page.getByRole('button', { name: 'นักอ่านหนึ่ง', exact: true }).click();
  await page.getByRole('button', { name: 'ส่งผลตอนนี้', exact: true }).click();
  await expect.poll(() => [...backend.sessions.values()][0]?.payload.records.length).toBe(1);
  const row = [...backend.sessions.values()][0]; row.revision += 1;
  await page.getByRole('button', { name: 'หน้าหลัก', exact: true }).click();
  await page.getByRole('button', { name: 'ฝึกต่อจากครั้งก่อน', exact: true }).click();
  await page.getByRole('button', { name: 'ข้อต่อไป', exact: true }).click();
  await page.getByRole('button', { name: 'เลือก ม', exact: true }).click();
  await page.getByRole('button', { name: 'นักอ่านหนึ่ง', exact: true }).click();
  await page.getByRole('button', { name: 'ส่งผลตอนนี้', exact: true }).click();
  await expect(page.getByText('ผลรอบนี้เปลี่ยนจากอีกเครื่อง', { exact: false })).toBeVisible();
  expect(row.payload.records.length).toBe(1);
  await page.getByRole('button', { name: 'โหลดผลล่าสุด', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'ใช้ผลล่าสุดจากฐานข้อมูล?' })).toBeVisible();
  await page.getByRole('button', { name: 'ยกเลิก', exact: true }).click();
  await expect(page.getByText('มี 1 รอบฝึกรอส่ง เก็บผลในเครื่องแล้ว', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'โหลดผลล่าสุด', exact: true }).click();
  await page.getByRole('button', { name: 'ยืนยันใช้ผลกลาง', exact: true }).click();
  await expect(page.getByText('มี 1 รอบฝึกรอส่ง เก็บผลในเครื่องแล้ว',{exact:true})).toHaveCount(0);
});

test('teacher management fits a mobile screen and has no automated accessibility violations', async ({ page, context }) => {
  const backend = mockBackend(); await backend.install(context);
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await expect(page.getByRole('button', { name: 'เพิ่มผู้เรียน', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/teacher-mobile.png', fullPage: true });
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  const violations = await page.evaluate(async () => (await (window as any).axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa','wcag22aa'] } })).violations.map((v: any) => ({ id: v.id, targets: v.nodes.map((n: any) => n.target) })));
  expect(violations).toEqual([]);
});

async function studentLogin(page: Page, code = '1234567890') {
  await page.goto('./'); await openAccount(page);
  await page.getByLabel('เลขประจำตัว', {exact:true}).fill(code);
  await page.getByLabel('รหัสผ่าน', {exact:true}).fill('112233445566');
  await page.getByRole('button', {name:'เข้าสู่ระบบ', exact:true}).click();
  await expect(page.getByRole('button', {name:/^(เริ่มฝึกวันนี้|ฝึกต่อจากครั้งก่อน)$/})).toBeVisible();
}

test('teacher registration displays credentials once and can reset or suspend a student account', async ({page,context}) => {
  const backend=mockBackend();await backend.install(context);await login(page);
  await page.getByRole('button',{name:'เพิ่มผู้เรียน',exact:true}).click();
  await page.getByLabel('เลขประจำตัว (4 หลัก)', {exact:true}).fill('0003');
  await page.getByLabel('ชื่อ–สกุล', {exact:true}).fill('นักอ่านสาม');
  await page.getByLabel('ชั้น',{exact:true}).selectOption('ป.2');
  await page.getByRole('button', {name:'บันทึกผู้เรียน', exact:true}).click();
  await expect(page.getByRole('region',{name:'รหัสเข้าเรียนที่สร้างแล้ว'})).toContainText('0003');
  await expect(page.getByRole('region',{name:'รหัสเข้าเรียนที่สร้างแล้ว'})).toContainText('RT-0003');
  await page.getByRole('button',{name:'เก็บรหัสแล้ว ปิดส่วนนี้',exact:true}).click();
  await expect(page.getByRole('region',{name:'รหัสเข้าเรียนที่สร้างแล้ว'})).toHaveCount(0);
  const card=page.locator('.roster-row').filter({hasText:'นักอ่านสาม'});
  await expect(card).toContainText('เลขประจำตัว 0003');
  await expect(card).toContainText('ป.2');
  await card.getByRole('button',{name:'จัดการบัญชี นักอ่านสาม',exact:true}).click();
  expect(backend.students.find(s=>s.code==='0003')?.class_name).toBe('ป.2');
  page.once('dialog',dialog=>dialog.accept());await card.getByRole('button',{name:'คืนรหัสผ่านเริ่มต้น',exact:true}).click();
  await expect(page.getByRole('region',{name:'รหัสเข้าเรียนที่สร้างแล้ว'})).toBeVisible();
  page.once('dialog',dialog=>dialog.accept());await card.getByRole('button',{name:'พักบัญชี',exact:true}).click();
  await expect(card.getByRole('button',{name:'เปิดบัญชี',exact:true})).toBeVisible();
});

test('students independently practice concurrently in two browsers and teacher sees their individual results', async ({page,context,browser}) => {
  const backend=mockBackend();await backend.install(context);await studentLogin(page);
  await expect(page.getByRole('button',{name:'สำหรับครู',exact:true})).toHaveCount(0);
  await expect(page.getByRole('navigation',{name:'เมนูสำหรับครู',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'บัญชีของฉัน',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'เริ่มฝึกวันนี้',exact:true}).click();
  await page.getByRole('button',{name:'เลือก ก',exact:true}).click();
  const secondContext=await browser.newContext();await backend.install(secondContext);const secondPage=await secondContext.newPage();
  await studentLogin(secondPage,'9876543210');
  await secondPage.getByRole('button',{name:'เริ่มฝึกวันนี้',exact:true}).click();
  await secondPage.getByRole('button',{name:'เลือก ก',exact:true}).click();
  await page.getByRole('button',{name:'นักอ่านหนึ่ง',exact:true}).click();await page.getByRole('button',{name:'ส่งผลตอนนี้',exact:true}).click();
  await secondPage.getByRole('button',{name:'นักอ่านสอง',exact:true}).click();await secondPage.getByRole('button',{name:'ส่งผลตอนนี้',exact:true}).click();
  await expect.poll(()=>[...backend.sessions.values()].filter(s=>s.payload.records.length===1).length).toBe(2);
  expect(new Set([...backend.sessions.values()].map(s=>s.student_id))).toEqual(new Set([first,second]));
  await page.reload();await page.getByRole('button',{name:'หน้าหลัก',exact:true}).click();await expect(page.getByRole('button',{name:'ฝึกต่อจากครั้งก่อน',exact:true})).toBeVisible();
  await expect(page.locator('.stat-number').filter({hasText:'1 ดวง'})).toBeVisible();
  await openAccount(page);await page.locator('.topbar').getByRole('button',{name:'ออกจากระบบ',exact:true}).click();
  await expect.poll(async()=>(await keys(page)).filter(k=>k.includes(pupil)).length).toBe(0);
  await login(page);await selectFirst(page);await expect(page.getByRole('button',{name:'ฝึกต่อจากครั้งก่อน',exact:true})).toHaveCount(0);await openTeacherReport(page);
  await expect(page.getByText('รายงานของ นักอ่านหนึ่ง · RT001',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'ดูผล',exact:true})).toHaveCount(1);
  await secondContext.close();
});

test('student login fits mobile and exposes no teacher management', async ({page,context})=>{
  const backend=mockBackend();await backend.install(context);await page.setViewportSize({width:390,height:844});
  await studentLogin(page);await openAccount(page);
  await expect(page.getByRole('heading',{name:'เพิ่มผู้เรียน',exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
  const violations=await page.evaluate(async()=>(await (window as any).axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map((v:any)=>v.id));
  expect(violations).toEqual([]);
});


test('signed-out visitors land on one login form and cannot see private pages',async({page,context})=>{
 const backend=mockBackend();await backend.install(context);
 for(const width of [1440,390,320]) {
  await page.setViewportSize({width,height:900});await page.goto('./');
  await expect(page.getByRole('heading',{name:'เข้าสู่ระบบ',exact:true})).toBeVisible();
  await expect(page.locator('form')).toHaveCount(1);
  for(const name of ['เริ่มฝึกวันนี้','บทเรียนของฉัน','รางวัลของฉัน','สำหรับครู','ผู้เรียน','ปรับการใช้งาน'])await expect(page.getByRole('button',{name,exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 await expect(page.getByLabel('เลขประจำตัว',{exact:true})).toBeVisible();
 await page.getByRole('radio',{name:'ครู',exact:true}).check();
 await expect(page.getByLabel('อีเมลครู',{exact:true})).toBeVisible();
 await expect(page.getByLabel('เลขประจำตัว',{exact:true})).toHaveCount(0);
 await expect(page.locator('form')).toHaveCount(1);
 await page.getByRole('button',{name:'เกี่ยวกับ ReadTech',exact:true}).click();
 await expect(page.getByRole('heading',{name:'เพื่อนร่วมทางการฝึกอ่าน',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'เริ่มฝึกวันนี้',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'กลับเข้าสู่ระบบ',exact:true}).click();
 await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
 const issues=await page.evaluate(async()=>(await (window as any).axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map((v:any)=>({id:v.id,targets:v.nodes.map((n:any)=>n.target)})));
 expect(issues).toEqual([]);
 await page.screenshot({path:'test-results/login-mobile.png',fullPage:true});
});

test('wrong credentials keep the visitor on the public login form',async({page,context})=>{
 const backend=mockBackend();await backend.install(context);
 await context.route('https://readtechtest.supabase.co/auth/v1/token**',route=>route.fulfill({status:400,json:{code:'invalid_credentials',msg:'Invalid login credentials'}}));
 await page.goto('./');await page.getByLabel('เลขประจำตัว',{exact:true}).fill('1234567890');await page.getByLabel('รหัสผ่าน',{exact:true}).fill('incorrect');
 await page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('ไม่ถูกต้อง');
 await expect(page.getByRole('button',{name:'เริ่มฝึกวันนี้',exact:true})).toHaveCount(0);
});


test('a failed role lookup keeps an authenticated account outside the protected workspace',async({page,context})=>{
 const backend=mockBackend();await backend.install(context);
 await context.route('https://readtechtest.supabase.co/rest/v1/readtech_teachers**',route=>route.fulfill({status:403,json:{code:'42501',message:'Access denied'}}));
 await login(page);
 await expect(page.getByRole('alert')).toContainText('ยังเปิดพื้นที่ส่วนตัวไม่ได้');
 await expect(page.getByRole('button',{name:'เริ่มฝึกวันนี้',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'สำหรับครู',exact:true})).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'เพิ่มผู้เรียน',exact:true})).toHaveCount(0);
});

test('four-digit student ID retains leading zero in the login identity',async({page,context})=>{
 const backend=mockBackend();await backend.install(context);
 backend.students[0].code='0123';backend.students[0].login_id='0123';
 let identity='';let password='';
 page.on('request',request=>{if(request.url().includes('/auth/v1/token')){const body=request.postDataJSON();identity=body.email;password=body.password;}});
 await page.goto('./');
 await page.getByLabel('เลขประจำตัว',{exact:true}).fill('0123');
 await page.getByLabel('รหัสผ่าน',{exact:true}).fill('RT-0123');
 await page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click();
 await expect(page.getByRole('button',{name:'เริ่มฝึกวันนี้',exact:true})).toBeVisible();
 expect(identity).toBe('student-0123@students.readup.invalid');expect(password).toBe('RT-0123');
 await openAccount(page);await expect(page.getByText('เลขประจำตัว 0123 · ป.1/1',{exact:true})).toBeVisible();
});

test('top navigation logout works for teachers and learners across screen sizes',async({page,context})=>{
 const backend=mockBackend();await backend.install(context);
 for(const role of ['teacher','student']) {
  for(const width of [1440,390,320]) {
   backend.sessions.clear();
   await page.setViewportSize({width,height:900});
   if(role==='teacher')await login(page);else await studentLogin(page);
   const topbar=page.locator('.topbar');
   await expect(topbar.getByRole('button',{name:'ออกจากระบบ',exact:true})).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   if(role==='student') {
    await page.getByRole('button',{name:'เริ่มฝึกวันนี้',exact:true}).click();
    await expect(topbar.getByRole('button',{name:'ออกจากระบบ',exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   }
   await topbar.getByRole('button',{name:'ออกจากระบบ',exact:true}).click();
   if(role==='student') {
    const warning=page.getByRole('dialog',{name:'ยังมีผลในเครื่องรอส่ง',exact:true});
    await expect(page.getByRole('heading',{name:'เข้าสู่ระบบ',exact:true}).or(warning)).toBeVisible();
    if(await warning.isVisible())await warning.getByRole('button',{name:'ยืนยันออกจากระบบ',exact:true}).click();
   }
   await expect(page.getByRole('heading',{name:'เข้าสู่ระบบ',exact:true})).toBeVisible();
   await expect(page.getByRole('navigation',{name:'เมนูบัญชี',exact:true})).toHaveCount(0);
  }
 }
});

test('top navigation logout preserves the pending-results warning and cancellation',async({page,context})=>{
 const backend=mockBackend();backend.setFailWrites(true);await backend.install(context);
 await studentLogin(page);await page.getByRole('button',{name:'เริ่มฝึกวันนี้',exact:true}).click();
 await page.getByRole('button',{name:'เลือก ก',exact:true}).click();
 await expect(page.locator('.topbar')).toContainText('รอส่ง');
 await page.locator('.topbar').getByRole('button',{name:'ออกจากระบบ',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'ยังมีผลในเครื่องรอส่ง',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'กลับไปส่งผล',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'ข้อต่อไป',exact:true})).toBeVisible();
 await page.locator('.topbar').getByRole('button',{name:'ออกจากระบบ',exact:true}).click();
 await page.getByRole('button',{name:'ยืนยันออกจากระบบ',exact:true}).click();
 await expect(page.getByRole('heading',{name:'เข้าสู่ระบบ',exact:true})).toBeVisible();
});

test('learner account shows own practice history, stars and progress and can resume',async({page,context})=>{
 const backend=mockBackend();await backend.install(context);await studentLogin(page);await openAccount(page);
 const history=page.getByRole('region',{name:'ประวัติการฝึกของฉัน',exact:true});
 await expect(history.getByRole('heading',{name:'ยังไม่มีประวัติการฝึก',exact:true})).toBeVisible();
 await history.getByRole('button',{name:'เลือกบทเรียน',exact:true}).click();
 await page.getByRole('button',{name:'เริ่มฝึก รู้จักพยัญชนะชุดแรก',exact:true}).click();
 await page.getByRole('button',{name:'เลือก ก',exact:true}).click();
 await page.locator('.topbar .learner-chip').click();
 await expect(history).toContainText('รู้จักพยัญชนะชุดแรก');
 await expect(history).toContainText('ทำไป 1 / 5 ข้อ');
 await expect(history.locator('.practice-stars')).toHaveText('1 ดวง');
 await expect(history).toContainText('กำลังฝึก');
 for(const width of [1440,390,320]) {
  await page.setViewportSize({width,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 await history.getByRole('button',{name:'ฝึกต่อ',exact:true}).click();
 await expect(page.getByRole('button',{name:'เลือก ก',exact:true})).toBeDisabled();
 const lesson=curriculum.lessons.find(l=>l.id===1)!;
 for(let i=1;i<lesson.questions.length;i++) {
  await page.getByRole('button',{name:'ข้อต่อไป',exact:true}).click();
  await page.getByRole('button',{name:`เลือก ${lesson.questions[i].letter}`,exact:true}).click();
 }
 await page.getByRole('button',{name:'ดูรางวัลของฉัน',exact:true}).click();await openAccount(page);
 await expect(history).toContainText('ฝึกครบแล้ว');await expect(history.locator('.practice-stars')).toHaveText('5 ดวง');
 await expect(history.getByRole('button',{name:'ฝึกต่อ',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'ส่งผลตอนนี้',exact:true}).click();
 await expect(page.locator('.topbar .local-badge')).toHaveText('บันทึกกลางแล้ว');
 await page.reload();await expect(page.getByRole('button',{name:'บัญชีของฉัน',exact:true})).toBeVisible();await openAccount(page);await expect(history).toContainText('ฝึกครบแล้ว');
 await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
 const violations=await page.evaluate(async()=>(await (window as any).axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map((v:any)=>v.id));expect(violations).toEqual([]);
 await page.locator('.topbar').getByRole('button',{name:'ออกจากระบบ',exact:true}).click();
 await studentLogin(page,'9876543210');await openAccount(page);await expect(history).toContainText('ยังไม่มีประวัติการฝึก');
 await page.locator('.topbar').getByRole('button',{name:'ออกจากระบบ',exact:true}).click();
 await login(page);await expect(history).toHaveCount(0);
});

test('teacher forgot password opens with an empty email and shows the request result inside the dialog',async({page,context})=>{
 const backend=mockBackend();await backend.install(context);let requestBody:any=null;let requestUrl='';
 await context.route('https://readtechtest.supabase.co/auth/v1/recover**',route=>{requestBody=route.request().postDataJSON();requestUrl=route.request().url();return route.fulfill({json:{}});});
 await page.goto('./');await page.getByRole('radio',{name:'ครู',exact:true}).check();
 await expect(page.getByRole('button',{name:'ลืมรหัสผ่าน',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'ลืมรหัสผ่าน',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'ลืมรหัสผ่านครู',exact:true});await expect(dialog).toBeVisible();
 await dialog.getByRole('button',{name:'ส่งลิงก์เปลี่ยนรหัสผ่าน',exact:true}).click();expect(requestBody).toBeNull();
 await dialog.getByLabel('อีเมลสำหรับรับลิงก์',{exact:true}).fill('teacher@example.test');
 await dialog.getByRole('button',{name:'ส่งลิงก์เปลี่ยนรหัสผ่าน',exact:true}).click();
 await expect(dialog.getByRole('status')).toContainText('ส่งคำขอแล้ว');
 expect(requestBody.email).toBe('teacher@example.test');
 expect(new URL(requestUrl).searchParams.get('redirect_to')).toBe('http://127.0.0.1:5173/ReadUP/');
 await expect(dialog.getByRole('button',{name:'ส่งคำขอแล้ว',exact:true})).toBeDisabled();
 await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
 const violations=await page.evaluate(async()=>(await (window as any).axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map((v:any)=>v.id));expect(violations).toEqual([]);
 await dialog.getByRole('button',{name:'กลับเข้าสู่ระบบ',exact:true}).click();await expect(dialog).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'เข้าสู่ระบบ',exact:true})).toBeVisible();
});

for(const [code,status,message] of [['over_email_send_rate_limit',429,'ส่งคำขอถี่เกินไป'],['email_address_not_authorized',403,'ระบบยังส่งอีเมลให้บัญชีนี้ไม่ได้'],['unexpected_failure',500,'ส่งลิงก์ไม่สำเร็จ']] as const) {
 test(`password reset displays ${code} and permits retry`,async({page,context})=>{
  const backend=mockBackend();await backend.install(context);let fail=true;
  await context.route('https://readtechtest.supabase.co/auth/v1/recover**',route=>route.fulfill({status:fail?status:200,json:fail?{error_code:code,msg:'Request failed'}:{}}));
  await page.setViewportSize({width:320,height:900});await page.goto('./');await page.getByRole('radio',{name:'ครู',exact:true}).check();
  await page.getByLabel('อีเมลครู',{exact:true}).fill('teacher@example.test');await page.getByRole('button',{name:'ลืมรหัสผ่าน',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'ลืมรหัสผ่านครู',exact:true});
  await expect(dialog.getByLabel('อีเมลสำหรับรับลิงก์',{exact:true})).toHaveValue('teacher@example.test');
  await dialog.getByRole('button',{name:'ส่งลิงก์เปลี่ยนรหัสผ่าน',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText(message);
  await expect(dialog.getByRole('button',{name:'ส่งลิงก์เปลี่ยนรหัสผ่าน',exact:true})).toBeEnabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  fail=false;await dialog.getByRole('button',{name:'ส่งลิงก์เปลี่ยนรหัสผ่าน',exact:true}).click();await expect(dialog.getByRole('status')).toContainText('ส่งคำขอแล้ว');
 });
}

test('teacher report without learners offers a route to registration',async({page,context})=>{
 const backend=mockBackend();backend.students.splice(0);await backend.install(context);await login(page);
 await page.getByRole('button',{name:'รายงานผู้เรียน',exact:true}).click();
 await expect(page.getByRole('heading',{name:'ยังไม่มีผู้เรียนในความดูแล',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'เพิ่มผู้เรียน',exact:true}).click();await expect(page.getByRole('button',{name:'เพิ่มผู้เรียน',exact:true})).toBeVisible();
});

test('large teacher roster searches and combines filters across pages on desktop and mobile',async({page,context})=>{
 const backend=mockBackend();
 for(let i=3;i<=125;i++)backend.students.push({id:`roster-${i}`,teacher_id:owner,auth_user_id:`learner-${i}`,login_id:String(i).padStart(4,'0'),login_enabled:i%3!==0,class_name:i%2===0?'ป.2/1':'ป.3/2',code:String(i).padStart(4,'0'),display_name:`ผู้เรียนทดสอบ ${i}`,created_at:'2026-10-06T00:00:00Z'});
 // Include a legacy account without a class or independent login.
 backend.students[backend.students.length-1].login_id='';backend.students[backend.students.length-1].class_name='';
 await backend.install(context);await login(page);
 const roster=page.getByRole('region',{name:'ผู้เรียนของฉัน 125 คน',exact:true});
 await expect(roster).toBeVisible();await expect(roster.locator('.roster-row')).toHaveCount(10);
 await expect(page.getByLabel('เลขประจำตัว (4 หลัก)',{exact:true})).toHaveCount(0);
 await expect(roster.getByRole('status')).toContainText('แสดง 1–10');
 await roster.getByRole('button',{name:'รายชื่อหน้าถัดไป',exact:true}).click();
 await expect(roster.getByRole('status')).toContainText('แสดง 11–20');
 await expect(roster.locator('.roster-row').first()).toContainText('0013');
 await roster.getByLabel('ค้นหาผู้เรียน',{exact:true}).fill('  0123  ');
 await expect(roster.locator('.roster-row')).toHaveCount(1);await expect(roster.locator('.roster-row')).toContainText('ผู้เรียนทดสอบ 123');
 await expect(roster.getByRole('status')).toContainText('พบ 1 จาก 125 คน');
 await roster.getByRole('button',{name:'ล้างตัวกรอง',exact:true}).click();
 await roster.getByLabel('ชั้นเรียน',{exact:true}).selectOption('ป.2');
 await roster.getByLabel('สถานะบัญชี',{exact:true}).selectOption('paused');
 await expect(roster.getByRole('status')).toContainText('พบ 20 จาก 125 คน');
 await expect(roster.locator('.roster-row')).toHaveCount(10);
 for(const row of await roster.locator('.roster-row').all()){await expect(row).toContainText('ป.2/1');await expect(row.locator('.roster-status')).toHaveText('พักบัญชี');}
 await roster.getByLabel('ค้นหาผู้เรียน',{exact:true}).fill('ไม่มีชื่อในระบบ');
 await expect(roster.getByRole('heading',{name:'ไม่พบผู้เรียนที่ตรงกับตัวกรอง',exact:true})).toBeVisible();
 await expect(roster.locator('.roster-row')).toHaveCount(0);
 await roster.getByRole('button',{name:'ล้างตัวกรอง',exact:true}).click();
 await roster.getByLabel('แสดงต่อหน้า',{exact:true}).selectOption('50');await expect(roster.locator('.roster-row')).toHaveCount(50);
 await roster.getByRole('button',{name:'รายชื่อหน้าถัดไป',exact:true}).click();await roster.getByRole('button',{name:'รายชื่อหน้าถัดไป',exact:true}).click();
 await expect(roster.locator('.roster-row')).toHaveCount(25);await expect(roster.getByRole('button',{name:'รายชื่อหน้าถัดไป',exact:true})).toBeDisabled();
 await roster.getByLabel('สถานะบัญชี',{exact:true}).selectOption('unregistered');await expect(roster.locator('.roster-row')).toHaveCount(1);
 await roster.getByLabel('ชั้นเรียน',{exact:true}).selectOption('__none__');await expect(roster.locator('.roster-row')).toContainText('0125');
 await roster.getByRole('button',{name:'ล้างตัวกรอง',exact:true}).click();
 await roster.getByLabel('แสดงต่อหน้า',{exact:true}).selectOption('10');
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect(roster.getByLabel('ค้นหาผู้เรียน',{exact:true})).toBeVisible();
  await expect(roster.locator('.roster-row')).toHaveCount(10);
 }
 await page.screenshot({path:'test-results/teacher-roster-mobile.png',fullPage:true});
 await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
 const violations=await page.evaluate(async()=>(await(window as any).axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map((v:any)=>({id:v.id,targets:v.nodes.map((n:any)=>n.target)})));
 expect(violations).toEqual([]);
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'test-results/teacher-roster-desktop.png',fullPage:true});
});

test('compact registration closes on success and keeps fields for a retry after an error',async({page,context})=>{
 const backend=mockBackend();await backend.install(context);await login(page);
 await page.getByRole('button',{name:'เพิ่มผู้เรียน',exact:true}).click();
 await expect(page.getByLabel('เลขประจำตัว (4 หลัก)',{exact:true})).toBeFocused();
 await page.getByLabel('เลขประจำตัว (4 หลัก)',{exact:true}).fill('0003');
 await page.getByLabel('ชื่อ–สกุล',{exact:true}).fill('นักอ่านสาม');await page.getByLabel('ชั้น',{exact:true}).selectOption('ป.2');
 let fail=true;
 await context.route('**/functions/v1/readtech-student-accounts',async route=>{if(fail)return route.fulfill({status:409,json:{error:'เลขประจำตัวนี้มีบัญชีแล้ว'}});return route.fallback();});
 await page.getByRole('button',{name:'บันทึกผู้เรียน',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('เลขประจำตัวนี้มีบัญชีแล้ว');
 await expect(page.getByLabel('เลขประจำตัว (4 หลัก)',{exact:true})).toHaveValue('0003');
 fail=false;await page.getByRole('button',{name:'บันทึกผู้เรียน',exact:true}).click();
 await expect(page.getByRole('region',{name:'รหัสเข้าเรียนที่สร้างแล้ว'})).toContainText('RT-0003');
 await expect(page.getByLabel('เลขประจำตัว (4 หลัก)',{exact:true})).toHaveCount(0);
 await expect(page.getByLabel('ค้นหาผู้เรียน',{exact:true})).toHaveValue('0003');
 await expect(page.locator('.roster-row')).toHaveCount(1);
 await expect(page.getByRole('button',{name:'เพิ่มผู้เรียน',exact:true})).toBeFocused();
 await page.getByRole('button',{name:'เพิ่มผู้เรียน',exact:true}).click();
 await expect(page.getByLabel('เลขประจำตัว (4 หลัก)',{exact:true})).toHaveValue('');
 await page.getByRole('button',{name:'ยกเลิก',exact:true}).click();await expect(page.getByLabel('เลขประจำตัว (4 หลัก)',{exact:true})).toHaveCount(0);
});

test('teacher sees reports only while selected and can edit a student without losing their history',async({page,context})=>{
 const backend=mockBackend();backend.students[0].code='0123';backend.students[0].login_id='0123';
 const id='66666666-6666-4666-8666-666666666666';
 const payload={id,lessonId:1,contentVersion:1,startedAt:Date.now()-1000,status:'active',questionIndices:[0,1,2,3,4],index:0,records:[{questionIndex:0,letter:'ก',word:'ไก่',category:'independent',wrongAttempts:0,hintLevel:0,activeMs:1}],wrongAttempts:0,hintLevel:0,currentMs:0,answered:true};
 backend.sessions.set(id,{id,owner,student_id:first,revision:1,payload});
 await backend.install(context);await login(page);await selectFirst(page);
 await expect(page.getByText('รายงานของ นักอ่านหนึ่ง · 0123',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'ทดลองบทเรียนแรก',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'ฝึกต่อจากครั้งก่อน',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'หน้าหลัก',exact:true}).click();await expect(page.getByRole('heading',{name:'รายงานผู้เรียน',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'บทเรียนของฉัน',exact:true}).click();
 await expect(page.getByRole('button',{name:/^เริ่มฝึก /})).toHaveCount(0);
 await page.reload();await expect(page.getByRole('heading',{name:'รายงานผู้เรียน',exact:true})).toBeVisible();
 expect(backend.requests.filter(path=>path==='/rest/v1/rpc/readtech_save_session')).toHaveLength(0);
 await openAccount(page);await page.getByRole('button',{name:'จัดการบัญชี นักอ่านหนึ่ง',exact:true}).click();await page.getByRole('button',{name:'แก้ไขข้อมูล',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'แก้ไขข้อมูลผู้เรียน',exact:true});
 await expect(dialog.getByLabel('เลขประจำตัว',{exact:true})).toHaveValue('0123');
 await dialog.getByLabel('ชื่อ–สกุล',{exact:true}).fill('ชื่อที่แก้ไข');await dialog.getByLabel('ชั้น',{exact:true}).selectOption('ป.3');
 await dialog.getByLabel('เลขประจำตัว',{exact:true}).fill('RT002'); // Native four-digit validation will also block invalid values.
 await dialog.getByRole('button',{name:'บันทึกการแก้ไข',exact:true}).click();await expect(dialog).toBeVisible();
 await dialog.getByLabel('เลขประจำตัว',{exact:true}).fill('0456');
 await expect(dialog).toContainText('รหัสผ่านยังเป็นรหัสเดิม');
 for(const width of [390,320]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
 expect(await page.evaluate(async()=>(await(window as any).axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map((v:any)=>v.id))).toEqual([]);
 await dialog.getByRole('button',{name:'บันทึกการแก้ไข',exact:true}).click();await expect(dialog).toHaveCount(0);
 await expect(page.locator('.roster-row')).toContainText('ชื่อที่แก้ไข');await expect(page.locator('.roster-row')).toContainText('0456');await expect(page.locator('.roster-row')).toContainText('ป.3');
 expect(backend.students[0].id).toBe(first);expect(backend.students[0].login_id).toBe('0456');expect(backend.sessions.get(id).payload).toEqual(payload);
 await page.getByRole('button',{name:'เลือกผู้เรียน ชื่อที่แก้ไข',exact:true}).click();await expect(page.getByText('รายงานของ ชื่อที่แก้ไข · 0456',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'ดูผล',exact:true}).click();await page.getByRole('textbox',{name:'ข้อสังเกต (ไม่ใส่ชื่อจริงหรือข้อมูลสุขภาพ)'}).fill('ครูดูแล้ว');
 await expect.poll(()=>backend.sessions.get(id).payload.observation?.note).toBe('ครูดูแล้ว');
 expect(backend.sessions.get(id).payload.records).toEqual(payload.records);
});

test('edit dialog retains fields on duplicate ID or server failure and cancellation leaves the profile unchanged',async({page,context})=>{
 const backend=mockBackend();backend.students[0].code='0123';backend.students[0].login_id='0123';backend.students[1].code='0124';backend.students[1].login_id='0124';
 await backend.install(context);await login(page);
 await page.getByRole('button',{name:'จัดการบัญชี นักอ่านหนึ่ง',exact:true}).click();await page.getByRole('button',{name:'แก้ไขข้อมูล',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'แก้ไขข้อมูลผู้เรียน',exact:true});
 await dialog.getByLabel('เลขประจำตัว',{exact:true}).fill('0124');await dialog.getByRole('button',{name:'บันทึกการแก้ไข',exact:true}).click();
 await expect(dialog.getByRole('alert')).toContainText('เลขประจำตัวนี้มีอยู่แล้ว');await expect(dialog.getByLabel('เลขประจำตัว',{exact:true})).toHaveValue('0124');
 await context.route('**/functions/v1/readtech-student-accounts',route=>route.fulfill({status:503,json:{error:'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง'}}));
 await dialog.getByLabel('เลขประจำตัว',{exact:true}).fill('0125');await dialog.getByRole('button',{name:'บันทึกการแก้ไข',exact:true}).click();
 await expect(dialog.getByRole('alert')).toContainText('บันทึกไม่สำเร็จ');
 await dialog.getByRole('button',{name:'ยกเลิก',exact:true}).click();await expect(dialog).toHaveCount(0);expect(backend.students[0].code).toBe('0123');
 await expect(page.getByRole('button',{name:'แก้ไขข้อมูล',exact:true})).toBeFocused();
});

test('registration and editing use the same six master grade choices and preserve legacy classroom data until saved',async({page,context})=>{
 const backend=mockBackend();await backend.install(context);await login(page);
 await page.getByRole('button',{name:'เพิ่มผู้เรียน',exact:true}).click();
 const registration=page.getByRole('region',{name:'ลงทะเบียนผู้เรียน',exact:true});
 const grade=registration.getByRole('combobox',{name:'ชั้น',exact:true});
 await expect(grade.locator('option')).toHaveText(['เลือกชั้น','ป.1','ป.2','ป.3','ป.4','ป.5','ป.6']);
 await registration.getByLabel('เลขประจำตัว (4 หลัก)',{exact:true}).fill('0003');await registration.getByLabel('ชื่อ–สกุล',{exact:true}).fill('นักอ่านชั้นหก');
 const before=backend.requests.filter(path=>path==='/functions/v1/readtech-student-accounts').length;
 await registration.getByRole('button',{name:'บันทึกผู้เรียน',exact:true}).click();
 expect(backend.requests.filter(path=>path==='/functions/v1/readtech-student-accounts').length).toBe(before);
 await grade.selectOption('ป.6');await registration.getByRole('button',{name:'บันทึกผู้เรียน',exact:true}).click();
 await expect(page.locator('.roster-row')).toContainText('ป.6');expect(backend.students.find(s=>s.code==='0003')?.class_name).toBe('ป.6');
 await page.getByRole('button',{name:'ล้างตัวกรอง',exact:true}).click();
 await page.getByRole('button',{name:'จัดการบัญชี นักอ่านหนึ่ง',exact:true}).click();await page.getByRole('button',{name:'แก้ไขข้อมูล',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'แก้ไขข้อมูลผู้เรียน',exact:true});const editGrade=dialog.getByRole('combobox',{name:'ชั้น',exact:true});
 await expect(editGrade.locator('option')).toHaveText(['เลือกชั้น','ป.1','ป.2','ป.3','ป.4','ป.5','ป.6']);await expect(editGrade).toHaveValue('ป.1');
 await dialog.getByRole('button',{name:'ยกเลิก',exact:true}).click();expect(backend.students[0].class_name).toBe('ป.1/1');
 await page.getByRole('button',{name:'แก้ไขข้อมูล',exact:true}).click();await dialog.getByRole('combobox',{name:'ชั้น',exact:true}).selectOption('ป.4');
 await dialog.getByRole('button',{name:'บันทึกการแก้ไข',exact:true}).click();await expect(dialog).toHaveCount(0);expect(backend.students[0].class_name).toBe('ป.4');
});

test('report grade filter limits learners, retains matching selection and clears a report outside the selected grade',async({page,context})=>{
 const backend=mockBackend();backend.students[1].class_name='ป.2';await backend.install(context);await login(page);await selectFirst(page);
 const grade=page.getByRole('combobox',{name:'กรองชั้นเรียน',exact:true});const students=page.getByRole('combobox',{name:'ผู้เรียนที่ต้องการดูรายงาน',exact:true});
 await expect(grade.locator('option')).toHaveText(['ทุกชั้น','ป.1','ป.2','ป.3','ป.4','ป.5','ป.6']);
 await grade.selectOption('ป.1');await expect(students).toHaveValue(first);await expect(students.locator('option')).toHaveCount(2);
 await expect(page.getByText('รายงานของ นักอ่านหนึ่ง · RT001',{exact:true})).toBeVisible();
 await grade.selectOption('ป.2');await expect(grade).toHaveValue('ป.2');await expect(students).toHaveValue('');await expect(students.locator('option')).toHaveCount(2);
 await expect(page.getByText('รายงานของ นักอ่านหนึ่ง · RT001',{exact:true})).toHaveCount(0);
 await students.selectOption(second);await expect(grade).toHaveValue('ป.2');await expect(page.getByText('รายงานของ นักอ่านสอง · RT002',{exact:true})).toBeVisible();
 await grade.selectOption('ป.6');await expect(grade).toHaveValue('ป.6');await expect(students).toBeDisabled();await expect(page.getByText('พบ 0 คนจากตัวกรองชั้นเรียน',{exact:true})).toBeVisible();
 await expect(page.getByText('รายงานของ นักอ่านสอง · RT002',{exact:true})).toHaveCount(0);
 await grade.selectOption('');await expect(students).toBeEnabled();await expect(students.locator('option')).toHaveCount(3);
 await students.selectOption(first);await grade.selectOption('ป.1');
 for(const width of [1440,390,320]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(grade).toBeVisible();await expect(students).toBeVisible();}
 await page.screenshot({path:'test-results/report-grade-filter-mobile.png',fullPage:true});
 await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
 expect(await page.evaluate(async()=>(await(window as any).axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map((v:any)=>({id:v.id,nodes:v.nodes.map((n:any)=>({target:n.target,failureSummary:n.failureSummary}))})))).toEqual([]);
});
