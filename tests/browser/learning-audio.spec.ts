import { authenticatedDemo } from './fixtures';
import curriculum from '../../src/data/lessons.json' with { type: 'json' };
import { test, expect, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => { await authenticatedDemo(page); });

for(const id of [13,14,15])test('lesson '+id+' uses Thai word audio and checks each ordering or building activity',async({page})=>{
 const lesson=curriculum.lessons.find(l=>l.id===id)!;await mockSpeech(page,true,'Microsoft เปรมวดี Online (Natural) - Thai (Thailand)');await page.getByRole('button',{name:'หน้าหลัก',exact:true}).click();await page.getByRole('button',{name:'ดูบทใหม่',exact:true}).click();await page.getByRole('button',{name:'เริ่มฝึก '+lesson.title,exact:true}).click();
 for(let i=0;i<5;i++){const q=lesson.questions[i] as any;await page.getByRole('button',{name:'ฟังตัวอย่าง',exact:true}).click();await expect.poll(async()=>page.evaluate(()=>(window as any).__spoken.at(-1)?.text)).toBe(q.word);expect(await page.evaluate(()=>(window as any).__spoken.at(-1).voiceURI)).toBe('premwadee-online');
  if(q.order){for(const part of q.order)await page.getByRole('button',{name:['า','ี','ู'].includes(part)?'เพิ่มสระ อ'+part:'เพิ่มพยัญชนะ '+part,exact:true}).click();await page.getByRole('button',{name:'ตรวจคำที่เรียง',exact:true}).click();}
  else{if(q.build.missing==='final')await page.getByRole('button',{name:'เลือกตัวสะกด '+q.word.at(-1),exact:true}).click();else{if(q.build.missing!=='vowel')await page.getByRole('button',{name:'เลือกพยัญชนะ '+q.word[0],exact:true}).click();if(q.build.missing!=='consonant')await page.getByRole('button',{name:'เลือกสระ อ'+q.word[1],exact:true}).click();}await page.getByRole('button',{name:'ตรวจคำที่สร้าง',exact:true}).click();}
  await page.getByRole('button',{name:i===4?'ดูรางวัลของฉัน':'ข้อต่อไป',exact:true}).click();
 }
});

test('level three speaks the target word and supports keyboard word construction with the preferred Thai voice',async({page})=>{
 await mockSpeech(page,true,'Microsoft เปรมวดี Online (Natural) - Thai (Thailand)');await page.getByRole('button',{name:'หน้าหลัก',exact:true}).click();await page.getByRole('button',{name:'ดูบทใหม่',exact:true}).click();await page.getByRole('button',{name:'เริ่มฝึก ประสมคำง่าย',exact:true}).click();
 const words=['ตา','ปู','สี','กา','งู'];
 for(let i=0;i<5;i++){
  await page.getByRole('button',{name:'ฟังตัวอย่าง',exact:true}).click();await expect.poll(async()=>page.evaluate(()=>(window as any).__spoken.at(-1)?.text)).toBe(words[i]);expect(await page.evaluate(()=>(window as any).__spoken.at(-1).voiceURI)).toBe('premwadee-online');
  const c=page.getByRole('button',{name:'เลือกพยัญชนะ '+words[i][0],exact:true});await c.focus();await page.keyboard.press('Enter');const v=page.getByRole('button',{name:'เลือกสระ อ'+words[i][1],exact:true});await v.focus();await page.keyboard.press('Space');
  await page.getByRole('button',{name:'ตรวจคำที่สร้าง',exact:true}).click();await page.getByRole('button',{name:i===4?'ดูรางวัลของฉัน':'ข้อต่อไป',exact:true}).click();
 }
});

for(const id of [9,10])test('lesson '+id+' plays each target through the preferred Thai voice',async({page})=>{
 await mockSpeech(page,true,'Microsoft เปรมวดี Online (Natural) - Thai (Thailand)');await page.getByRole('button',{name:'หน้าหลัก',exact:true}).click();await page.getByRole('button',{name:'ดูบทใหม่',exact:true}).click();await page.getByRole('tab',{name:'LEVEL 2 พร้อมฝึก',exact:true}).click();await page.getByRole('button',{name:id===9?'เริ่มฝึก เปลี่ยนสระเปลี่ยนเสียง':'เริ่มฝึก คำไม่มีตัวสะกด',exact:true}).click();
 const speech=id===9?['ตอ อี ตี','ตอ อา ตา','ปอ อี ปี','ปอ อู ปู','ดอ อี ดี']:['ตา','ปู','สี','กา','งู'];const words=id===9?['ตี','ตา','ปี','ปู','ดี']:['ตา','ปู','สี','กา','งู'];
 for(let i=0;i<5;i++){await page.getByRole('button',{name:'ฟังตัวอย่าง',exact:true}).click();await expect.poll(async()=>page.evaluate(()=>(window as any).__spoken.at(-1)?.text)).toBe(speech[i]);expect(await page.evaluate(()=>(window as any).__spoken.at(-1).voiceURI)).toBe('premwadee-online');await page.getByRole('button',{name:'เลือก '+words[i],exact:true}).click();await page.getByRole('button',{name:i===4?'ดูรางวัลของฉัน':'ข้อต่อไป',exact:true}).click();}
});

