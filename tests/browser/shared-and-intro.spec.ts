import { test, expect } from '@playwright/test';
import { authenticatedDemo } from './fixtures';

test('intro card previews letters on desktop and mobile without adding scored sessions', async ({ page }) => {
  await authenticatedDemo(page);
  await page.goto('./');
  await page.locator('.sidebar').getByRole('button',{name:'บทเรียนของฉัน',exact:true}).click();
  await expect(page.locator('.level-panel .lesson-card')).toHaveCount(6);
  await page.getByRole('button',{name:'เปิด รู้จักกันก่อน',exact:true}).click();
  await expect(page.getByRole('heading',{name:'รู้จักกันก่อน',exact:true})).toBeVisible();
  await expect(page.locator('.intro-focus strong')).toHaveText('ก');
  await page.getByRole('button',{name:'รู้จัก มอ ม้า',exact:true}).click();
  await expect(page.locator('.intro-focus strong')).toHaveText('ม');
  await page.getByRole('button',{name:'ถัดไป',exact:true}).click();
  await expect(page.locator('.intro-focus strong')).toHaveText('ป');
  for(const width of [1440,390,320]) {
    await page.setViewportSize({width,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.getByRole('button',{name:'ปรับการใช้งาน',exact:true}).first().click();
  await page.getByRole('checkbox',{name:/^ตัวหนังสือใหญ่ขึ้น/}).check();
  await page.locator('.mobile-nav').getByRole('button',{name:'บทเรียนของฉัน',exact:true}).click();
  await page.getByRole('button',{name:'เปิด รู้จักกันก่อน',exact:true}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'รู้จัก ปอ ปลา',exact:true}).click();
  await page.screenshot({path:'test-results/consonant-intro-mobile.png',fullPage:true});
  await page.getByRole('button',{name:'กลับบทเรียน',exact:true}).click();
  await expect(page.getByRole('heading',{name:'พยัญชนะมหาสนุก',exact:true})).toBeVisible();
  await expect(page.locator('.level-progress')).toContainText('ทำครบ 0 / 5 บท');
});

test('teacher can open another teacher’s learner reports with account and assessments read only', async ({ page }) => {
  await authenticatedDemo(page);
  const student={id:'44444444-4444-4444-8444-444444444444',teacher_id:'22222222-2222-4222-8222-222222222222',code:'0123',display_name:'นักเรียนครูท่านอื่น',class_name:'ป.1',login_id:'0123',login_enabled:true,created_at:'2026-10-06T00:00:00Z'};
  await page.route('https://readtechtest.supabase.co/rest/v1/readtech_students*',route=>{
    expect(new URL(route.request().url()).searchParams.has('teacher_id')).toBe(false);
    return route.fulfill({json:[student]});
  });
  for(const table of ['readtech_sessions','readtech_reading_assessments','readtech_prepost_assessments']) await page.route('https://readtechtest.supabase.co/rest/v1/'+table+'*',route=>route.fulfill({json:[]}));
  await page.goto('./');
  await page.locator('.sidebar').getByRole('button',{name:'สำหรับครู',exact:true}).click();
  await expect(page.getByRole('heading',{name:/ผู้เรียนทั้งหมด/})).toBeVisible();
  await expect(page.getByText('ครูท่านอื่นลงทะเบียน', {exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'จัดการบัญชี '+student.display_name,exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'เลือกผู้เรียน '+student.display_name,exact:true}).click();
  await expect(page.getByRole('button',{name:'เพิ่มบันทึกการอ่าน',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'สร้างชุดประเมิน',exact:true})).toBeDisabled();
});
