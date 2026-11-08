import {afterAll,afterEach,beforeAll,beforeEach,describe,expect,it} from 'vitest';
import {readFile} from 'node:fs/promises';
import type {PGlite} from '@electric-sql/pglite';
import {createPolicyDatabase,ids} from './fixtures';
let db:PGlite;
beforeAll(async()=>{
 db=await createPolicyDatabase();
 await db.exec("alter table auth.users add column email text unique;alter table auth.users add column encrypted_password text;alter table auth.users add column raw_app_meta_data jsonb not null default '{}'");
 for(const file of ['202611080003_temporary_accounts.sql','202611080004_pilot_release.sql','202611080005_five_digit_student_ids.sql','202611080006_two_pilot_administrators.sql','202611080007_reusable_temporary_accounts.sql','202611080008_account_recovery_and_deletion.sql','202611080009_l4_information_department.sql','202611080010_l4_account_management.sql'])await db.exec(await readFile(`supabase/migrations/${file}`,'utf8'));
});
beforeEach(async()=>{await db.exec('begin');});afterEach(async()=>{await db.exec('rollback');});afterAll(async()=>{await db?.close();});
const uuid=(n:number)=>`80000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
async function issue(n:number,role='STUDENT'){
 await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,$2,'{\"display_name\":\"가상발급\"}')",[uuid(n),`tmp_pilot${n}@accounts.mpms.invalid`]);
 await db.query("select public.initialize_provisioned_account($1,'가상발급',$2,'FEMALE',$3,$4,null)",[uuid(n),role==='SUPERVISING_TEACHER'?null:`2${String(n).padStart(2,'0')}21`,role,role==='CLASS_OFFICER'?'CLASS_PRESIDENT':null]);
}
async function actor(id:string){await db.exec('set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[id]);}
async function post(author:string=ids.student,status='PENDING'){
 await db.exec('set local role service_role');return (await db.query<{id:string}>("select public.store_moderated_post($1,$2,'정중한 학교 의견','학교생활에 관한 정중하고 충분히 긴 의견입니다.',$3,'{}',null) as id",[author,author===ids.teacher?'notice':'free',status])).rows[0].id;
}
describe('pilot release: latest migration chain',()=>{
 it('restricts L4 to council executives and the information department director',async()=>{const roles=await db.query<{label:string}>('select label from public.roles where level=4 order by code');expect(roles.rows.map(r=>r.label)).toEqual(['학생회 회장단','정보통신부 부장']);await expect(db.query("update public.roles set level=4 where code='COUNCIL_OFFICER'")).rejects.toThrow(/l4_designated_positions_only/);});
 it('issues multiple accounts at every level, including L5',async()=>{for(const role of ['STUDENT','CLASS_OFFICER','COUNCIL_OFFICER','COUNCIL_EXECUTIVE','PR_DIRECTOR','SUPERVISING_TEACHER'])for(let i=1;i<=3;i++)await issue(['STUDENT','CLASS_OFFICER','COUNCIL_OFFICER','COUNCIL_EXECUTIVE','PR_DIRECTOR','SUPERVISING_TEACHER'].indexOf(role)*3+i,role);});
 it('allows an active L5 issuer to provision another L5',async()=>{await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,'tmp_l5extra@accounts.mpms.invalid','{}')",[uuid(1)]);await db.query("select public.initialize_provisioned_account($1,'가상관리자',null,null,'SUPERVISING_TEACHER',null,$2)",[uuid(1),ids.teacher]);});
 it('lets only L5 read encrypted pending credentials',async()=>{await issue(1);await db.query("select public.store_temporary_credential($1,$2)",[uuid(1),'encrypted-test-envelope-123456']);await actor(ids.teacher);const r=await db.query<{data:unknown[]}>('select public.pending_temporary_credentials() as data');expect(r.rows[0].data).toHaveLength(1);await db.exec('savepoint denied');await actor(ids.student);await expect(db.query('select public.pending_temporary_credentials()')).rejects.toThrow('L5_REQUIRED');await db.exec('rollback to savepoint denied');await actor(ids.officer);await expect(db.query('select public.pending_temporary_credentials()')).rejects.toThrow('L5_REQUIRED');await db.exec('rollback to savepoint denied');await actor(ids.teacher);await expect(db.query('select * from app_private.temporary_account_credentials')).rejects.toThrow(/permission denied/);});
 it('erases the saved password in the same transaction as first setup',async()=>{await issue(1);await db.query("select public.store_temporary_credential($1,$2)",[uuid(1),'encrypted-test-envelope-123456']);await db.query("update auth.users set email='changed_login@accounts.mpms.invalid',encrypted_password='changed-hash',raw_app_meta_data=jsonb_build_object('credential_version',1) where id=$1",[uuid(1)]);expect((await db.query('select * from app_private.temporary_account_credentials')).rows).toHaveLength(0);await expect(db.query("select public.store_temporary_credential($1,$2)",[uuid(1),'encrypted-test-envelope-123456'])).rejects.toThrow('TEMPORARY_ACCOUNT_REQUIRED');});
 it('does not let a student save or read temporary password records',async()=>{await issue(1);await actor(ids.student);await expect(db.query("select public.store_temporary_credential($1,$2)",[uuid(1),'encrypted-test-envelope-123456'])).rejects.toThrow(/permission denied/);});

 it('rejects automatic approval at the database service boundary',async()=>{await expect(post(ids.student,'APPROVED')).rejects.toThrow('HUMAN_APPROVAL_REQUIRED');});
 it('hides a clean post until another reviewer approves it',async()=>{const id=await post();await actor(ids.president);expect((await db.query('select id from public.posts where id=$1',[id])).rows).toHaveLength(0);await actor(ids.officer);await db.query("select public.review_post($1,'APPROVED',null)",[id]);await actor(ids.president);expect((await db.query('select id from public.posts where id=$1',[id])).rows).toHaveLength(1);});
 it('also queues official teacher posts and forbids self approval',async()=>{const id=await post(ids.teacher);await actor(ids.teacher);await expect(db.query("select public.review_post($1,'APPROVED',null)",[id])).rejects.toThrow('OTHER_REVIEWER_REQUIRED');});
 it('keeps temporary accounts out of post storage',async()=>{await issue(1);await expect(post(uuid(1))).rejects.toThrow('ACTIVE_MEMBER_REQUIRED');});
 it('does not expose unlimited issuing to the service role',async()=>{await db.exec('set local role service_role');await expect(db.query("select app_private.initialize_provisioned_account($1,'가상발급','20321','FEMALE','STUDENT',null,null)",[uuid(1)])).rejects.toThrow(/permission denied/);});
});
