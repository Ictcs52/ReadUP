import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCloudConfig, pendingSession, mergeCloudSessions, mergeTeacherSessions, cloudPayload } from '../src/cloudDomain.mjs';

test('configuration accepts public keys and rejects service credentials or unexpected hosts', () => {
  assert.deepEqual(validateCloudConfig('https://sampleproject.supabase.co/', 'sb_publishable_test'), { url: 'https://sampleproject.supabase.co', publishableKey: 'sb_publishable_test' });
  const jwt = role => 'header.' + Buffer.from(JSON.stringify({ role })).toString('base64url') + '.signature';
  assert.equal(validateCloudConfig('https://sampleproject.supabase.co', jwt('anon')).publishableKey, jwt('anon'));
  for (const key of [jwt('service_role'), 'sb_secret_test', 'database-password']) assert.throws(() => validateCloudConfig('https://sampleproject.supabase.co', key));
  for (const url of ['http://sampleproject.supabase.co', 'https://attacker.example', 'https://sampleproject.supabase.co/path', 'https://sampleproject.supabase.co?x=1']) assert.throws(() => validateCloudConfig(url, 'sb_publishable_test'));
});
test('offline drafts survive merging and are marked as conflicting when another device changed the same round', () => {
  const local = { id: 'round', startedAt: 1, records: [{ word: 'ปลา' }], cloudRevision: 2, localRevision: 4, syncedLocalRevision: 3 };
  const same = mergeCloudSessions([local], [{ id: 'round', revision: 2, payload: { id: 'round', startedAt: 1, records: [] } }]);
  assert.deepEqual(same[0].records, local.records); assert.equal(same[0].syncConflict, false);
  const changed = mergeCloudSessions([local], [{ id: 'round', revision: 3, payload: { id: 'round', startedAt: 1, records: [] } }]);
  assert.equal(changed[0].syncConflict, true); assert.equal(pendingSession(changed[0]), true);
  assert.deepEqual(changed[0].records, local.records);
});
test('clean cached rounds accept remote results and sync bookkeeping is not uploaded as lesson data', () => {
  const clean = { id: 'round', startedAt: 1, cloudRevision: 2, localRevision: 3, syncedLocalRevision: 3 };
  const merged = mergeCloudSessions([clean], [{ id: 'round', revision: 3, payload: { id: 'round', startedAt: 1, records: [{ word: 'ไก่' }] } }]);
  assert.equal(pendingSession(merged[0]), false); assert.equal(merged[0].cloudRevision, 3);
  assert.deepEqual(cloudPayload(merged[0]), { id: 'round', startedAt: 1, records: [{ word: 'ไก่' }] });
});

test('teacher cache discards practice drafts and preserves only pending observations on unchanged rounds',()=>{
  const payload={id:'round',startedAt:1,records:[{word:'ไก่'}],observation:{note:'เดิม'}};
  const remote=[{id:'round',revision:2,payload}];
  const draft={...payload,cloudRevision:2,localRevision:3,syncedLocalRevision:2,observation:{note:'ครูแก้'}};
  assert.equal(mergeTeacherSessions([draft],remote)[0].observation.note,'ครูแก้');
  assert.equal(pendingSession(mergeTeacherSessions([draft],remote)[0]),true);
  const wrong={...draft,records:[{word:'ครูแอบทำ'}]};
  assert.deepEqual(mergeTeacherSessions([wrong,{id:'new',records:[]}],remote)[0].records,payload.records);
  assert.equal(pendingSession(mergeTeacherSessions([wrong],remote)[0]),false);
  assert.equal(mergeTeacherSessions([{id:'new',records:[]}],remote).length,1);
  assert.equal(mergeTeacherSessions([draft],[{...remote[0],revision:3}])[0].syncConflict,true);
});
