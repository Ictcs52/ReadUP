import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('PostgreSQL enforces teacher approval, ownership, no anonymous access and optimistic session revisions', async () => {
  const db = new PGlite();
  const a = '11111111-1111-4111-8111-111111111111';
  const b = '22222222-2222-4222-8222-222222222222';
  const stranger = '33333333-3333-4333-8333-333333333333';
  const student = '44444444-4444-4444-8444-444444444444';
  const another = '55555555-5555-4555-8555-555555555555';
  const round = '66666666-6666-4666-8666-666666666666';
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to authenticated, anon;
      insert into auth.users values ('${a}'),('${b}'),('${stranger}');`);
    await db.exec(await fs.readFile(new URL('../supabase/migrations/202610060001_readtech_cloud.sql', import.meta.url), 'utf8'));
    await db.query('insert into public.readtech_teachers(id,display_name) values ($1,$2),($3,$4)', [a, 'ครู A', b, 'ครู B']);
    await db.query('insert into public.readtech_students(id,teacher_id,code,display_name) values($1,$2,$3,$4),($5,$2,$6,$7)', [student, a, 'A01', 'นักอ่าน A', another, 'A02', 'นักอ่านอีกคน']);
    async function asTeacher(id, query, params = []) {
      return db.transaction(async tx => {
        await tx.exec('set local role authenticated');
        await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
        return tx.query(query, params);
      });
    }
    const payload = { id: round, lessonId: 1, contentVersion: 1, startedAt: 1000, status: 'active', questionIndices: [0,1,2,3,4], index: 0, records: [], wrongAttempts: 0, hintLevel: 0, currentMs: 0, answered: false };
    const save = (owner, learner = student, revision = 0, value = payload) => asTeacher(owner, 'select public.readtech_save_session($1,$2::jsonb,$3) as saved', [learner, JSON.stringify(value), revision]);
    assert.equal((await save(a)).rows[0].saved.revision, 1);
    assert.equal((await save(a)).rows[0].saved.revision, 1, 'retrying an identical write after a lost response is idempotent');
    assert.equal((await asTeacher(a, 'select * from public.readtech_sessions')).rows.length, 1);
    assert.equal((await asTeacher(b, 'select * from public.readtech_students')).rows.length, 0);
    assert.equal((await asTeacher(b, 'select * from public.readtech_sessions')).rows.length, 0);
    await assert.rejects(save(b), error => error.code === '42501');
    await assert.rejects(save(stranger), error => error.code === '42501');
    await assert.rejects(asTeacher(stranger, 'insert into public.readtech_teachers(id,display_name) values($1,$2)', [stranger, 'สมัครเอง']), error => error.code === '42501');
    await assert.rejects(asTeacher(b, 'insert into public.readtech_students(teacher_id,code,display_name) values($1,$2,$3)', [a, 'ATTACK', 'ผิดเจ้าของ']), error => error.code === '42501');
    await assert.rejects(asTeacher(a, 'update public.readtech_students set teacher_id=$1 where id=$2', [b, student]), error => error.code === '42501');
    await assert.rejects(asTeacher(a, 'update public.readtech_sessions set revision=100 where id=$1', [round]), error => error.code === '42501');
    await assert.rejects(db.transaction(async tx => { await tx.exec('set local role anon'); return tx.query('select * from public.readtech_sessions'); }), error => error.code === '42501');
    assert.equal((await save(a, student, 1, { ...payload, hintLevel: 1 })).rows[0].saved.revision, 2);
    await assert.rejects(save(a, student, 1, { ...payload, wrongAttempts: 1 }), error => error.code === '40001');
    await assert.rejects(save(a, another, 2), error => error.code === '42501');
    await assert.rejects(save(a, student, 2, { ...payload, index: null }), error => error.code === '22023');
    const stored = (await asTeacher(a, 'select revision,payload from public.readtech_sessions')).rows[0];
    assert.equal(stored.revision, 2); assert.equal(stored.payload.hintLevel, 1); assert.equal(stored.payload.wrongAttempts, 0);
    await db.query('update public.readtech_teachers set active=false where id=$1', [a]);
    assert.equal((await asTeacher(a, 'select * from public.readtech_sessions')).rows.length, 0);
    await assert.rejects(save(a, student, 2), error => error.code === '42501');
  } finally { await db.close(); }
});

test('student accounts restrict reads and writes to self and preserve teacher assessments', async () => {
  const db = new PGlite();
  const teacher = '11111111-1111-4111-8111-111111111111';
  const pupil = '22222222-2222-4222-8222-222222222222';
  const peer = '33333333-3333-4333-8333-333333333333';
  const student = '44444444-4444-4444-8444-444444444444';
  const another = '55555555-5555-4555-8555-555555555555';
  const round = '66666666-6666-4666-8666-666666666666';
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to authenticated, anon;
      insert into auth.users values ('${teacher}'),('${pupil}'),('${peer}');`);
    const folder = new URL('../supabase/migrations/', import.meta.url);
    for (const file of (await readdir(folder)).filter(x => x.endsWith('.sql')).sort()) await db.exec(await fs.readFile(new URL(file, folder), 'utf8'));
    await db.query('insert into public.readtech_teachers(id,display_name) values($1,$2)', [teacher, 'ครู']);
    await db.query('insert into public.readtech_students(id,teacher_id,code,display_name,auth_user_id,login_id) values($1,$2,$3,$4,$5,$6),($7,$2,$8,$9,$10,$11)', [student,teacher,'S01','เด็กหนึ่ง',pupil,'1234567890',another,'S02','เด็กสอง',peer,'9876543210']);
    async function asUser(id, query, params=[]) {
      return db.transaction(async tx => {
        await tx.exec('set local role authenticated');
        await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
        return tx.query(query,params);
      });
    }
    const payload = { id: round, lessonId: 1, contentVersion: 1, startedAt: 1000, status: 'active', questionIndices: [0,1], index: 0, records: [], wrongAttempts: 0, hintLevel: 0, currentMs: 0, answered: false, observation: { note:'fake assessment' } };
    const save = (uid, sid, rev, value) => asUser(uid,'select public.readtech_save_session($1,$2::jsonb,$3) as saved',[sid,JSON.stringify(value),rev]);
    assert.equal((await asUser(pupil,'select id from public.readtech_students')).rows.length,1);
    assert.equal((await asUser(pupil,'select id from public.readtech_teachers')).rows.length,0);
    assert.equal((await save(pupil,student,0,payload)).rows[0].saved.revision,1);
    assert.equal((await save(pupil,student,0,payload)).rows[0].saved.revision,1);
    assert.equal((await asUser(pupil,'select payload from public.readtech_sessions')).rows[0].payload.observation,undefined);
    assert.equal((await asUser(peer,'select id from public.readtech_sessions')).rows.length,0);
    await assert.rejects(save(peer,student,1,payload),e=>e.code==='42501');
    await assert.rejects(save(pupil,another,0,{...payload,id:'77777777-7777-4777-8777-777777777777'}),e=>e.code==='42501');
    await assert.rejects(asUser(pupil,'update public.readtech_students set auth_user_id=$1 where id=$2',[peer,student]),e=>e.code==='42501');
    await assert.rejects(asUser(pupil,'insert into public.readtech_students(teacher_id,code,display_name) values($1,$2,$3)',[teacher,'EVIL','แอบสมัคร']),e=>e.code==='42501');
    assert.equal((await asUser(pupil,'update public.readtech_students set display_name=$1 where id=$2 returning id',['เปลี่ยนชื่อ',student])).rows.length,0);
    await save(teacher,student,1,{...payload,observation:{note:'ครูตรวจแล้ว'}});
    await save(pupil,student,2,{...payload,hintLevel:1});
    assert.equal((await asUser(teacher,'select payload from public.readtech_sessions')).rows[0].payload.observation.note,'ครูตรวจแล้ว');
    await assert.rejects(save(pupil,student,2,{...payload,hintLevel:2}),e=>e.code==='40001');
    await db.query('update public.readtech_students set login_enabled=false where id=$1',[student]);
    assert.equal((await asUser(pupil,'select id from public.readtech_students')).rows.length,0);
    assert.equal((await asUser(pupil,'select id from public.readtech_sessions')).rows.length,0);
    await assert.rejects(save(pupil,student,3,payload),e=>e.code==='42501');
    assert.equal((await asUser(teacher,'select id from public.readtech_sessions')).rows.length,1);
    await db.query('update public.readtech_students set login_enabled=true where id=$1',[student]);
    await db.query('update public.readtech_teachers set active=false where id=$1',[teacher]);
    assert.equal((await asUser(pupil,'select id from public.readtech_students')).rows.length,0);
    await assert.rejects(save(pupil,student,3,payload),e=>e.code==='42501');
    await assert.rejects(db.transaction(async tx=>{await tx.exec('set local role anon');return tx.query('select * from public.readtech_students');}),e=>e.code==='42501');
  } finally { await db.close(); }
});
