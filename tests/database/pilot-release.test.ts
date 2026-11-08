import {afterAll,afterEach,beforeAll,beforeEach,describe,expect,it} from 'vitest';
import {readFile} from 'node:fs/promises';
import type {PGlite} from '@electric-sql/pglite';
import {createPolicyDatabase,ids} from './fixtures';
let db:PGlite;
beforeAll(async()=>{
 db=await createPolicyDatabase();
 await db.exec("alter table auth.users add column email text unique;alter table auth.users add column encrypted_password text;alter table auth.users add column raw_app_meta_data jsonb not null default '{}'");
 for(const file of ['202611080003_temporary_accounts.sql','202611080004_pilot_release.sql','202611080005_five_digit_student_ids.sql','202611080006_two_pilot_administrators.sql'])await db.exec(await readFile(`supabase/migrations/${file}`,'utf8'));
});
beforeEach(async()=>{await db.exec('begin');});afterEach(async()=>{await db.exec('rollback');});afterAll(async()=>{await db?.close();});
const uuid=(n:number)=>`80000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
async function issue(n:number,role='STUDENT'){
 await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,$2,'{\"display_name\":\"가상발급\"}')",[uuid(n),`tmp_pilot${n}@accounts.mpms.invalid`]);
 await db.query("select public.initialize_provisioned_account($1,'가상발급',$2,'FEMALE',$3,$4,null)",[uuid(n),role==='SUPERVISING_TEACHER'?null:`204${String(n+20).padStart(2,'0')}`,role,role==='CLASS_OFFICER'?'CLASS_PRESIDENT':null]);
}
async function actor(id:string){await db.exec('set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[id]);}
async function post(author:string=ids.student,status='PENDING'){
 await db.exec('set local role service_role');return (await db.query<{id:string}>("select public.store_moderated_post($1,$2,'정중한 학교 의견','학교생활에 관한 정중하고 충분히 긴 의견입니다.',$3,'{}',null) as id",[author,author===ids.teacher?'notice':'free',status])).rows[0].id;
}
describe('pilot release: latest migration chain',()=>{
 it('allows two L5 accounts but refuses a third',async()=>{await issue(1,'SUPERVISING_TEACHER');await issue(2,'SUPERVISING_TEACHER');await expect(issue(3,'SUPERVISING_TEACHER')).rejects.toThrow('PILOT_LEVEL_LIMIT');});
 it('moves an L4 account to the second L5 slot and blocks another promotion',async()=>{await issue(1,'SUPERVISING_TEACHER');await issue(2,'COUNCIL_EXECUTIVE');await db.query("update public.user_roles set role_code='SUPERVISING_TEACHER' where user_id=$1",[uuid(2)]);await issue(3,'COUNCIL_OFFICER');await expect(db.query("update public.user_roles set role_code='SUPERVISING_TEACHER' where user_id=$1",[uuid(3)])).rejects.toThrow('PILOT_LEVEL_LIMIT');});
 it('rejects automatic approval at the database service boundary',async()=>{await expect(post(ids.student,'APPROVED')).rejects.toThrow('HUMAN_APPROVAL_REQUIRED');});
 it('hides a clean post until another reviewer approves it',async()=>{const id=await post();await actor(ids.president);expect((await db.query('select id from public.posts where id=$1',[id])).rows).toHaveLength(0);await actor(ids.officer);await db.query("select public.review_post($1,'APPROVED',null)",[id]);await actor(ids.president);expect((await db.query('select id from public.posts where id=$1',[id])).rows).toHaveLength(1);});
 it('also queues official teacher posts and forbids self approval',async()=>{const id=await post(ids.teacher);await actor(ids.teacher);await expect(db.query("select public.review_post($1,'APPROVED',null)",[id])).rejects.toThrow('OTHER_REVIEWER_REQUIRED');});
 it('keeps temporary accounts out of post storage',async()=>{await issue(1);await expect(post(uuid(1))).rejects.toThrow('ACTIVE_MEMBER_REQUIRED');});
 it('issues exactly one account for each of the five numeric levels',async()=>{for(const [i,r]of ['STUDENT','CLASS_OFFICER','COUNCIL_OFFICER','COUNCIL_EXECUTIVE','SUPERVISING_TEACHER'].entries())await issue(i+1,r);const rows=(await db.query<{level:number}>('select level from app_private.pilot_account_slots order by level')).rows;expect(rows.map(r=>r.level)).toEqual([1,2,3,4,5]);});
 it('blocks a second account even while the first awaits credential changes',async()=>{await issue(1);await expect(issue(2)).rejects.toThrow('PILOT_LEVEL_LIMIT');});
 it('counts both executive and PR positions in the same L4 slot',async()=>{await issue(1,'COUNCIL_EXECUTIVE');await expect(issue(2,'PR_DIRECTOR')).rejects.toThrow('PILOT_LEVEL_LIMIT');});
 it('does not free a slot by suspending its account',async()=>{await issue(1);await db.query("update public.profiles set status='SUSPENDED' where id=$1",[uuid(1)]);await expect(issue(2)).rejects.toThrow('PILOT_LEVEL_LIMIT');});
 it('blocks moving an issued account into an occupied level',async()=>{await issue(1);await issue(2,'COUNCIL_OFFICER');await expect(db.query("update public.user_roles set role_code='COUNCIL_OFFICER' where user_id=$1",[uuid(1)])).rejects.toThrow('PILOT_LEVEL_LIMIT');});
 it('keeps quota storage private from browser clients',async()=>{await actor(ids.teacher);await expect(db.query('select * from app_private.pilot_account_slots')).rejects.toThrow(/permission denied/);});
 it('does not expose unlimited issuing to the service role',async()=>{await db.exec('set local role service_role');await expect(db.query("select app_private.initialize_provisioned_account($1,'가상발급','20321','FEMALE','STUDENT',null,null)",[uuid(1)])).rejects.toThrow(/permission denied/);});
});
