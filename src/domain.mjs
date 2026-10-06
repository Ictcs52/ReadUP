export function resultCategory(wrongAttempts, hintLevel) {
  if (hintLevel > 0) return 'assisted';
  return wrongAttempts === 0 ? 'independent' : 'retried';
}

export function summarize(records) {
  return records.reduce((s, r) => {
    s.total += 1;
    s[r.category] += 1;
    return s;
  }, { total: 0, independent: 0, retried: 0, assisted: 0, skipped: 0 });
}

export function percent(value, total) {
  return total === 0 ? 0 : Math.round(100 * value / total);
}

// Stable order per session; never assume the first option is the correct one.
export function orderedOptions(options, seed) {
  const out = [...options];
  let state = 2166136261;
  for (const c of seed) state = Math.imul(state ^ c.charCodeAt(0), 16777619) >>> 0;
  for (let i = out.length - 1; i > 0; i--) {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    const j = state % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Prefix untrusted strings to prevent formula execution in spreadsheet exports.
export function csvCell(value) {
  let s = String(value ?? '');
  if (/^[\s]*[=+@-]/u.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}

/** @param {{code: string, display_name: string} | null} [student] */
export function exportCsv(sessions, lessons, student = null) {
  const labels = { independent: 'ทำได้เองครั้งแรก', retried: 'ทำได้หลังลองใหม่โดยไม่ใช้ตัวช่วย', assisted: 'ทำได้หลังช่วย', skipped: 'ข้ามเพื่อฝึกภายหลัง' };
  const rows = [['รหัสผู้เรียน','ชื่อเรียกผู้เรียน','รหัสรอบฝึก','วันที่','บทเรียน','คำตัวอย่าง','ประเภทกิจกรรม','ผลกิจกรรม','ลองตอบไม่ตรงกี่ครั้ง','ระดับตัวช่วย','เวลาฝึกข้อนี้ (วินาที)','สถานะรอบ','สมาธิ (ครูสังเกต)','การอ่าน (ครูประเมิน)','หมายเหตุ']];
  for (const session of sessions) {
    const lesson = lessons.find(l => l.id === session.lessonId);
    for (const r of session.records) {
      rows.push([student?.code ?? '', student?.display_name ?? '', session.id, new Date(session.startedAt).toLocaleString('th-TH'), lesson?.title ?? session.lessonId, r.word, lesson?.mode, labels[r.category], r.wrongAttempts, r.hintLevel, Math.round(r.activeMs / 1000), session.status, session.observation?.attention ?? 'ยังไม่ได้สังเกต', session.observation?.reading ?? 'ยังไม่ได้ประเมิน', session.observation?.note ?? '']);
    }
  }
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}

export function reviewItems(sessions) {
  const map = new Map();
  for (const s of sessions) for (const r of s.records) {
    const key = s.lessonId + ':' + r.questionIndex;
    if (r.category !== 'independent') {
      map.set(key, { lessonId: s.lessonId, questionIndex: r.questionIndex, letter: r.letter, word: r.word });
    } else map.delete(key);
  }
  return [...map.values()];
}
