import {expect,test,type Page} from '@playwright/test';
import {createSeed} from '../../src/lib/seed';

const id='00000000-0000-4000-8000-000000000099';
const user={id,aud:'authenticated',role:'authenticated',email:'browser-test@accounts.mpms.invalid',app_metadata:{},user_metadata:{},created_at:'2026-11-01T00:00:00Z'};
const member={id,name:'가상회원',role:'STUDENT',classId:'2-3',status:'ACTIVE',mustChangeCredentials:false};

async function mockBackend(page:Page){
  const control={fail:false,failAuth:false,hold:false,snapshots:0,commentWrites:0,release:()=>{}};
  let barrier:Promise<void>=Promise.resolve();
  control.release=()=>{};
  const session=()=>{
    const exp=Math.floor(Date.now()/1000)+3600;
    const encode=(data:unknown)=>Buffer.from(JSON.stringify(data)).toString('base64url');
    return {access_token:encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:id,role:'authenticated',exp})+'.fake-browser-signature',refresh_token:'fake-test-refresh',expires_in:3600,expires_at:exp,token_type:'bearer',user};
  };
  await page.route('https://auth-test.invalid/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(route.request().method()==='OPTIONS'){await route.fulfill({status:200,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'}});return;}
    let body:unknown={};
    if(path==='/auth/v1/token')body=session();
    else if(path==='/auth/v1/user'){
      if(control.failAuth){await route.fulfill({status:401,json:{msg:'simulated revoked session'}});return;}
      body=user;
    }
    else if(path==='/auth/v1/logout'){await route.fulfill({status:204});return;}
    else if(path.endsWith('/own_account'))body=member;
    else if(path.endsWith('/record_site_visit'))body={date:'2026-11-23',today:1,peak:1,total:1};
    else if(path.endsWith('/record_post_view'))body=1;
    else if(path==='/functions/v1/moderate-post'){
      control.commentWrites++;await route.fulfill({status:503,json:{error:'simulated save failure'}});return;
    }
    else if(path.endsWith('/community_snapshot')){
      control.snapshots++;
      if(control.hold)await barrier;
      if(control.fail){await route.fulfill({status:503,json:{message:'simulated offline backend'}});return;}
      const data=createSeed();data.currentMemberId=id;data.members=[member as typeof data.members[number]];
      data.posts=[{...data.posts[0],id:'private-test-post',status:'APPROVED',title:'가상 자료가 표시됩니다'}];body=data;
    }else{await route.abort();return;}
    await route.fulfill({status:200,json:body,headers:{'access-control-allow-origin':'*'}});
  });
  return {control,hold:()=>{control.hold=true;barrier=new Promise(resolve=>{control.release=resolve;});}};
}
async function login(page:Page){
  await page.goto('/#/login');await page.getByLabel('아이디',{exact:true}).fill('browser_test');
  await page.getByLabel('비밀번호',{exact:true}).fill('not-a-real-password');
  await page.getByRole('button',{name:'로그인',exact:true}).click();
}

test('signed-out cloud visitors see login rather than a missing-session error',async({page})=>{
  await mockBackend(page);await page.goto('/#/boards');
  await expect(page.getByRole('heading',{name:'회원 로그인'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'자료를 불러오지 못했어요'})).toHaveCount(0);
});

test('a failed snapshot has a persistent retry and recovers without losing the session',async({page})=>{
  const {control}=await mockBackend(page);control.fail=true;await login(page);
  await expect(page.getByRole('heading',{name:'자료를 불러오지 못했어요'})).toBeVisible();
  await expect(page.getByRole('link',{name:'가상 자료가 표시됩니다'})).toHaveCount(0);
  control.fail=false;await page.getByRole('button',{name:'다시 불러오기'}).click();
  await expect(page.getByRole('heading',{name:'소통해용.'})).toBeVisible();
  await page.reload();await expect(page.getByRole('heading',{name:'소통해용.'})).toBeVisible();
});

test('late authenticated reads cannot restore private screens after logout',async({page})=>{
  const mock=await mockBackend(page);await login(page);
  await expect(page.getByRole('heading',{name:'소통해용.'})).toBeVisible();
  const previous=mock.control.snapshots;mock.hold();await login(page);
  await expect.poll(()=>mock.control.snapshots).toBeGreaterThan(previous);
  await page.locator('.profile-links').getByRole('button',{name:'로그아웃'}).click();
  await expect(page.getByRole('heading',{name:'회원 로그인'})).toBeVisible();
  mock.control.hold=false;mock.control.release();
  await expect(page.getByRole('heading',{name:'회원 로그인'})).toBeVisible();
  await expect(page.getByRole('link',{name:'가상 자료가 표시됩니다'})).toHaveCount(0);
  await page.reload();await expect(page.getByRole('heading',{name:'회원 로그인'})).toBeVisible();
});

test('a rejected session cannot keep displaying previously loaded member content',async({page})=>{
  const {control}=await mockBackend(page);await login(page);await expect(page.getByRole('heading',{name:'소통해용.'})).toBeVisible();
  control.failAuth=true;await page.reload();await expect(page.getByRole('heading',{name:'자료를 불러오지 못했어요'})).toBeVisible();
  await expect(page.getByRole('link',{name:'가상 자료가 표시됩니다'})).toHaveCount(0);
});

test('a failed comment API preserves the draft for a deliberate retry',async({page})=>{
  const {control}=await mockBackend(page);await login(page);await expect(page.getByRole('heading',{name:'소통해용.'})).toBeVisible();
  await page.goto('/#/posts/private-test-post');await page.getByLabel('댓글 내용',{exact:true}).fill('서버 오류가 나도 보존할 가상 댓글입니다.');await page.getByRole('button',{name:'댓글 등록',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'댓글을 저장하지 못했습니다.'})).toBeVisible();await expect(page.getByLabel('댓글 내용',{exact:true})).toHaveValue('서버 오류가 나도 보존할 가상 댓글입니다.');expect(control.commentWrites).toBe(1);
  await expect(page.getByRole('button',{name:'댓글 등록',exact:true})).toBeEnabled();
});
