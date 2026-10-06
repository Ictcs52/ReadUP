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
function mockBackend() {
  const students = [
    { id: first, teacher_id: owner, code: 'RT001', display_name: 'นักอ่านหนึ่ง', created_at: '2026-10-06T00:00:00Z' },
    { id: second, teacher_id: owner, code: 'RT002', display_name: 'นักอ่านสอง', created_at: '2026-10-06T00:01:00Z' },
  ];
  const sessions = new Map<string, any>();
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
        uid = body.email === 'other@example.test' ? other : body.email === 'unknown@example.test' ? unauthorized : owner;
        return route.fulfill({ json: { access_token: token(uid), token_type: 'bearer', refresh_token: 'test-refresh', expires_in: 3600, user: { id: uid, email: body.email, aud: 'authenticated', role: 'authenticated', created_at: '2026-10-06T00:00:00Z', app_metadata: {}, user_metadata: {} } } });
      }
      if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204 });
      if (url.pathname === '/rest/v1/readtech_teachers') return route.fulfill({ json: uid === unauthorized ? [] : [{ id: uid, display_name: uid === owner ? 'ครูหนึ่ง' : 'ครูสอง', active: true }] });
      if (url.pathname === '/rest/v1/readtech_students') {
        if (request.method() === 'POST') {
          const value = { ...body, id: '77777777-7777-4777-8777-777777777777', created_at: '2026-10-06T00:02:00Z' };
          students.push(value);
          return route.fulfill({ status: 201, json: value });
        }
        return route.fulfill({ json: students.filter(s => s.teacher_id === uid) });
      }
      if (url.pathname === '/rest/v1/readtech_sessions') {
        const studentId = url.searchParams.get('student_id')?.replace('eq.', '');
        return route.fulfill({ json: [...sessions.values()].filter(s => s.owner === uid && s.student_id === studentId).map(({ owner: _, student_id: __, ...row }) => row) });
      }
      if (url.pathname === '/rest/v1/rpc/readtech_save_session') {
        if (failWrites) return route.fulfill({ status: 503, json: { code: '08006', message: 'Connection unavailable' } });
        const previous = sessions.get(body.p_payload.id);
        if ((previous?.revision ?? 0) !== body.p_expected_revision) return route.fulfill({ status: 409, json: { code: '40001', message: 'Session changed on another device' } });
        const row = { id: body.p_payload.id, payload: body.p_payload, revision: (previous?.revision ?? 0)+1, owner: uid, student_id: body.p_student_id };
        sessions.set(row.id, row);
        return route.fulfill({ json: { id: row.id, revision: row.revision } });
      }
      return route.fulfill({ status: 404, json: { message: 'Unexpected endpoint' } });
    });
  }
  return { install, students, sessions, requests, setFailWrites: (value: boolean) => { failWrites = value; } };
}
async function openAccount(page: Page) {
  await page.getByRole('button', { name: 'ผู้เรียน', exact: true }).click();
}
async function login(page: Page, email = 'teacher@example.test') {
  await page.goto('./'); await openAccount(page);
  await page.getByLabel('อีเมลครู', { exact: true }).fill(email);
  await page.getByLabel('รหัสผ่าน', { exact: true }).fill('test-password');
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();
}
async function selectFirst(page: Page) {
  await page.getByRole('button', { name: 'เลือกผู้เรียน นักอ่านหนึ่ง', exact: true }).click();
  await expect(page.getByRole('button', { name: 'เริ่มฝึกวันนี้', exact: true })).toBeVisible();
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

test('an authenticated but unapproved account cannot open student management', async ({ page, context }) => {
  const backend = mockBackend(); await backend.install(context);
  await login(page, 'unknown@example.test');
  await expect(page.getByRole('alert')).toContainText('ยังไม่ได้รับสิทธิ์ครู');
  await expect(page.getByRole('heading', { name: 'เพิ่มผู้เรียน', exact: true })).toHaveCount(0);
  expect(backend.requests).not.toContain('/rest/v1/readtech_students');
  await page.getByRole('button',{name:'สำหรับครู',exact:true}).click();
  await expect(page.getByRole('heading',{name:'พื้นที่สำหรับครู',exact:true})).toHaveCount(0);
});

test('teacher reports require approved login and a selected learner on desktop and mobile', async ({ page, context }) => {
  const backend = mockBackend(); await backend.install(context);
  for (const width of [1440,390]) {
    await page.setViewportSize({width,height:900}); await page.goto('./');
    await page.getByRole('button',{name:'สำหรับครู',exact:true}).click();
    await expect(page.getByRole('heading',{name:'เข้าสู่ระบบครู',exact:true})).toBeVisible();
    await expect(page.getByRole('heading',{name:'พื้นที่สำหรับครู',exact:true})).toHaveCount(0);
  }
  await page.setViewportSize({width:1440,height:1000}); await login(page);
  await expect(page.getByRole('heading',{name:'เพิ่มผู้เรียน',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'สำหรับครู',exact:true}).click();
  await expect(page.getByRole('heading',{name:'ผู้เรียนและบัญชีครู',exact:true})).toBeVisible();
  await selectFirst(page);
  await page.getByRole('button',{name:'สำหรับครู',exact:true}).click();
  await expect(page.getByRole('heading',{name:'พื้นที่สำหรับครู',exact:true})).toBeVisible();
  await expect(page.getByText('รายงานของ นักอ่านหนึ่ง · RT001',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'ผู้เรียน',exact:true}).click();
  await page.getByRole('button',{name:'ออกจากระบบ',exact:true}).click();
  await page.getByRole('button',{name:'สำหรับครู',exact:true}).click();
  await expect(page.getByRole('heading',{name:'เข้าสู่ระบบครู',exact:true})).toBeVisible();
});

test('approved teacher report exports learner identity and protects CSV notes from formulas', async ({ page, context }) => {
  const backend = mockBackend(); await backend.install(context); await login(page); await selectFirst(page);
  await page.getByRole('button',{name:'เริ่มฝึกวันนี้',exact:true}).click();
  const lesson=curriculum.lessons.find(l=>l.id===1)!;
  for (let i=0;i<lesson.questions.length;i++) {
    await page.getByRole('button',{name:`เลือก ${lesson.questions[i].letter}`,exact:true}).click();
    await page.getByRole('button',{name:i===lesson.questions.length-1?'ดูรางวัลของฉัน':'ข้อต่อไป',exact:true}).click();
  }
  await page.getByRole('button',{name:'สำหรับครู',exact:true}).click();
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
  await expect(page.getByRole('heading', { name: 'เข้าสู่ระบบครู', exact: true })).toBeVisible();
  await expect(page.getByLabel('Project URL', { exact: true })).toHaveCount(0);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('readtech-cloud-config')!));
  expect(saved.url).toBe('https://readtechtest.supabase.co');
  await context.route('**/cloud-config.json', route => route.abort());
  await page.reload(); await openAccount(page);
  await expect(page.getByRole('heading', { name: 'เข้าสู่ระบบครู', exact: true })).toBeVisible();
  await expect(page.getByLabel('Project URL', { exact: true })).toHaveCount(0);
});

