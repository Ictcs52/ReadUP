import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { createClient } from '@supabase/supabase-js';

// Exercise the deployed function body with the real SDK against an isolated HTTP backend.
test('student account endpoint authenticates teacher, checks ownership, provisions credentials, resets and disables', async () => {
  const source = await fs.readFile(new URL('../supabase/functions/readtech-student-accounts/index.ts', import.meta.url), 'utf8');
  const code = stripTypeScriptTypes(source.replace(/^import .*createClient.*;\n/, ''));
  let handler; let next=1; let failLink=false;
  const students=[]; const users=new Map(); const deleted=[]; const accounts=[];
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async (input,init={}) => {
    const url=new URL(typeof input==='string'?input:input.url??String(input));
    const method=init.method??'GET'; const body=init.body?JSON.parse(init.body):null;
    const result=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
    if(url.pathname==='/auth/v1/user') {
      const bearer=new Headers(init.headers).get('authorization')?.replace('Bearer ','');
      return users.has(bearer)?result({id:users.get(bearer)}):result({msg:'invalid',code:'bad_jwt'},401);
    }
    if(url.pathname==='/rest/v1/readtech_teachers') {
      const uid=url.searchParams.get('id')?.slice(3);
      return result(['teacher','other-teacher'].includes(uid)?{id:uid}:null);
    }
    if(url.pathname==='/auth/v1/admin/users' && method==='POST') {
      if(accounts.some(a=>a.user.email===body.email&&!deleted.includes(a.user.id)))return result({error_code:'email_exists',msg:'exists'},422);
      const user={id:crypto.randomUUID(),email:body.email};accounts.push({user,password:body.password});return result({user});
    }
    if(url.pathname.startsWith('/auth/v1/admin/users/')) {
      const id=url.pathname.split('/').pop();
      if(method==='DELETE') {deleted.push(id);return result({user:{id}});}
      accounts.find(a=>a.user.id===id).password=body.password;return result({user:{id}});
    }
    if(url.pathname==='/rest/v1/readtech_students') {
      const id=url.searchParams.get('id')?.slice(3),owner=url.searchParams.get('teacher_id')?.slice(3),code=url.searchParams.get('code')?.slice(3);
      if(method==='POST') { const value={...body,id:`student-${next++}`,created_at:'2026-10-06'};students.push(value);return result(value,201); }
      const value=students.find(s=>(!id||s.id===id)&&(!owner||s.teacher_id===owner)&&(!code||s.code===code));
      if(method==='PATCH') {
        if(failLink && body.auth_user_id) return result({code:'PGRST116',message:'no rows'},406);
        if(!value)return result({code:'PGRST116'},406);Object.assign(value,body);
      }
      return result(value??null);
    }
    throw new Error(`Unhandled ${method} ${url.pathname}`);
  };
  try {
    vm.runInNewContext(code,{createClient,crypto,Response,Uint8Array,JSON,Number,String,Deno:{env:{get:name=>name==='SUPABASE_URL'?'https://isolated.test':'server-test-key'},serve:fn=>{handler=fn;}}});
    users.set('teacher-token','teacher');users.set('peer-token','other-teacher');users.set('student-token','student-auth');
    async function invoke(body,token='teacher-token') {
      const response=await handler(new Request('https://isolated.test/functions/v1/readtech-student-accounts',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)}));
      return {status:response.status,body:await response.json()};
    }
    assert.equal((await invoke({action:'register'},null)).status,401);
    assert.equal((await invoke({action:'register'},'invalid')).status,401);
    assert.equal((await invoke({action:'register'},'student-token')).status,403);
    for(const invalid of ['123','12345','12ab',1234]) assert.equal((await invoke({action:'register',code:invalid,name:'เด็ก',className:'ป.1'})).status,400);
    assert.equal((await invoke({action:'register',code:'0123',name:'เด็ก',className:''})).status,400);
    assert.equal(accounts.length,0);
    const registered=await invoke({action:'register',code:'0123',name:'นักอ่านหนึ่ง นามสกุล',className:'ป.1/1'});
    assert.equal(registered.status,200);assert.equal(registered.body.loginId,'0123');assert.equal(registered.body.password,'RT-0123');assert.equal(registered.body.student.class_name,'ป.1/1');
    assert.equal(accounts[0].user.email,`student-${registered.body.loginId}@students.readup.invalid`);
    assert.equal(students[0].teacher_id,'teacher');
    const id='11111111-1111-4111-8111-111111111111';students[0].id=id;
    assert.equal((await invoke({action:'reset',studentId:id},'peer-token')).status,403);
    assert.equal((await invoke({action:'register',code:'0123',name:'ซ้ำ',className:'ป.1/1'})).status,409);
    assert.equal((await invoke({action:'register',code:'0123',name:'ซ้ำต่างครู',className:'ป.2'},'peer-token')).status,409);
    const reset=await invoke({action:'reset',studentId:id});assert.equal(reset.status,200);assert.equal(accounts[0].password,reset.body.password);assert.equal(reset.body.password,'RT-0123');
    assert.equal((await invoke({action:'disable',studentId:id})).body.student.login_enabled,false);
    assert.equal((await invoke({action:'enable',studentId:id})).body.student.login_enabled,true);
    assert.equal((await invoke({action:'register',studentId:id})).status,409);
    // Existing learners retain identity and history when an account is attached.
    const existing={id:'22222222-2222-4222-8222-222222222222',teacher_id:'teacher',code:'0002',display_name:'คนเดิม',class_name:'',auth_user_id:null};students.push(existing);
    failLink=true;
    assert.equal((await invoke({action:'register',studentId:existing.id})).status,409);assert.equal(deleted.length,1,'a failed concurrent link cleans up its unused auth account');
    failLink=false;
    const attached=await invoke({action:'register',studentId:existing.id});assert.equal(attached.status,200);assert.equal(attached.body.student.id,existing.id);assert.equal(attached.body.student.code,'0002');
    assert.equal(accounts.length,3);
    const legacy={id:'33333333-3333-4333-8333-333333333333',teacher_id:'teacher',code:'OLD',display_name:'เดิม',auth_user_id:accounts[0].user.id,login_id:'1234567890'};students.push(legacy);
    const legacyReset=await invoke({action:'reset',studentId:legacy.id});assert.equal(legacyReset.status,200);assert.match(legacyReset.body.password,/^[0-9]{12}$/);
  } finally { globalThis.fetch=originalFetch; }
});
