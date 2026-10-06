import test from 'node:test';import assert from 'node:assert/strict';
import {parseCriteria,parsePhase,phasePercentage,assessmentCsv,sameAssessment} from '../src/prepostDomain.mjs';
const criteria=Array.from({length:5},()=>({max_score:10,method:'สิบข้อ ข้อละหนึ่งคะแนน'}));
const draft={assessed_at:'2026-10-07T09:00',reading_text:'ชุดคำ A',scores:['0','5','8','7','9'],help_level:'prompted',note:'',comparable:false};
test('five teacher-defined criteria and scores validate ranges without inventing observations',()=>{
 assert.equal(parseCriteria({title:' ชุด A ',criteria:criteria.map(c=>({...c,max_score:'10'}))}).title,'ชุด A');
 const phase=parsePhase(draft,criteria);assert.equal(phase.correct_words,null);assert.equal(phase.reading_seconds,null);assert.equal(phase.scores[0],0);assert.equal(phasePercentage(phase,criteria,0),0);
 for(const changes of [{scores:['','','','','']},{scores:['11','5','8','7','9']},{scores:['-1','5','8','7','9']},{scores:['0.001','5','8','7','9']},{correct_words:'2'},{correct_words:'0',incorrect_words:'0'},{correct_words:'8',incorrect_words:'2',skipped_words:'3'},{reading_seconds:'0'},{help_level:''},{reading_text:''}])assert.throws(()=>parsePhase({...draft,...changes},criteria));
 assert.throws(()=>parseCriteria({title:'',criteria}));assert.throws(()=>parseCriteria({title:'A',criteria:criteria.slice(0,4)}));assert.throws(()=>parseCriteria({title:'A',criteria:criteria.map(c=>({...c,method:''}))}));
});
test('CSV includes all five criteria and confirms comparisons explicitly, protecting formulas',()=>{
 const pre=parsePhase({...draft,note:'=SUM(A1)'},criteria),post=parsePhase({...draft,scores:['2','6','9','8','10'],assessed_at:'2026-10-08T09:00'},criteria);
 const row={title:'A',criteria,pre,post},student={code:'0123',display_name:'นักอ่าน',class_name:'ป.1'};
 let csv=assessmentCsv(row,student);assert.ok(csv.includes('ยังไม่ยืนยัน'));assert.ok(csv.includes("'=SUM(A1)"));assert.ok(csv.includes('การประสมคำ คะแนนเต็ม'));
 csv=assessmentCsv({...row,post:{...post,comparable:true}},student);assert.ok(csv.includes('"20.00"'));assert.ok(csv.includes('"ยืนยัน"'));
 assert.equal(sameAssessment({a:1,b:{c:2}},{b:{c:2},a:1}),true);assert.equal(sameAssessment(pre,post),false);
});
