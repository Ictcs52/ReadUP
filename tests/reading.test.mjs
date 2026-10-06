import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReadingDraft, readingAccuracy, readingCsv } from '../src/readingDomain.mjs';

const draft = { assessed_at:'2026-10-06T15:00',reading_text:'ไก่ ม้า ปลา',correct_words:'8',incorrect_words:'2',letter_swaps:'1',skipped_words:'1',stops:'2',reading_seconds:'45',help_level:'prompted',note:'' };
test('reading target uses actual word counts, treats zero as unassessed and does not round up to 80%',()=>{
  assert.equal(readingAccuracy(0,0),null);
  assert.equal(readingAccuracy(-1,5),null);
  assert.equal(readingAccuracy(0,5).percentage,0);
  assert.equal(readingAccuracy(8,2).reached,true);
  assert.equal(readingAccuracy(7,3).reached,false);
  assert.equal(readingAccuracy(7999,2001).reached,false);
  assert.equal(readingAccuracy(1,0).percentage,100);
});
test('reading entries validate integer counts and include skipped words in the denominator without inventing timing',()=>{
  const value=parseReadingDraft(draft);
  assert.equal(value.correct_words,8);assert.equal(value.skipped_words,1);assert.equal(value.reading_seconds,45);
  assert.equal(parseReadingDraft({...draft,reading_seconds:''}).reading_seconds,null);
  for(const wrong of [{correct_words:'-1'},{correct_words:'1.5'},{correct_words:''},{correct_words:'10001'},{correct_words:'0',incorrect_words:'0'},{correct_words:'9999',incorrect_words:'2'},{skipped_words:'3'},{help_level:'invalid'},{reading_seconds:'0'},{reading_seconds:'1.5'},{assessed_at:''}])assert.throws(()=>parseReadingDraft({...draft,...wrong}));
});
test('reading export preserves unknown timing and separates actual reading from game results',()=>{
  const value={...parseReadingDraft({...draft,reading_seconds:''}),note:'=SUM(A1:A5)'};
  const csv=readingCsv([value],{code:'0123',display_name:'นักอ่าน',class_name:'ป.1'});
  assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('"80.00","ถึงเป้าหมาย"'));assert.ok(csv.includes("'=SUM(A1:A5)"));
  assert.ok(csv.includes('"1","1","2","","ช่วยเตือนหรือชี้คำเป็นบางครั้ง"'));
});