test('word listening plays the target and repeats it at help two through the selected Thai voice',async({page})=>{
 await mockSpeech(page,true,'Microsoft เปรมวดี Online (Natural) - Thai (Thailand)');await page.getByRole('button',{name:'หน้าหลัก',exact:true}).click();await page.getByRole('button',{name:'ดูบทใหม่',exact:true}).click();await page.getByRole('tab',{name:'LEVEL 2 พร้อมฝึก',exact:true}).click();await page.getByRole('button',{name:'เริ่มฝึก ฟังแล้วเลือกพยางค์',exact:true}).click();
 const words=['ตา','ปู','สี','กา','งู'];
 for(let i=0;i<5;i++){
  await page.getByRole('button',{name:'ฟังตัวอย่าง',exact:true}).click();await expect.poll(async()=>page.evaluate(()=>(window as any).__spoken.at(-1)?.text)).toBe(words[i]);expect(await page.evaluate(()=>(window as any).__spoken.at(-1).voiceURI)).toBe('premwadee-online');
  if(i===0){await page.getByRole('button',{name:'ช่วยทีละนิด',exact:true}).click();await page.getByRole('button',{name:'ช่วยทีละนิด',exact:true}).click();await expect(page.locator('.hint-box')).not.toContainText(words[i]);expect(await page.evaluate(()=>(window as any).__spoken.at(-1).text)).toBe(words[i]);}
  await page.getByRole('button',{name:'เลือก '+words[i],exact:true}).click();await page.getByRole('button',{name:i===4?'ดูรางวัลของฉัน':'ข้อต่อไป',exact:true}).click();
 }
});

test('blending audio spells consonant and vowel then reads the word through the chosen Thai voice',async({page})=>{
 await mockSpeech(page,true,'Microsoft เปรมวดี Online (Natural) - Thai (Thailand)');await page.getByRole('button',{name:'หน้าหลัก',exact:true}).click();await page.getByRole('button',{name:'ดูบทใหม่',exact:true}).click();await page.getByRole('tab',{name:'LEVEL 2 พร้อมฝึก',exact:true}).click();await page.getByRole('button',{name:'เริ่มฝึก พยัญชนะกับสระ',exact:true}).click();
 const speech=['ตอ อา ตา','ปอ อู ปู','สอ อี สี','กอ อา กา','งอ อู งู'];const words=['ตา','ปู','สี','กา','งู'];
 for(let i=0;i<5;i++){await page.getByRole('button',{name:'ฟังตัวอย่าง',exact:true}).click();await expect.poll(async()=>page.evaluate(()=>(window as any).__spoken.at(-1)?.text)).toBe(speech[i]);expect(await page.evaluate(()=>(window as any).__spoken.at(-1).voiceURI)).toBe('premwadee-online');await page.getByRole('button',{name:`เลือก ${words[i]}`,exact:true}).click();await page.getByRole('button',{name:i===4?'ดูรางวัลของฉัน':'ข้อต่อไป',exact:true}).click();}
});

test('new vowel lesson reads each vowel and word with the selected Thai voice',async({page})=>{
 await mockSpeech(page,true,'Microsoft เปรมวดี Online (Natural) - Thai (Thailand)');await page.getByRole('button',{name:'หน้าหลัก',exact:true}).click();await page.getByRole('button',{name:'ดูบทใหม่',exact:true}).click();await page.getByRole('tab',{name:'LEVEL 2 พร้อมฝึก',exact:true}).click();await page.getByRole('button',{name:'เริ่มฝึก รู้จักสระชุดแรก',exact:true}).click();
 const words=['สระ อา ตา','สระ อี สี','สระ อู ปู','ปลา ใช้สระ อา','หมี ใช้สระ อี'];const answers=['อา','อี','อู','อา','อี'];
 for(let i=0;i<5;i++){await page.getByRole('button',{name:'ฟังตัวอย่าง',exact:true}).click();await expect.poll(async()=>page.evaluate(()=>(window as any).__spoken.at(-1)?.text)).toBe(words[i]);expect(await page.evaluate(()=>(window as any).__spoken.at(-1).voiceURI)).toBe('premwadee-online');await page.getByRole('button',{name:`เลือกสระ ${answers[i]}`,exact:true}).click();await page.getByRole('button',{name:i===4?'ดูรางวัลของฉัน':'ข้อต่อไป',exact:true}).click();}
});

