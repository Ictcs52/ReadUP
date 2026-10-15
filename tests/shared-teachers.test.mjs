import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('approved teachers share students and sessions, while writes and pupil access remain scoped', async () => {
  const db = new PGlite();
  const a='11111111-1111-4111-8111-111111111111', b='22222222-2222-4222-8222-222222222222', pupil='33333333-3333-4333-8333-333333333333', student='44444444-4444-4444-8444-444444444444', round='55555555-5555-4555-8555-555555555555', stranger='66666666-6666-4666-8666-666666666666';
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated,anon; insert into auth.users values('${a}'),('${b}'),('${pupil}'),('${stranger}');`);
    const dir=new URL('../supabase/migrations/',import.meta.url);
    for(const file of (await fs.readdir(dir)).filter(f=>f.endsWith('.sql')).sort()) await db.exec(await fs.readFile(new URL(file,dir),'utf8'));
    await db.query('insert into readtech_teachers(id,display_name) values($1,$2),($3,$4)',[a,'ครูหนึ่ง',b,'ครูสอง']);
    await db.query('insert into readtech_students(id,teacher_id,code,display_name,auth_user_id,login_id) values($1,$2,$3,$4,$5,$3)',[student,a,'0123','นักอ่าน',pupil]);
    const asUser=(uid,sql,params=[])=>db.transaction(async tx=>{await tx.exec('set local role authenticated');await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[uid]);return tx.query(sql,params);});
    const payload={id:round,lessonId:1,contentVersion:1,startedAt:1000,status:'active',questionIndices:[0],index:0,records:[],wrongAttempts:0,hintLevel:0,currentMs:0,answered:false};
    await asUser(pupil,'select readtech_save_session($1,$2::jsonb,0)',[student,JSON.stringify(payload)]);
    for(const table of ['readtech_students','readtech_sessions']) {
      assert.equal((await asUser(b,`select id from ${table}`)).rows.length,1);
      assert.equal((await asUser(stranger,`select id from ${table}`)).rows.length,0);
      await assert.rejects(db.transaction(async tx=>{await tx.exec('set local role anon');return tx.query(`select id from ${table}`);}),e=>e.code==='42501');
    }
    assert.equal((await asUser(b,'update readtech_students set class_name=$1 where id=$2 returning id',['ป.2',student])).rows.length,0);
    await assert.rejects(asUser(b,'select readtech_save_session($1,$2::jsonb,1)',[student,JSON.stringify({...payload,hintLevel:1})]),e=>e.code==='42501');
    await db.query('update readtech_teachers set active=false where id=$1',[b]);
    for(const table of ['readtech_students','readtech_sessions']) assert.equal((await asUser(b,`select id from ${table}`)).rows.length,0);
    assert.equal((await asUser(pupil,'select id from readtech_students')).rows.length,1);
  } finally { await db.close(); }
});
