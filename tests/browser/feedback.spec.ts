import { authenticatedDemo } from './fixtures';
import { test, expect, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => { await authenticatedDemo(page);
  // Keep the existing activity regressions exercising their original retry/help flow.
  // Dedicated retry-popup tests cover both encouragement actions and keyboard dismissal.
  await page.addLocatorHandler(page.getByRole('dialog',{name:'ลองใหม่อีกทีนะ',exact:true}),async dialog=>{await dialog.getByRole('button',{name:'ปิดหน้าต่าง',exact:true}).click();});
});

async function trackAudio(page: Page) {
  await page.addInitScript(() => {
    const Native = window.AudioContext;
    (window as any).__feedbackNotes = [];
    window.AudioContext = class extends Native {
      createOscillator() {
        const oscillator = super.createOscillator();
        const setFrequency = oscillator.frequency.setValueAtTime.bind(oscillator.frequency);
        oscillator.frequency.setValueAtTime = (value, time) => {
          (window as any).__feedbackNotes.push(value);
          return setFrequency(value, time);
        };
        return oscillator;
      }
    };
  });
}
async function notes(page: Page): Promise<number[]> { return page.evaluate(() => (window as any).__feedbackNotes); }
async function home(page: Page) {
  await page.goto('./');
  await expect(page.getByRole('button', { name: 'เริ่มฝึกวันนี้', exact: true })).toBeVisible();
}

test('buttons make a click cue, only a correct answer earns animated stars and success notes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await trackAudio(page); await home(page);
  await page.getByRole('button', { name: 'เริ่มฝึกวันนี้', exact: true }).click();
  await expect.poll(async () => (await notes(page)).includes(640)).toBe(true);
  await page.getByRole('button', { name: 'เลือก ม', exact: true }).click();
  await expect(page.getByTestId('answer-stars')).toHaveCount(0);
  expect((await notes(page)).includes(1046.5)).toBe(false);
  await page.getByRole('button', { name: 'เลือก ก', exact: true }).click();
  await expect(page.getByTestId('answer-stars')).toBeVisible();
  await expect(page.locator('.celebration-star')).toHaveCount(1);
  const position = await page.locator('.star-reward-card').boundingBox();
  expect(position).not.toBeNull();
  expect(Math.abs(position!.x + position!.width / 2 - 195)).toBeLessThan(2);
  expect(Math.abs(position!.y + position!.height / 2 - 422)).toBeLessThan(2);
  await expect(page.locator('.star-reward-card').getByText('ได้ 1 ดาว', { exact: true })).toBeVisible();
  expect(await page.locator('.celebration-star').first().evaluate(el => getComputedStyle(el).animationName)).toBe('answer-star-pop');
  await expect.poll(async () => (await notes(page)).includes(1046.5)).toBe(true);
  expect(await notes(page)).toEqual(expect.arrayContaining([523.25, 659.25, 783.99, 1046.5]));
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'test-results/correct-stars-mobile.png', fullPage: true });
  await expect(page.getByTestId('answer-stars')).toHaveCount(0, { timeout: 2000 });
  const before = (await notes(page)).length;
  await page.getByRole('button', { name: 'เลือก ก', exact: true }).dispatchEvent('click');
  expect((await notes(page)).length).toBe(before);
  await expect(page.getByTestId('answer-stars')).toHaveCount(0);
  await page.getByRole('button', { name: 'ข้อต่อไป', exact: true }).click();
  await page.getByRole('button', { name: 'ฝึกข้อนี้ภายหลัง', exact: true }).click();
  await expect(page.getByTestId('answer-stars')).toHaveCount(0);
});

test('effect mute suppresses button/success cues while visual rewards respect reduced motion', async ({ page }) => {
  await trackAudio(page); await home(page);
  await page.getByRole('button', { name: 'ปรับการใช้งาน', exact: true }).first().click();
  await page.getByRole('checkbox', { name: /^เสียงปุ่มและเสียงฉลอง/ }).uncheck();
  const before = (await notes(page)).length;
  await page.getByRole('button', { name: 'หน้าหลัก', exact: true }).click();
  await page.getByRole('button', { name: 'เริ่มฝึกวันนี้', exact: true }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'เลือก ก', exact: true }).click();
  await expect(page.getByTestId('answer-stars')).toBeVisible();
  expect(await page.locator('.celebration-star').first().evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  expect((await notes(page)).length).toBe(before);
  await page.getByRole('button', { name: 'ข้อต่อไป', exact: true }).click();
  await expect(page.getByTestId('answer-stars')).toHaveCount(0);
});

test('existing calm setting survives an upgrade and receives default effect setting', async ({ page }) => {
  await home(page);
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('readtech-local-v1');
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('app', 'readwrite');
      const store = tx.objectStore('app');
      const get = store.get('snapshot');
      get.onsuccess = () => {
        const snapshot = get.result;
        delete snapshot.settings.effectsSound;
        snapshot.settings.calm = true;
        store.put(snapshot, 'snapshot');
      };
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
    open.onerror = () => reject(open.error);
  }));
  await page.reload();
  await page.getByRole('button', { name: 'ปรับการใช้งาน', exact: true }).first().click();
  await expect(page.getByRole('checkbox', { name: /^โหมดสงบ/ })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: /^เสียงปุ่มและเสียงฉลอง/ })).toBeChecked();
  await page.getByRole('button', { name: 'หน้าหลัก', exact: true }).click();
  await page.getByRole('button', { name: 'เริ่มฝึกวันนี้', exact: true }).click();
  await page.getByRole('button', { name: 'เลือก ก', exact: true }).click();
  await expect(page.getByTestId('answer-stars')).toBeVisible();
  expect(await page.locator('.celebration-star').first().evaluate(el => getComputedStyle(el).animationName)).toBe('none');
});