test('profiles isolate local drafts, creating a student works, and failed writes persist across reload', async ({ page, context }) => {
  const backend = mockBackend(); backend.setFailWrites(true); await backend.install(context);
  await login(page); await selectFirst(page);
  await page.getByRole('button', { name: 'เริ่มฝึกวันนี้', exact: true }).click();
  await page.getByRole('button', { name: 'เลือก ก', exact: true }).click();
  await page.getByRole('button', { name: 'นักอ่านหนึ่ง', exact: true }).click();
  await page.getByRole('button', { name: 'เลือกผู้เรียน นักอ่านสอง', exact: true }).click();
  await expect(page.getByRole('button', { name: 'เริ่มฝึกวันนี้', exact: true })).toBeVisible();
  await expect(page.locator('.stat-number').filter({ hasText: '0 ดวง' })).toBeVisible();
  await openAccount(page);
  await page.getByLabel('รหัสผู้เรียน', { exact: true }).fill('RT003');
  await page.getByLabel('ชื่อเรียกผู้เรียน', { exact: true }).fill('นักอ่านสาม');
  await page.getByRole('button', { name: 'เพิ่มผู้เรียน', exact: true }).click();
  await expect(page.getByRole('button', { name: 'เลือกผู้เรียน นักอ่านสาม' })).toBeVisible();
  await page.getByRole('button', { name: 'เลือกผู้เรียน นักอ่านหนึ่ง', exact: true }).click();
  await expect(page.getByRole('button', { name: 'ฝึกต่อจากครั้งก่อน', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'ฝึกต่อจากครั้งก่อน', exact: true })).toBeVisible();
  backend.setFailWrites(false);
  await openAccount(page); await page.getByRole('button', { name: 'ส่งผลตอนนี้', exact: true }).click();
  await expect.poll(() => [...backend.sessions.values()][0]?.payload.records.length).toBe(1);
  expect([...backend.sessions.values()][0].student_id).toBe(first);
});

