import { csvCell } from './domain.mjs';

export const READING_HELP = {
  independent: 'อ่านได้เอง',
  prompted: 'ช่วยเตือนหรือชี้คำเป็นบางครั้ง',
  guided: 'ช่วยออกเสียงหรืออ่านนำเป็นบางคำ',
  full: 'ต้องอ่านนำหรือช่วยต่อเนื่อง',
};

// Determine the target from the actual fraction, never from a rounded display value.
export function readingAccuracy(correct, incorrect) {
  if (!Number.isInteger(correct) || !Number.isInteger(incorrect) || correct < 0 || incorrect < 0 || correct + incorrect === 0) return null;
  const total = correct + incorrect;
  return { total, percentage: correct * 100 / total, reached: correct * 5 >= total * 4 };
}

export function parseReadingDraft(draft) {
  const fields = ['correct_words', 'incorrect_words', 'letter_swaps', 'skipped_words', 'stops'];
  const value = {};
  for (const field of fields) {
    if (!/^\d+$/.test(String(draft[field]))) throw new Error('กรอกจำนวนเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป');
    const number = Number(draft[field]);
    if (!Number.isSafeInteger(number) || number > 10000) throw new Error('จำนวนแต่ละรายการต้องไม่เกิน 10,000');
    value[field] = number;
  }
  const total = value.correct_words + value.incorrect_words;
  if (!total || total > 10000) throw new Error('จำนวนคำทั้งหมดต้องอยู่ระหว่าง 1–10,000 คำ');
  if (value.skipped_words > value.incorrect_words) throw new Error('คำที่อ่านข้ามต้องนับรวมในจำนวนคำที่อ่านผิดด้วย');
  const seconds = String(draft.reading_seconds).trim();
  if (seconds && (!/^\d+$/.test(seconds) || Number(seconds) < 1 || Number(seconds) > 86400)) throw new Error('เวลาอ่านต้องเป็นจำนวนเต็ม 1–86,400 วินาที หรือเว้นว่างหากไม่ได้จับเวลา');
  if (!Object.hasOwn(READING_HELP, draft.help_level)) throw new Error('เลือกระดับความช่วยเหลือในการอ่าน');
  const assessed = new Date(draft.assessed_at);
  if (!draft.assessed_at || !Number.isFinite(assessed.getTime())) throw new Error('ระบุวันและเวลาประเมินให้ถูกต้อง');
  if (draft.reading_text.length > 500 || draft.note.length > 500) throw new Error('คำที่ใช้ประเมินและหมายเหตุต้องไม่เกินช่องละ 500 ตัวอักษร');
  return { ...value, reading_seconds: seconds ? Number(seconds) : null, help_level: draft.help_level, assessed_at: assessed.toISOString(), reading_text: draft.reading_text.trim(), note: draft.note.trim() };
}

export function readingCsv(rows, student) {
  const output = [['เลขประจำตัว', 'ชื่อ–สกุล', 'ชั้น', 'วันเวลาประเมิน', 'คำหรือประโยคที่ใช้', 'อ่านถูก', 'อ่านผิดรวมอ่านไม่ได้และข้าม', 'คำทั้งหมด', 'อ่านถูก (%)', 'เป้าหมาย 80%', 'สลับตัวอักษร (ครั้ง)', 'อ่านข้าม (คำ)', 'หยุดกลางคัน (ครั้ง)', 'เวลาอ่าน (วินาที)', 'ระดับความช่วยเหลือ', 'หมายเหตุ']];
  for (const row of rows) {
    const accuracy = readingAccuracy(row.correct_words, row.incorrect_words);
    output.push([student.code, student.display_name, student.class_name, new Date(row.assessed_at).toLocaleString('th-TH'), row.reading_text, row.correct_words, row.incorrect_words, accuracy?.total, accuracy?.percentage.toFixed(2), accuracy ? accuracy.reached ? 'ถึงเป้าหมาย' : 'ยังไม่ถึงเป้าหมาย' : '', row.letter_swaps, row.skipped_words, row.stops, row.reading_seconds ?? '', READING_HELP[row.help_level], row.note]);
  }
  return '\uFEFF' + output.map(row => row.map(csvCell).join(',')).join('\r\n');
}
