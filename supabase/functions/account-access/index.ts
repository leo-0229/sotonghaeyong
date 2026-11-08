import {createClient} from 'npm:@supabase/supabase-js@2.119.0';
import {authEmail,parseStudentId,temporaryCredentials,validateCredentials} from '../_shared/accounts.ts';
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin')??'';const allowed=(Deno.env.get('ALLOWED_ORIGINS')??'').split(',').map(x=>x.trim());
 if(!allowed.includes(origin))return new Response('Origin not allowed',{status:403});
 const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 try{
  const url=Deno.env.get('SUPABASE_URL')!;const key=Deno.env.get('SUPABASE_ANON_KEY')!;
  const jwt=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');if(!jwt)return reply({error:'로그인이 필요합니다.'},401);
  const caller=createClient(url,key,{global:{headers:{Authorization:`Bearer ${jwt}`}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:authError}=await caller.auth.getUser(jwt);if(authError||!user)return reply({error:'로그인이 필요합니다.'},401);
  const raw=await req.text();if(raw.length>8000)return reply({error:'요청 크기가 너무 큽니다.'},413);const input=JSON.parse(raw);
  const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  if(input.operation==='issue'){
   const {data:lvl,error:permissionError}=await caller.rpc('current_level');if(permissionError||lvl!==5)return reply({error:'담당 교사만 임시 계정을 발급할 수 있습니다.'},403);
   if(typeof input.name!=='string'||input.name.trim().length<2||input.name.trim().length>30||!['MALE','FEMALE'].includes(input.gender)||typeof input.studentId!=='string')return reply({error:'학번·이름·성별을 확인해 주세요.'},400);
   const student=parseStudentId(input.studentId);const role=input.role??'STUDENT';
   if(!['STUDENT','CLASS_OFFICER','COUNCIL_OFFICER','COUNCIL_EXECUTIVE','PR_DIRECTOR'].includes(role))return reply({error:'허용되지 않은 등급입니다.'},400);
   const {error:rate}=await admin.rpc('reserve_account_request',{p_user:user.id,p_operation:'issue'});if(rate)return reply({error:'발급 요청이 많습니다. 잠시 후 다시 시도해 주세요.'},429);
   const credentials=temporaryCredentials();
   const {data:{user:created},error}=await admin.auth.admin.createUser({email:authEmail(credentials.loginId),password:credentials.password,email_confirm:true,user_metadata:{display_name:input.name.trim()},app_metadata:{credential_version:0}});
   if(error||!created)return reply({error:'임시 계정을 발급하지 못했습니다.'},400);
   const {error:setup}=await admin.rpc('initialize_provisioned_account',{p_user:created.id,p_name:input.name.trim(),p_student_id:student.studentId,p_gender:input.gender,p_role:role,p_position:input.position??null,p_issuer:user.id});
   if(setup){await admin.auth.admin.deleteUser(created.id);return reply({error:setup.message?.includes('PILOT_LEVEL_LIMIT')?'임시 운영에서는 레벨별 계정을 1개씩만 발급합니다. L4 직책은 한 자리를 공유합니다.':'학번 중복 여부와 학급 직책을 확인해 주세요. 계정 발급을 완료하지 못했습니다.'},409);}
   return reply({...credentials,studentId:student.studentId,name:input.name.trim()});
  }
  if(input.operation==='change'){
   const {data:account,error}=await caller.rpc('own_account');if(error||account?.status!=='ACTIVE'||!account.loginId)return reply({error:'이용 가능한 발급 계정을 확인해 주세요.'},403);
   if(typeof input.loginId!=='string'||typeof input.currentPassword!=='string'||typeof input.newPassword!=='string')return reply({error:'로그인 정보를 확인해 주세요.'},400);
   const loginId=validateCredentials(account.loginId,input.loginId,input.currentPassword,input.newPassword);
   const {error:rate}=await admin.rpc('reserve_account_request',{p_user:user.id,p_operation:'change'});if(rate)return reply({error:'변경 요청이 많습니다. 잠시 후 다시 시도해 주세요.'},429);
   const verifier=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
   const {data:verified,error:verifyError}=await verifier.auth.signInWithPassword({email:user.email!,password:input.currentPassword});
   if(verifyError||verified.user?.id!==user.id)return reply({error:'현재 비밀번호가 일치하지 않습니다.'},401);
   await verifier.auth.signOut({scope:'local'});
   const {data:existing,error:lookupError}=await admin.from('profiles').select('id').eq('login_id',loginId).neq('id',user.id).maybeSingle();
   if(lookupError)return reply({error:'아이디 사용 여부를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.'},503);
   if(existing)return reply({error:'이미 사용 중인 아이디입니다. 다른 아이디를 선택해 주세요.'},409);
   // Revoke all old refresh tokens before rotating. A previous temporary session
   // must not be able to refresh itself into the new credential version.
   const {error:revokeError}=await admin.auth.admin.signOut(jwt,'global');
   if(revokeError)return reply({error:'기존 세션을 정리하지 못해 변경을 진행하지 않았습니다. 다시 시도해 주세요.'},503);
   const version=Number(account.credentialVersion)+1;
   const {error:changeError}=await admin.auth.admin.updateUserById(user.id,{email:authEmail(loginId),email_confirm:true,password:input.newPassword,app_metadata:{...user.app_metadata,credential_version:version}});
   if(changeError)return reply({error:'아이디 중복 여부와 비밀번호 조건을 확인해 주세요.'},409);
   const {data:updated}=await admin.from('profiles').select('login_id,credentials_pending,credential_version').eq('id',user.id).single();
   if(updated?.login_id!==loginId||updated?.credentials_pending||updated?.credential_version!==version)return reply({error:'변경 상태 확인이 필요합니다. 담당 교사에게 문의해 주세요.'},500);
   // Old JWTs retain the old version and lose all community permissions immediately.
   return reply({loginId});
  }
  return reply({error:'허용되지 않은 요청입니다.'},400);
 }catch(e){return reply({error:e instanceof Error&&/학번|아이디|비밀번호/.test(e.message)?e.message:'계정 요청을 처리하지 못했습니다.'},400);}
});
