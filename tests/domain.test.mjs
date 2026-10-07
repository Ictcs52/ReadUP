import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resultCategory, summarize, percent, orderedOptions, csvCell, exportCsv, reviewItems } from '../src/domain.mjs';

const curriculum = JSON.parse(fs.readFileSync(new URL('../src/data/lessons.json', import.meta.url),'utf8'));

test('curriculum has exactly 30 planned lessons, with 15 playable lessons and 75 valid questions', () => {
  assert.equal(curriculum.levels.length,6);
  assert.equal(curriculum.levels.flatMap(l=>l.lessons).length,30);
  assert.equal(curriculum.lessons.length,15);
  assert.equal(curriculum.lessons.flatMap(l=>l.questions).length,75);
  assert.deepEqual(curriculum.lessons.map(l=>l.id),[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]);
  for(const l of curriculum.lessons) assert.equal(l.title,curriculum.levels[Math.ceil(l.id/5)-1].lessons[(l.id-1)%5]);
  for (const l of curriculum.lessons) for (const q of l.questions) {
    assert.ok(q.options.includes(q.letter));
    assert.equal(new Set(q.options).size,q.options.length);
    assert.ok(q.options.length>=2 && q.options.length<=3);
  }
});
test('first vowel lesson has three modelled examples before word transfer and correct vowel positions',()=>{
  const l=curriculum.lessons.find(l=>l.id===6);
  assert.equal(l.mode,'vowel');assert.equal(l.questions.length,5);
  assert.deepEqual(l.questions.map(q=>q.vowelExample),[true,true,true,false,false]);
  assert.deepEqual(l.questions.map(q=>[q.word,q.letter]),[['ตา','า'],['สี','ี'],['ปู','ู'],['ปลา','า'],['หมี','ี']]);
  for(const q of l.questions){assert.deepEqual(q.options,['า','ี','ู']);assert.ok(q.word.includes(q.letter));assert.ok(q.vowelClue.includes(q.word));assert.ok(q.speech);}
});
test('listening reuses familiar words, speaks only the target and grows from two choices to three',()=>{
  const l=curriculum.lessons.find(l=>l.id===8);
  assert.equal(l.mode,'listen-word');
  assert.deepEqual(l.questions.map(q=>q.options.length),[2,2,3,3,3]);
  const familiar=curriculum.lessons.find(l=>l.id===7).questions.map(q=>q.word);
  for(const q of l.questions){assert.ok(familiar.includes(q.word));assert.equal(q.speech,q.word);assert.equal(q.letter,q.word);assert.ok(!q.prompt.includes(q.word));}
});
test('vowel changes retain the consonant, change exactly one vowel and introduce meaningful open words',()=>{
 const l=curriculum.lessons.find(l=>l.id===9);
 assert.equal(l.mode,'change-vowel');
 assert.deepEqual(l.questions.map(q=>[q.previousWord,q.word]),[['ตา','ตี'],['ตี','ตา'],['ปู','ปี'],['ปี','ปู'],['ดู','ดี']]);
 for(const q of l.questions){assert.equal(q.previousWord[0],q.blend.consonant);assert.equal(q.blend.consonant+q.blend.vowel,q.word);assert.notEqual(q.previousWord,q.word);assert.equal(q.letter,q.word);assert.equal(q.blend.model,false);}
});
test('open-word picture practice uses familiar consonant plus vowel words with semantic choices',()=>{
 const l=curriculum.lessons.find(l=>l.id===10);
 assert.equal(l.mode,'word-picture');assert.equal(l.questions.length,5);
 for(const q of l.questions){assert.equal(q.speech,q.word);assert.equal(q.letter,q.word);assert.equal(q.word.length,2);assert.ok(['า','ี','ู'].includes(q.word[1]));assert.ok(!q.prompt.includes(q.word));assert.ok(q.options.every(w=>w.length===2));}
});
test('level three starts with familiar words that can be built from the offered consonants and vowels',()=>{
 const l=curriculum.lessons.find(l=>l.id===11);assert.equal(l.mode,'build-word');
 assert.deepEqual(l.questions.map(q=>q.build.consonants.length),[1,1,2,2,2]);
 for(const q of l.questions){assert.equal(q.letter,q.word);assert.ok(q.build.consonants.includes(q.word[0]));assert.ok(q.build.vowels.includes(q.word[1]));assert.equal(q.speech,q.word);assert.equal(new Set(q.build.consonants).size,q.build.consonants.length);assert.ok(!q.prompt.includes(q.word));}
});
test('missing-part lesson locks one part and offers a valid completion without changing its target word',()=>{
 const l=curriculum.lessons.find(l=>l.id===12);assert.equal(l.mode,'build-word');
 assert.deepEqual(l.questions.map(q=>q.build.missing),['vowel','vowel','consonant','vowel','consonant']);
 for(const q of l.questions){assert.equal(q.letter,q.word);assert.ok(q.build.consonants.includes(q.word[0]));assert.ok(q.build.vowels.includes(q.word[1]));assert.equal(q.build.missing==='vowel'?q.build.consonants.length:q.build.vowels.length,1);}
});
test('ordering uses consonant then long vowel, with each part offered once',()=>{
 const l=curriculum.lessons.find(l=>l.id===13);assert.equal(l.mode,'order-word');
 for(const q of l.questions){assert.equal(q.order.join(''),q.word);assert.equal(q.order.length,2);assert.equal(new Set(q.order).size,2);assert.ok(['า','ี','ู'].includes(q.order[1]));}
});
test('final consonant lesson keeps the base word fixed and introduces two choices before three',()=>{
 const l=curriculum.lessons.find(l=>l.id===14);assert.deepEqual(l.questions.map(q=>q.word),['จาน','ชาม','ปาก','ดาว','ลูก']);
 assert.deepEqual(l.questions.map(q=>q.build.finals.length),[2,2,3,3,3]);
 for(const q of l.questions){assert.equal(q.build.missing,'final');assert.equal(q.build.baseWord,q.word.slice(0,-1));assert.ok(q.build.finals.includes(q.word.at(-1)));assert.equal(q.speech,q.word);}
});
test('review combines ordering, missing vowels, full building and final consonants',()=>{
 const l=curriculum.lessons.find(l=>l.id===15);
 assert.deepEqual(l.questions.map(q=>q.order?'order':q.build.missing??'build'),['order','vowel','build','final','order']);
 for(const q of l.questions){assert.equal(q.letter,q.word);assert.equal(q.speech,q.word);}
});
test('first-time success with a hint is assisted, never independent',()=>{
  assert.equal(resultCategory(0,0),'independent');
  assert.equal(resultCategory(1,0),'retried');
  assert.equal(resultCategory(0,1),'assisted');
  assert.equal(resultCategory(3,3),'assisted');
});
test('consonants and the three long vowels form each model and target without moving Thai combining marks',()=>{
  const lesson=curriculum.lessons.find(l=>l.id===7);
  assert.equal(lesson.mode,'blend');assert.deepEqual(lesson.questions.map(q=>q.blend.model),[true,true,true,false,false]);
  assert.deepEqual(lesson.questions.map(q=>q.word),['ตา','ปู','สี','กา','งู']);
  for(const q of lesson.questions){assert.equal(q.blend.consonant+q.blend.vowel,q.word);assert.equal(q.letter,q.word);assert.ok(['า','ี','ู'].includes(q.blend.vowel));assert.deepEqual(q.options.map(word=>word[0]),Array(3).fill(q.blend.consonant));assert.equal(q.options.length,3);assert.ok(q.speech);}
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
