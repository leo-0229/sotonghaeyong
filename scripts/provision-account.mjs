import {createClient} from '@supabase/supabase-js';
import {sealTemporaryPassword} from '../supabase/functions/_shared/temporary-vault.ts';
import {authEmail,parseStudentId,temporaryCredentials} from '../supabase/functions/_shared/accounts.ts';
const args=Object.fromEntries(process.argv.slice(2).map((v,i,a)=>v.startsWith('--')?[v.slice(2),a[i+1]]:null).filter(Boolean));
const roles=['STUDENT','CLASS_OFFICER','COUNCIL_OFFICER','COUNCIL_EXECUTIVE','PR_DIRECTOR','SUPERVISING_TEACHER'];
const role=args.role??'STUDENT';
if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw new Error('.env.admin.local에 운영자용 Supabase 설정이 필요합니다.');
if(args.email||args.password)throw new Error('이메일·비밀번호 인자를 사용하지 않습니다. 임시 아이디와 비밀번호를 자동 발급합니다.');
if(!args.name||args.name.length<2||args.name.length>30||!roles.includes(role))throw new Error('--name과 올바른 --role을 지정하세요.');
const student=role==='SUPERVISING_TEACHER'?null:parseStudentId(args['student-id']??'');
if(student&&!['MALE','FEMALE'].includes(args.gender))throw new Error('--gender MALE|FEMALE을 지정하세요.');
if(role==='CLASS_OFFICER'&&!['CLASS_PRESIDENT','CLASS_VICE_PRESIDENT'].includes(args.position))throw new Error('--position CLASS_PRESIDENT|CLASS_VICE_PRESIDENT를 지정하세요.');
const credentials=temporaryCredentials();
if(!/^[a-f0-9]{64}$/i.test(process.env.TEMP_CREDENTIAL_KEY??''))throw new Error('서버와 동일한 TEMP_CREDENTIAL_KEY 설정이 필요합니다.');
const client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const {data:{user},error}=await client.auth.admin.createUser({email:authEmail(credentials.loginId),password:credentials.password,email_confirm:true,user_metadata:{display_name:args.name.trim()},app_metadata:{credential_version:0}});
if(error||!user)throw new Error('임시 Auth 계정을 생성하지 못했습니다.');
const {error:setup}=await client.rpc('initialize_provisioned_account',{p_user:user.id,p_name:args.name.trim(),p_student_id:student?.studentId??null,p_gender:student?args.gender:null,p_role:role,p_position:args.position??null,p_issuer:null});
if(setup){const {error:cleanup}=await client.auth.admin.deleteUser(user.id);throw new Error(cleanup?'발급에 실패했습니다. 미완료 Auth 계정을 관리자에서 확인해 주세요.':`발급을 취소했습니다: ${setup.message}`);}
const sealed=await sealTemporaryPassword(process.env.TEMP_CREDENTIAL_KEY,user.id,credentials.password);
const {error:storageError}=await client.rpc('store_temporary_credential',{p_user:user.id,p_sealed:sealed});
if(storageError){await client.auth.admin.deleteUser(user.id);throw new Error('임시 로그인 정보 보관에 실패해 발급을 취소했습니다.');}
console.log('임시 계정을 발급했습니다. 최초 설정 전까지 L5만 임시 로그인 정보를 다시 확인할 수 있습니다. 다음 정보를 해당 회원에게 개별 전달하세요.');
console.log(`이름: ${args.name}\n학번: ${student?.studentId??'교직원'}\n임시 아이디: ${credentials.loginId}\n임시 비밀번호: ${credentials.password}\n첫 로그인 후 아이디와 비밀번호를 반드시 변경해야 합니다.`);