test('a second browser resumes the central result and logout clears private cache while retaining trial data', async ({ page, context, browser }) => {
  const backend = mockBackend(); await backend.install(context);
  await page.goto('./');
  await page.getByRole('button', { name: 'เริ่มฝึกวันนี้', exact: true }).click();
  await page.getByRole('button', { name: 'เลือก ก', exact: true }).click();
  await page.getByRole('button', { name: 'พัก / กลับหน้าหลัก', exact: true }).click();
  await page.getByRole('button', { name: 'กลับหน้าหลัก', exact: true }).click();
  await openAccount(page);
  await page.getByLabel('อีเมลครู', { exact: true }).fill('teacher@example.test');
  await page.getByLabel('รหัสผ่าน', { exact: true }).fill('test-password');
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();
  await selectFirst(page);
  await expect(page.locator('.stat-number').filter({ hasText: '0 ดวง' })).toBeVisible();
  await page.getByRole('button', { name: 'เริ่มฝึกวันนี้', exact: true }).click();
  await page.getByRole('button', { name: 'เลือก ก', exact: true }).click();
  await page.getByRole('button', { name: 'นักอ่านหนึ่ง', exact: true }).click();
  await page.getByRole('button', { name: 'ส่งผลตอนนี้', exact: true }).click();
  await expect.poll(() => [...backend.sessions.values()][0]?.payload.records.length).toBe(1);
  await expect(page.getByText('ผลที่บันทึกของผู้เรียนนี้ส่งเข้าฐานข้อมูลแล้ว', { exact: true })).toBeVisible();
  const secondContext = await browser.newContext(); await backend.install(secondContext);
  const anotherPage = await secondContext.newPage();
  await anotherPage.goto('http://127.0.0.1:5173/ReadUP/'); await openAccount(anotherPage);
  await anotherPage.getByLabel('อีเมลครู', { exact: true }).fill('teacher@example.test');
  await anotherPage.getByLabel('รหัสผ่าน', { exact: true }).fill('test-password');
  await anotherPage.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();
  await anotherPage.getByRole('button', { name: 'เลือกผู้เรียน นักอ่านหนึ่ง', exact: true }).click();
  await anotherPage.getByRole('button', { name: 'ฝึกต่อจากครั้งก่อน', exact: true }).click();
  await expect(anotherPage.getByRole('button', { name: 'เลือก ก', exact: true })).toBeDisabled();
  await anotherPage.getByRole('button', { name: 'ข้อต่อไป', exact: true }).click();
  await expect(anotherPage.getByText('ข้อ 2 จาก 5', { exact: true })).toBeVisible();
  await secondContext.close();
  await page.getByRole('button', { name: 'ออกจากระบบ', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'เข้าสู่ระบบครู', exact: true })).toBeVisible();
  await expect.poll(async () => (await keys(page)).filter(k => k.startsWith('workspace:')).length).toBe(0);
  expect(await keys(page)).toContain('snapshot');
  expect(backend.sessions.size).toBe(1);
});

test('a conflicting draft is retained until the teacher explicitly chooses the latest central result', async ({ page, context }) => {
  const backend = mockBackend(); await backend.install(context);
  await login(page); await selectFirst(page);
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
  await expect(page.getByText('พบผลที่เปลี่ยนจากอีกเครื่อง', { exact: false })).toBeVisible();
  expect(row.payload.records.length).toBe(1);
  await page.getByRole('button', { name: 'โหลดผลล่าสุด', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'ใช้ผลล่าสุดจากฐานข้อมูล?' })).toBeVisible();
  await page.getByRole('button', { name: 'ยกเลิก', exact: true }).click();
  await expect(page.getByText('มี 1 รอบฝึกรอส่งเข้าฐานข้อมูล', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'โหลดผลล่าสุด', exact: true }).click();
  await page.getByRole('button', { name: 'ยืนยันใช้ผลกลาง', exact: true }).click();
  await expect(page.getByText('ผลที่บันทึกของผู้เรียนนี้ส่งเข้าฐานข้อมูลแล้ว', { exact: true })).toBeVisible();
});

test('teacher management fits a mobile screen and has no automated accessibility violations', async ({ page, context }) => {
  const backend = mockBackend(); await backend.install(context);
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await expect(page.getByRole('heading', { name: 'เพิ่มผู้เรียน', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/teacher-mobile.png', fullPage: true });
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  const violations = await page.evaluate(async () => (await (window as any).axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa','wcag22aa'] } })).violations.map((v: any) => ({ id: v.id, targets: v.nodes.map((n: any) => n.target) })));
  expect(violations).toEqual([]);
});
