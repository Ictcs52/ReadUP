import { test, expect, type Page } from '@playwright/test';

async function mockSpeech(page: Page, hasThai = true) {
  await page.addInitScript((hasThai) => {
    const voices = [
      { voiceURI: 'en-test', name: 'English', lang: 'en-US', default: true, localService: true },
      ...(hasThai ? [
        { voiceURI: 'th-one', name: 'เสียงไทยหนึ่ง', lang: 'th-TH', default: false, localService: true },
        { voiceURI: 'th-two', name: 'เสียงไทยสอง', lang: 'th-TH', default: false, localService: true },
      ] : []),
    ];
    (window as any).__spoken = [];
    (window as any).__cancellations = 0;
    (window as any).SpeechSynthesisUtterance = class { constructor(public text: string) {} };
    window.speechSynthesis.getVoices = () => voices as SpeechSynthesisVoice[];
    window.speechSynthesis.speak = (utterance) => {
      (window as any).__spoken.push({ text: utterance.text, lang: utterance.lang, voiceURI: utterance.voice?.voiceURI, rate: utterance.rate });
    };
    window.speechSynthesis.cancel = () => { (window as any).__cancellations += 1; };
  }, hasThai);
  await page.goto('./');
  await page.getByRole('button', { name: 'ปรับการใช้งาน', exact: true }).first().click();
}

test('Thai voice and reading speed are selected, persisted and used without queuing old speech', async ({ page }) => {
  await mockSpeech(page);
  await expect(page.locator('#thai-voice option')).toHaveCount(3);
  await page.getByLabel('เลือกเสียงภาษาไทย').selectOption('th-two');
  await page.locator('#speech-rate').focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#speech-rate')).toHaveValue('0.75');
  const before = await page.evaluate(() => (window as any).__cancellations);
  await page.getByRole('button', { name: 'ทดลองฟัง กอ ไก่', exact: true }).click();
  await page.getByRole('button', { name: 'ทดลองฟัง กอ ไก่', exact: true }).click();
  expect(await page.evaluate(() => (window as any).__spoken)).toEqual([
    { text: 'กอ ไก่', lang: 'th-TH', voiceURI: 'th-two', rate: 0.75 },
    { text: 'กอ ไก่', lang: 'th-TH', voiceURI: 'th-two', rate: 0.75 },
  ]);
  expect(await page.evaluate(() => (window as any).__cancellations)).toBeGreaterThanOrEqual(before + 2);
  await page.reload();
  await page.getByRole('button', { name: 'ปรับการใช้งาน', exact: true }).first().click();
  await expect(page.getByLabel('เลือกเสียงภาษาไทย')).toHaveValue('th-two');
  await expect(page.locator('#speech-rate')).toHaveValue('0.75');
});

test('a device without Thai speech gives clear help instead of reading Thai through an English voice', async ({ page }) => {
  await mockSpeech(page, false);
  await expect(page.getByLabel('เลือกเสียงภาษาไทย')).toBeDisabled();
  await page.getByRole('button', { name: 'ทดลองฟัง กอ ไก่', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'เครื่องนี้ไม่มีเสียงภาษาไทย ให้ผู้ดูแลอ่านตัวอย่าง' })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__spoken)).toEqual([]);
});
