import test from 'node:test';
import assert from 'node:assert/strict';
import { practiceElapsed, breakDue } from '../src/practiceTime.mjs';

test('break timing counts active practice once and repeats only after another chosen interval',()=>{
  const session={status:'active',records:[{activeMs:100000}],currentMs:200000,answered:false};
  assert.equal(practiceElapsed(session),300000);
  assert.equal(breakDue(session,5),true);assert.equal(breakDue(session,10),false);assert.equal(breakDue(session,0),false);
  const answered={...session,answered:true,records:[...session.records,{activeMs:session.currentMs}]};
  assert.equal(practiceElapsed(answered),300000);
  const acknowledged={...answered,breakAcknowledgedMs:300000};
  assert.equal(breakDue(acknowledged,5),false);
  assert.equal(breakDue({...acknowledged,answered:false,currentMs:300000},5),true);
  assert.equal(breakDue({...session,status:'complete'},5),false);
});
