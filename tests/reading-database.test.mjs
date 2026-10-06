import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('actual reading records require an active owning teacher, preserve identity and reject stale corrections',async()=>{
  const db=new PGlite();
  const teacher='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',pupil='33333333-3333-4333-8333-333333333333';
  const student='44444444-4444-4444-8444-444444444444',foreign='55555555-5555-4555-8555-555555555555',record='66666666-6666-4666-8666-666666666666';
  try{
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated,anon;
      insert into auth.users values('${teacher}'),('${other}'),('${pupil}');`);
    const directory=new URL('../supabase/migrations/',import.meta.url);
    for(const file of (await fs.readdir(directory)).filter(file=>file.endsWith('.sql')).sort())await db.exec(await fs.readFile(new URL(file,directory),'utf8'));
    await db.query('insert into public.readtech_teachers(id,display_name) values($1,$2),($3,$4)',[teacher,'ครูหนึ่ง',other,'ครูสอง']);
    await db.query('insert into public.readtech_students(id,teacher_id,code,display_name,auth_user_id,login_id,login_enabled) values($1,$2,$3,$4,$5,$3,true),($6,$7,$8,$9,null,null,false)',[student,teacher,'0123','นักอ่าน',pupil,foreign,other,'0124','นักอ่านอีกคน']);
    const asUser=(uid,sql,parameters=[])=>db.transaction(async tx=>{await tx.exec('set local role authenticated');await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[uid]);return tx.query(sql,parameters);});
    const insert=(uid,id,studentId=student,owner=teacher,correct=8,incorrect=2,skipped=1)=>asUser(uid,'insert into public.readtech_reading_assessments(id,student_id,teacher_id,correct_words,incorrect_words,skipped_words,help_level) values($1,$2,$3,$4,$5,$6,$7) returning *',[id,studentId,owner,correct,incorrect,skipped,'independent']);
    const first=(await insert(teacher,record)).rows[0];assert.equal(first.revision,1);assert.equal(first.reading_seconds,null);
    assert.equal((await asUser(teacher,'select * from public.readtech_reading_assessments')).rows.length,1);
    for(const uid of [other,pupil])assert.equal((await asUser(uid,'select * from public.readtech_reading_assessments')).rows.length,0);
    await assert.rejects(insert(pupil,'77777777-7777-4777-8777-777777777777'),error=>error.code==='42501');
    await assert.rejects(insert(other,'77777777-7777-4777-8777-777777777777'),error=>error.code==='42501');
    await assert.rejects(insert(teacher,'77777777-7777-4777-8777-777777777777',foreign),error=>error.code==='42501');
    await assert.rejects(insert(teacher,'77777777-7777-4777-8777-777777777777',student,teacher,0,0,0),error=>error.code==='23514');
    await assert.rejects(insert(teacher,'77777777-7777-4777-8777-777777777777',student,teacher,8,2,3),error=>error.code==='23514');
    await assert.rejects(asUser(teacher,'update public.readtech_reading_assessments set student_id=$1 where id=$2',[foreign,record]),error=>error.code==='42501');
    await assert.rejects(asUser(teacher,'update public.readtech_reading_assessments set revision=900 where id=$1',[record]),error=>error.code==='42501');
    await assert.rejects(asUser(teacher,'delete from public.readtech_reading_assessments where id=$1',[record]),error=>error.code==='42501');
    const updated=await asUser(teacher,'update public.readtech_reading_assessments set correct_words=7,incorrect_words=3 where id=$1 and revision=1 returning *',[record]);
    assert.equal(updated.rows[0].revision,2);assert.equal(updated.rows[0].student_id,student);
    assert.equal((await asUser(teacher,'update public.readtech_reading_assessments set note=$1 where id=$2 and revision=1 returning *',['stale',record])).rows.length,0);
    assert.equal((await asUser(pupil,'update public.readtech_reading_assessments set note=$1 where id=$2 returning *',['forged',record])).rows.length,0);
    await db.query('update public.readtech_teachers set active=false where id=$1',[teacher]);
    assert.equal((await asUser(teacher,'select * from public.readtech_reading_assessments')).rows.length,0);
    await assert.rejects(insert(teacher,'77777777-7777-4777-8777-777777777777'),error=>error.code==='42501');
    await assert.rejects(db.transaction(async tx=>{await tx.exec('set local role anon');return tx.query('select * from public.readtech_reading_assessments');}),error=>error.code==='42501');
  }finally{await db.close();}
});
