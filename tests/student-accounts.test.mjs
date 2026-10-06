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
  let handler; let next=1; let failLink=false; let failEdit=false; let holdAuth=null;
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
      const account=accounts.find(a=>a.user.id===id);
      if(body.email){
        if(accounts.some(a=>a.user.id!==id&&a.user.email===body.email&&!deleted.includes(a.user.id)))return result({error_code:'email_exists',msg:'exists'},422);
        if(holdAuth)await holdAuth;
        account.user.email=body.email;
      }
      if(body.password)account.password=body.password;
      return result({user:account.user});
    }
    if(url.pathname==='/rest/v1/readtech_students') {
      const id=url.searchParams.get('id')?.slice(3),owner=url.searchParams.get('teacher_id')?.slice(3),code=url.searchParams.get('code')?.slice(3);
      if(method==='POST') { const value={...body,id:`student-${next++}`,created_at:'2026-10-06'};students.push(value);return result(value,201); }
      const matches=s=>[...url.searchParams].every(([key,value])=>{
        if(['select','or'].includes(key))return true;
        if(value.startsWith('eq.'))return String(s[key]??'')===value.slice(3);
        if(value.startsWith('neq.'))return String(s[key]??'')!==value.slice(4);
        if(value==='is.null')return s[key]==null;
        return true;
      });
      const value=students.find(matches);
      if(method==='PATCH') {
        if(failEdit && body.code)return result({code:'PGRST116',message:'no rows'},406);
        if(body.account_edit_token && value?.account_edit_token && Date.parse(value.account_edit_until)>Date.now())return result(null);
        if(failLink && body.auth_user_id) return result({code:'PGRST116',message:'no rows'},406);
        if(!value)return result({code:'PGRST116'},406);Object.assign(value,body);
      }
      const selected=url.searchParams.get('select');
      return result(value&&selected?Object.fromEntries(selected.split(',').map(key=>[key,value[key]])):value??null);
    }
    throw new Error(`Unhandled ${method} ${url.pathname}`);
  };
  try {
    vm.runInNewContext(code,{createClient,crypto,Response,AbortSignal,fetch:(...args)=>globalThis.fetch(...args),Uint8Array,JSON,Number,String,Deno:{env:{get:name=>name==='SUPABASE_URL'?'https://isolated.test':'server-test-key'},serve:fn=>{handler=fn;}}});
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
    const editBody=(code='0124')=>({action:'edit',studentId:id,code,name:'ชื่อแก้แล้ว',className:'ป.2/2',expected:{code:students[0].code,name:students[0].display_name,className:students[0].class_name}});
    assert.equal((await invoke(editBody(),'student-token')).status,403);
    assert.equal((await invoke(editBody(),'peer-token')).status,403);
    assert.equal((await invoke({...editBody(),code:'123'})).status,400);
    assert.equal((await invoke({...editBody(),expected:{}})).status,409);
    const previousPassword=accounts[0].password;
    failEdit=true;
    assert.equal((await invoke(editBody())).status,409);
    assert.equal(accounts[0].user.email,'student-0123@students.readup.invalid','failed profile save rolls back the Auth username');
    assert.equal(students[0].code,'0123');assert.equal(students[0].account_edit_token,null);
    failEdit=false;
    const edited=await invoke(editBody());assert.equal(edited.status,200);
    assert.equal(edited.body.student.id,id);assert.equal(edited.body.student.code,'0124');assert.equal(edited.body.student.class_name,'ป.2/2');
    assert.equal(accounts[0].user.email,'student-0124@students.readup.invalid');assert.equal(accounts[0].password,previousPassword,'editing identity does not silently reset the password');
    assert.equal(edited.body.password,'');assert.equal(edited.body.student.account_edit_token,undefined);
    assert.equal((await invoke(editBody('0002'))).status,409);
    const otherAccount=await invoke({action:'register',code:'9999',name:'อีกครู',className:'ป.1'},'peer-token');assert.equal(otherAccount.status,200);
    assert.equal((await invoke(editBody('9999'))).status,409);assert.equal(students[0].code,'0124');assert.equal(students[0].account_edit_token,null);
    let release;holdAuth=new Promise(resolve=>{release=resolve;});
    const concurrentBody=editBody('0125');const inFlight=invoke(concurrentBody);
    while(!students[0].account_edit_token)await new Promise(resolve=>setTimeout(resolve,0));
    assert.equal((await invoke(concurrentBody)).status,409,'simultaneous identity edits are rejected while a lease is active');
    release();holdAuth=null;assert.equal((await inFlight).status,200);assert.equal(students[0].login_id,'0125');
    assert.equal(accounts[0].user.email,'student-0125@students.readup.invalid');
    assert.equal((await invoke({...concurrentBody,code:'0126'})).status,409,'stale forms cannot overwrite a later edit');

  } finally { globalThis.fetch=originalFetch; }
});
