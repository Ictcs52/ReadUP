import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resultCategory, summarize, percent, orderedOptions, csvCell, exportCsv, reviewItems } from '../src/domain.mjs';

const curriculum = JSON.parse(fs.readFileSync(new URL('../src/data/lessons.json', import.meta.url),'utf8'));

test('curriculum has exactly 30 planned lessons, with 5 playable lessons and 25 valid questions', () => {
  assert.equal(curriculum.levels.length,6);
  assert.equal(curriculum.levels.flatMap(l=>l.lessons).length,30);
  assert.equal(curriculum.lessons.length,5);
  assert.equal(curriculum.lessons.flatMap(l=>l.questions).length,25);
  for (const l of curriculum.lessons) for (const q of l.questions) {
    assert.ok(q.options.includes(q.letter));
    assert.equal(new Set(q.options).size,q.options.length);
    assert.ok(q.options.length>=2 && q.options.length<=3);
  }
});
test('first-time success with a hint is assisted, never independent',()=>{
  assert.equal(resultCategory(0,0),'independent');
  assert.equal(resultCategory(1,0),'retried');
  assert.equal(resultCategory(0,1),'assisted');
  assert.equal(resultCategory(3,3),'assisted');
});
test('summary keeps independent, retry, assisted and skipped separate',()=>{
  const records = [...Array(7).fill({category:'independent'}),...Array(2).fill({category:'assisted'}),{category:'skipped'}];
  const summary = summarize(records);
  assert.deepEqual(summary,{total:10,independent:7,retried:0,assisted:2,skipped:1});
  assert.equal(percent(summary.independent,summary.total),70);
  assert.equal(percent(0,0),0);
});
test('options are shuffled deterministically and never altered',()=>{
  const input=['ก','ม','ป'];
  assert.deepEqual(orderedOptions(input,'test'),orderedOptions(input,'test'));
  assert.deepEqual(orderedOptions(input,'test').sort(),[...input].sort());
  assert.deepEqual(input,['ก','ม','ป']);
  const firsts=new Set(Array.from({length:100},(_,i)=>orderedOptions(input,String(i))[0]));
  assert.equal(firsts.size,3);
});
test('CSV handles commas, quotes, Thai UTF-8 and formula injection',()=>{
  assert.equal(csvCell('a,"b"'),'"a,""b"""');
  assert.equal(csvCell('=HYPERLINK("x")'),'"\'=HYPERLINK(""x"")"');
  assert.equal(csvCell(' @SUM(1)'),'"\' @SUM(1)"');
  const sessions=[{id:'test',lessonId:1,startedAt:0,status:'complete',observation:{note:'=1+1'},records:[{word:'ไก่',category:'assisted',wrongAttempts:1,hintLevel:2,activeMs:1200}]}];
  const csv=exportCsv(sessions,curriculum.lessons);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('ทำได้หลังช่วย'));
  assert.ok(csv.includes('"\'=1+1"'));
});
test('review items are scoped to lesson/question, not a global letter',()=>{
  const sessions=[{lessonId:1,records:[{questionIndex:0,letter:'ก',word:'ไก่',category:'assisted'}]},{lessonId:2,records:[{questionIndex:0,letter:'ก',word:'ไก่',category:'retried'}]}];
  assert.equal(reviewItems(sessions).length,2);
  sessions.push({lessonId:1,records:[{questionIndex:0,letter:'ก',word:'ไก่',category:'independent'}]});
  assert.equal(reviewItems(sessions).length,1);
});
