import {afterAll,afterEach,beforeAll,beforeEach,describe,it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import type {PGlite} from '@electric-sql/pglite';
import {createPolicyDatabase,ids} from './fixtures';
let db:PGlite;
const target='60000000-0000-4000-8000-000000000001';
beforeAll(async()=>{
 db=await createPolicyDatabase();
 await db.exec("alter table auth.users add column email text unique;alter table auth.users add column encrypted_password text;alter table auth.users add column raw_app_meta_data jsonb not null default '{}';create table auth.sessions(id uuid primary key,user_id uuid);create table auth.refresh_tokens(id text primary key,user_id text)");
 for(const file of ['202611080003_temporary_accounts.sql','202611080004_pilot_release.sql','202611080005_five_digit_student_ids.sql','202611080006_two_pilot_administrators.sql','202611080007_reusable_temporary_accounts.sql','202611080008_account_recovery_and_deletion.sql'])await db.exec(await readFile(`supabase/migrations/${file}`,'utf8'));
});
beforeEach(async()=>{
 await db.exec('begin');
 await db.query("insert into auth.users(id,email,encrypted_password,raw_app_meta_data,raw_user_meta_data) values($1,'tmp_recovery@accounts.mpms.invalid','old-hash',jsonb_build_object('credential_version',0),'{}')",[target]);
 await db.query("select public.initialize_provisioned_account($1,'가상복구학생','21421','MALE','STUDENT',null,null)",[target]);
 await db.query("update auth.users set email='recovery_user@accounts.mpms.invalid',encrypted_password='configured-hash',raw_app_meta_data=jsonb_build_object('credential_version',1) where id=$1",[target]);
 await db.query('insert into auth.sessions values($1,$1)',[target]);
 await db.query("insert into auth.refresh_tokens values('old-refresh',$1)",[target]);
});
afterEach(async()=>{await db.exec('rollback');});afterAll(async()=>{await db?.close();});
async function start(operation='reissue',actor=ids.teacher,name='가상복구학생'){
 const result=await db.query<{data:{operationId:string;credentialVersion:number}}>("select public.begin_managed_account_action($1,$2,$3,$4,'tmp_reissued123','sealed-password-envelope-test') as data",[actor,target,name,operation]);
 return result.rows[0].data;
}
describe('L5 account recovery and deletion',()=>{
 it('rejects an L4 actor',async()=>{await expect(start('reissue',ids.executive)).rejects.toThrow('L5_REQUIRED');});
 it('requires the exact target name',async()=>{await expect(start('delete',ids.teacher,'다른이름')).rejects.toThrow('CONFIRM_NAME_REQUIRED');});
 it('forbids managing the current operator account',async()=>{await expect(db.query("select public.begin_managed_account_action($1,$1,'가상담당자','delete',null,null)",[ids.teacher])).rejects.toThrow('SELF_ACCOUNT_ACTION_DENIED');});
 it('preserves identity and role but invalidates sessions and credential version',async()=>{
  const job=await start();expect(job.credentialVersion).toBe(2);
  const profile=(await db.query<{student_id:string;display_name:string;credentials_pending:boolean;login_id:string}>('select * from public.profiles where id=$1',[target])).rows[0];
  expect(profile).toMatchObject({student_id:'21421',display_name:'가상복구학생',credentials_pending:true,login_id:'tmp_reissued123'});
  expect((await db.query('select * from auth.sessions where user_id=$1',[target])).rows).toHaveLength(0);
  expect((await db.query('select * from auth.refresh_tokens where user_id=$1',[target])).rows).toHaveLength(0);
  expect((await db.query('select role_code from public.user_roles where user_id=$1',[target])).rows[0]).toMatchObject({role_code:'STUDENT'});
 });
 it('publishes encrypted temporary credentials only after confirming the Auth rotation',async()=>{
  const job=await start();
  await db.query("update auth.users set email='tmp_reissued123@accounts.mpms.invalid',encrypted_password='reissued-hash',raw_app_meta_data=jsonb_build_object('credential_version',$2::int,'maintenance_id',$3::text) where id=$1",[target,job.credentialVersion,job.operationId]);
  await db.query('select public.finish_account_reissue($1,$2,$3)',[ids.teacher,target,job.operationId]);
  expect((await db.query('select * from app_private.temporary_account_credentials where user_id=$1',[target])).rows).toHaveLength(1);
  expect((await db.query('select public.account_action_pending($1) as pending',[target])).rows[0]).toEqual({pending:false});
  await db.query("update auth.users set email='restored_user@accounts.mpms.invalid',encrypted_password='personal-hash',raw_app_meta_data=jsonb_build_object('credential_version',3) where id=$1",[target]);
  expect((await db.query('select * from app_private.temporary_account_credentials where user_id=$1',[target])).rows).toHaveLength(0);
 });
 it('refuses to finish if the Auth update failed',async()=>{const job=await start();await expect(db.query('select public.finish_account_reissue($1,$2,$3)',[ids.teacher,target,job.operationId])).rejects.toThrow('AUTH_UPDATE_NOT_CONFIRMED');});
 it('invalidates an older concurrent reissue operation',async()=>{const old=await start();await start();await expect(db.query('select public.finish_account_reissue($1,$2,$3)',[ids.teacher,target,old.operationId])).rejects.toThrow('STALE_ACCOUNT_ACTION');});
 it('blocks logins immediately when deletion begins',async()=>{await start('delete');expect((await db.query('select status,credentials_pending from public.profiles where id=$1',[target])).rows[0]).toEqual({status:'SUSPENDED',credentials_pending:true});});
 it('does not permit browser access to the service maintenance RPC',async()=>{await db.exec('set local role authenticated');await expect(start()).rejects.toThrow(/permission denied/);});
});
