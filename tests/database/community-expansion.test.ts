import {afterAll,afterEach,beforeAll,beforeEach,describe,it,expect} from 'vitest';
import {readFile,readdir} from 'node:fs/promises';
import type {PGlite} from '@electric-sql/pglite';
import {createPolicyDatabase,ids} from './fixtures';
let db:PGlite;
beforeAll(async()=>{
 db=await createPolicyDatabase();
 await db.exec("alter table auth.users add column email text unique;alter table auth.users add column encrypted_password text;alter table auth.users add column raw_app_meta_data jsonb not null default '{}';create table auth.sessions(id uuid primary key,user_id uuid);create table auth.refresh_tokens(id text primary key,user_id text)");
 for(const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')&&f>='202611080003').sort()){
  try{await db.exec(await readFile(`supabase/migrations/${file}`,'utf8'));}catch(error){throw new Error(`Migration ${file}: ${error}`);}
 }
});
beforeEach(async()=>{await db.exec('begin');});afterEach(async()=>{await db.exec('rollback');});afterAll(async()=>{await db?.close();});
async function actor(id:string){await db.exec('set local role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[id]);}
async function service(){await db.exec('set local role service_role');}
const mutate=(operation:string,payload:unknown)=>db.query('select public.community_mutate($1,$2::jsonb)',[operation,JSON.stringify(payload)]);
async function savePost(user=ids.student,status='PENDING',id:string|null=null,prefix='이야기해용',verified=false){
 await service();return (await db.query<{id:string}>("select public.store_moderated_post($1,'free','수정한 게시글 제목','충분히 긴 수정 게시글 본문입니다.',$2,'{}',$3,$4,$5) as id",[user,status,id,prefix,verified])).rows[0].id;
}
async function suggestion(visibility='PRIVATE',status='PENDING',verified=false){await service();return (await db.query<{id:string}>("select public.store_moderated_suggestion($1,'학교에 제안해요','학교 시설','충분히 구체적인 학교 건의 본문입니다.',$2,$3,'{}',$4) as id",[ids.student,visibility,status,verified])).rows[0].id;}
const mentor='90000000-0000-4000-8000-000000000001',mentee='90000000-0000-4000-8000-000000000002';
async function match(){
 await actor(ids.president);await mutate('apply_mentoring',{application:{id:mentor,kind:'멘토',goal:'학교생활을 도와줄 수 있습니다.'}});
 await actor(ids.student);await mutate('apply_mentoring',{application:{id:mentee,kind:'멘티',goal:'학교생활에 도움을 받고 싶습니다.'}});
 await actor(ids.officer);await mutate('match_mentoring',{ids:[mentor,mentee]});
}
describe('board editing and rule publication',()=>{
 it('keeps revisions, original creation time and requeues approved edits',async()=>{
  await db.query("update public.posts set status='APPROVED',prefix='예전말머리' where id=$1",[ids.post]);
  const before=(await db.query<{created_at:Date}>('select created_at from public.posts where id=$1',[ids.post])).rows[0].created_at;
  await savePost(ids.student,'PENDING',ids.post,'함께해용');await db.exec('reset role');
  const post=(await db.query('select status,prefix,created_at from public.posts where id=$1',[ids.post])).rows[0];expect(post).toMatchObject({status:'PENDING',prefix:'함께해용',created_at:before});
  expect((await db.query('select prefix,previous_status from public.post_revisions where post_id=$1',[ids.post])).rows[0]).toMatchObject({prefix:'예전말머리',previous_status:'APPROVED'});
 });
 it('requires a trusted clean server decision for automatic publication',async()=>{await expect(savePost(ids.student,'APPROVED')).rejects.toThrow('RULE_OR_HUMAN_APPROVAL_REQUIRED');});
 it('allows the trusted rule service to approve a clean post',async()=>{const id=await savePost(ids.student,'APPROVED',null,'이야기해용',true);await actor(ids.president);expect((await db.query('select id from public.posts where id=$1',[id])).rows).toHaveLength(1);});
 it('does not let another user edit a post',async()=>{await expect(savePost(ids.president,'PENDING',ids.post)).rejects.toThrow('NOT_EDITABLE_POST');});
 it('does not let authors bypass a moderator hide',async()=>{await db.query("update public.posts set status='HIDDEN' where id=$1",[ids.post]);await expect(savePost(ids.student,'PENDING',ids.post)).rejects.toThrow('NOT_EDITABLE_POST');});
 it('does not collect teacher names through legacy settings',async()=>{await actor(ids.teacher);await expect(mutate('moderation_settings',{teacherNames:['가상교사']})).rejects.toThrow('TEACHER_NAME_CHECK_DISABLED');});
});
describe('hearts and comment replies',()=>{
 it('toggles a heart without exposing the identities of other voters',async()=>{await db.query("update public.posts set status='APPROVED' where id=$1",[ids.post]);await actor(ids.student);expect((await db.query<{data:{count:number;liked:boolean}}>("select public.toggle_heart('post',$1) as data",[ids.post])).rows[0].data).toEqual({count:1,liked:true});await actor(ids.president);expect((await db.query<{data:{count:number;liked:boolean}}>("select public.heart_summary('post',$1) as data",[ids.post])).rows[0].data).toEqual({count:1,liked:false});await actor(ids.student);expect((await db.query<{data:{count:number}}>("select public.toggle_heart('post',$1) as data",[ids.post])).rows[0].data.count).toBe(0);await expect(db.query('select * from app_private.content_hearts')).rejects.toThrow(/permission denied/);});
 it('stores a reply under an approved parent and exposes its timestamp',async()=>{await db.query("update public.posts set status='APPROVED' where id=$1",[ids.post]);await service();const parent=(await db.query<{id:string}>("select public.store_moderated_comment($1,$2,'첫 댓글입니다.',null,'APPROVED','{}',true) as id",[ids.student,ids.post])).rows[0].id;const child=(await db.query<{id:string}>("select public.store_moderated_comment($1,$2,'답글입니다.',$3,'APPROVED','{}',true) as id",[ids.president,ids.post,parent])).rows[0].id;await actor(ids.president);const snapshot=(await db.query<{data:{posts:{id:string;comments:{id:string;parentId:string;date:string}[]}[]}}>('select public.community_snapshot() as data')).rows[0].data;expect(snapshot.posts.find(p=>p.id===ids.post)?.comments.find(c=>c.id===child)?.parentId).toBe(parent);});
});
describe('private council channel and contacts',()=>{
 it('restricts a council conversation to the owner and council members',async()=>{await actor(ids.student);const thread=(await db.query<{id:string}>('select public.open_council_thread() as id')).rows[0].id;await db.query("select public.send_council_message($1,'행사 신청을 문의합니다.')",[thread]);await actor(ids.officer);expect((await db.query<{data:unknown[]}>('select public.council_message_list($1) as data',[thread])).rows[0].data).toHaveLength(1);await actor(ids.president);await expect(db.query('select public.council_message_list($1)',[thread])).rejects.toThrow('PRIVATE_THREAD_REQUIRED');});
 it('hides a partner phone until both partners consent',async()=>{await match();await service();await db.query("select public.store_mentoring_contact($1,$2,'encrypted-partner-phone-value')",[ids.president,ids.student]);await actor(ids.student);let state=(await db.query<{data:Record<string,unknown>}>('select public.mentoring_contact_state() as data')).rows[0].data;expect(state.partnerShared).toBe(true);expect(state.partnerSealed).toBeNull();await service();await db.query("select public.store_mentoring_contact($1,$2,'encrypted-own-phone-value')",[ids.student,ids.president]);await actor(ids.student);state=(await db.query<{data:Record<string,unknown>}>('select public.mentoring_contact_state() as data')).rows[0].data;expect(state.partnerSealed).toBe('encrypted-partner-phone-value');await db.query('select public.revoke_mentoring_contact()');await actor(ids.president);expect((await db.query<{data:Record<string,unknown>}>('select public.mentoring_contact_state() as data')).rows[0].data.partnerSealed).toBeNull();});
 it('does not reveal matched contacts to a council member outside the pair',async()=>{await match();await actor(ids.officer);expect((await db.query<{data:Record<string,unknown>}>('select public.mentoring_contact_state() as data')).rows[0].data.partnerId).toBeNull();});
});
describe('public and private suggestion boards',()=>{
 it('exposes approved public questions but not private questions to another student',async()=>{const pub=await suggestion('PUBLIC','APPROVED',true);const priv=await suggestion();await actor(ids.president);expect((await db.query('select id from public.suggestions where id in ($1,$2)',[pub,priv])).rows).toEqual([{id:pub}]);});
 it('lets council officers answer but rejects a teacher as a council respondent',async()=>{const id=await suggestion();await service();await db.query("select public.store_moderated_suggestion_reply($1,$2,'확인했습니다. 학생회가 답변합니다.','APPROVED','{}',true)",[ids.officer,id]);await expect(db.query("select public.store_moderated_suggestion_reply($1,$2,'교사 답변입니다.','APPROVED','{}',true)",[ids.teacher,id])).rejects.toThrow('COUNCIL_REPLY_REQUIRED');});
});
describe('public class submission metadata',()=>{
 it('shows who submitted without exposing private answers',async()=>{await actor(ids.president);await db.query('select public.submit_class_task($1,$2,0,false)',[ids.task,JSON.stringify({name:'우리 반 부스',count:'12'})]);await actor(ids.student);const directory=(await db.query<{data:Record<string,unknown>[]}>('select public.class_submission_directory($1) as data',[ids.task])).rows[0].data;expect(directory[0].submittedBy).toBe('체험president');expect(JSON.stringify(directory)).not.toContain('answers');expect((await db.query('select * from public.class_task_submissions')).rows).toHaveLength(0);});
 it('requires personal contact for edits after the deadline even if late initial submissions are allowed',async()=>{await actor(ids.president);const answers=JSON.stringify({name:'우리 반 부스',count:'12'});await db.query('select public.submit_class_task($1,$2,0,false)',[ids.task,answers]);await db.exec('reset role');await db.query("update public.class_tasks set deadline=now()-interval '1 minute',allow_late=true where id=$1",[ids.task]);await actor(ids.president);await expect(db.query('select public.submit_class_task($1,$2,1,false)',[ids.task,answers])).rejects.toThrow('DEADLINE_PASSED_CONTACT_COUNCIL');});
});
