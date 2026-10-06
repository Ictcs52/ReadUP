import type { Page } from '@playwright/test';

// Existing lesson/audio tests run as an approved teacher using the local demonstration workspace.
export async function authenticatedDemo(page: Page) {
  const id='11111111-1111-4111-8111-111111111111';
  const encode=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const token=encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})+'.test';
  const session={access_token:token,refresh_token:'test-refresh',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user:{id,email:'demo@example.test',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-10-06'}};
  await page.addInitScript(session=>{if(!localStorage.getItem('sb-readtechtest-auth-token'))localStorage.setItem('sb-readtechtest-auth-token',JSON.stringify(session));},session);
  await page.route('**/cloud-config.json',route=>route.fulfill({json:{url:'https://readtechtest.supabase.co',publishableKey:'sb_publishable_test'}}));
  await page.route('https://readtechtest.supabase.co/**',route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/rest/v1/readtech_teachers')return route.fulfill({json:[{id,display_name:'ครูตัวอย่าง',active:true}]});
    if(path==='/rest/v1/readtech_students')return route.fulfill({json:[]});
    if(path==='/auth/v1/user')return route.fulfill({json:session.user});
    return route.fulfill({status:404,json:{message:'Unexpected endpoint'}});
  });
}