async function mockSpeech(page: Page, hasThai = true, microsoftName = '') {
  await page.addInitScript(({hasThai, microsoftName}) => {
    const voices = [
      { voiceURI: 'en-test', name: 'English', lang: 'en-US', default: true, localService: true },
      ...(hasThai ? [
        { voiceURI: 'th-one', name: 'เสียงไทยหนึ่ง', lang: 'th-TH', default: false, localService: true },
        { voiceURI: 'th-two', name: 'เสียงไทยสอง', lang: 'th-TH', default: false, localService: true },
        ...(microsoftName ? [{ voiceURI: 'premwadee-online', name: microsoftName, lang: 'th-TH', default: false, localService: false }] : []),
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
  }, {hasThai,microsoftName});
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

async function openFish(page: Page) {
  await page.getByRole('button', { name: 'หน้าหลัก', exact: true }).click();
  await page.getByRole('button', { name: 'บทเรียนของฉัน', exact: true }).click();
  await page.getByRole('button', { name: 'เริ่มฝึก ภาพกับพยัญชนะต้น', exact: true }).click();
  await page.getByRole('button', { name: 'ฝึกข้อนี้ภายหลัง', exact: true }).click();
  await page.getByRole('button', { name: 'ข้อต่อไป', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'ปลา เริ่มต้นด้วยเสียงอะไร?' })).toBeVisible();
}

test('uploaded Thai-named M4A decodes and plays without device voices, replays and stops when answered', async ({ page }) => {
  await page.addInitScript(() => {
    const Native = window.Audio;
    (window as any).__lessonAudio = [];
    (window as any).Audio = function (src: string) {
      const audio = new Native(src);
      (window as any).__lessonAudio.push(audio);
      return audio;
    };
  });
  await mockSpeech(page, false);
  await page.setViewportSize({ width: 390, height: 844 });
  await openFish(page);
  await expect(page.getByRole('button', { name: /^เลือก / })).toHaveCount(3);
  for (const letter of ['ป', 'ม', 'ล']) await expect(page.getByRole('button', { name: `เลือก ${letter}`, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'ฟังคำถาม', exact: true }).click();
  await expect.poll(() => page.evaluate(() => {
    const audio = (window as any).__lessonAudio[0];
    return Boolean(audio && !audio.paused && audio.currentTime > 0 && audio.readyState >= 2 && !audio.error);
  })).toBe(true);
  expect(await page.evaluate(() => decodeURI((window as any).__lessonAudio[0].src))).toContain('/ReadUP/audio/ปลาเริ่มต้นด้วยเสียงอะไร.m4a');
  expect(await page.evaluate(() => (window as any).__spoken)).toEqual([]);
  await page.getByRole('button', { name: 'ฟังคำถาม', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__lessonAudio[1]?.currentTime > 0)).toBe(true);
  expect(await page.evaluate(() => (window as any).__lessonAudio[0].paused)).toBe(true);
  await page.getByRole('button', { name: 'เลือก ป', exact: true }).click();
  expect(await page.evaluate(() => (window as any).__lessonAudio[1].paused)).toBe(true);
  await expect(page.locator('.celebration-star')).toHaveCount(1);
  await page.screenshot({ path: 'test-results/fish-recorded-mobile.png', fullPage: true });
});

test('an unavailable recorded question falls back once to Thai speech with the full question', async ({ page }) => {
  await page.route('**/audio/*.m4a', route => route.abort());
  await mockSpeech(page);
  await openFish(page);
  await page.getByRole('button', { name: 'ฟังคำถาม', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__spoken)).toEqual([
    { text: 'ปลา เริ่มต้นด้วยเสียงอะไร?', lang: 'th-TH', voiceURI: 'th-one', rate: 0.85 },
  ]);
});

for (const name of ['Microsoft เปรมวดี Online (Natural) - Thai (Thailand)', 'Microsoft Premwadee Online (Natural) - Thai (Thailand)']) {
  test(`automatic Thai voice prefers ${name} and respects an explicit selection`, async ({page}) => {
    await mockSpeech(page, true, name);
    await expect(page.locator('#thai-voice option[value=""]')).toHaveText(`อัตโนมัติ · ${name}`);
    await page.getByRole('button',{name:'ทดลองฟัง กอ ไก่',exact:true}).click();
    expect(await page.evaluate(()=>(window as any).__spoken.at(-1).voiceURI)).toBe('premwadee-online');
    await expect(page.getByRole('status').filter({hasText:`กำลังใช้เสียง ${name}`})).toBeVisible();
    await page.getByLabel('เลือกเสียงภาษาไทย').selectOption('th-two');
    await page.getByRole('button',{name:'ทดลองฟัง กอ ไก่',exact:true}).click();
    expect(await page.evaluate(()=>(window as any).__spoken.at(-1).voiceURI)).toBe('th-two');
    await page.getByLabel('เลือกเสียงภาษาไทย').selectOption('');
    await page.getByRole('button',{name:'ทดลองฟัง กอ ไก่',exact:true}).click();
    expect(await page.evaluate(()=>(window as any).__spoken.at(-1).voiceURI)).toBe('premwadee-online');
  });
}
