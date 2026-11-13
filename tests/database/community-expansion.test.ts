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
async function editChecked(kind:string,id:string,user:string,version:string,status='PENDING',verified=false,visibility='PRIVATE'){
 await service();return db.query("select public.edit_moderated_content($1,$2,$3,'새롭게 수정한 충분한 길이의 내용입니다.',$4,'{}',$5,$6,'수정한 건의 제목','학교 행사',$7)",[kind,user,id,status,verified,version,visibility]);
}
async function versionOf(table:'suggestions'|'comments'|'suggestion_replies',id:string){await db.exec('reset role');return (await db.query<{stamp:string}>(`select coalesce(updated_at,created_at)::text as stamp from public.${table} where id=$1`,[id])).rows[0].stamp;}
async function editableComment(){await db.query("update public.posts set status='APPROVED' where id=$1",[ids.post]);await service();return (await db.query<{id:string}>("select public.store_moderated_comment($1,$2,'수정 전 댓글입니다.',null,'APPROVED','{}',true) as id",[ids.student,ids.post])).rows[0].id;}
async function editableAnswer(question:string){await service();return (await db.query<{id:string}>("select public.store_moderated_suggestion_reply($1,$2,'수정 전 학생회 답변입니다.','APPROVED','{}',true) as id",[ids.officer,question])).rows[0].id;}

describe('author edits and privacy after rechecking',()=>{
 it('keeps question creation time, applies all fields and hides flagged public edits',async()=>{
  const id=await suggestion('PUBLIC','APPROVED',true);const before=await versionOf('suggestions',id);
  await editChecked('suggestion',id,ids.student,before,'PENDING',false,'PUBLIC');await actor(ids.president);
  expect((await db.query('select id from public.suggestions where id=$1',[id])).rows).toHaveLength(0);
  await actor(ids.student);expect((await db.query('select title,category,publication_status from public.suggestions where id=$1',[id])).rows[0]).toEqual({title:'수정한 건의 제목',category:'학교 행사',publication_status:'PENDING'});
  const snap=(await db.query<{data:{suggestions:{id:string;date:string;updatedAt:string}[]}}>('select public.community_snapshot() as data')).rows[0].data.suggestions.find(q=>q.id===id)!;expect(snap.updatedAt).toBeTruthy();
  await db.exec('reset role');expect((await db.query<{same:boolean}>('select created_at=$2::timestamptz as same from public.suggestions where id=$1',[id,before])).rows[0].same).toBe(true);
 });
 it('rejects another member even when they are L5',async()=>{const id=await suggestion();await expect(editChecked('suggestion',id,ids.teacher,await versionOf('suggestions',id))).rejects.toThrow('OWN_CONTENT_REQUIRED');});
 it('does not let an authenticated client call the trusted edit function',async()=>{const id=await suggestion();const version=await versionOf('suggestions',id);await actor(ids.student);await expect(db.query("select public.edit_moderated_content('suggestion',$1,$2,'수정한 내용입니다.','APPROVED','{}',true,$3,'수정 제목','기타','PUBLIC')",[ids.student,id,version])).rejects.toThrow(/permission denied/);});
 it('rejects unverified automatic approval on an edit',async()=>{const id=await suggestion();await expect(editChecked('suggestion',id,ids.student,await versionOf('suggestions',id),'APPROVED')).rejects.toThrow('RULE_OR_HUMAN_APPROVAL_REQUIRED');});
 it('rejects a stale version without overwriting newer content',async()=>{const id=await suggestion();const version=await versionOf('suggestions',id);await editChecked('suggestion',id,ids.student,version);await expect(editChecked('suggestion',id,ids.student,version)).rejects.toThrow('EDIT_CONFLICT');});
 it('allows an unanswered private question to become public after verification',async()=>{const id=await suggestion();await editChecked('suggestion',id,ids.student,await versionOf('suggestions',id),'APPROVED',true,'PUBLIC');await actor(ids.president);expect((await db.query('select id from public.suggestions where id=$1',[id])).rows).toHaveLength(1);});
 it('protects private replies when a question author tries to make them public',async()=>{const id=await suggestion();await editableAnswer(id);await expect(editChecked('suggestion',id,ids.student,await versionOf('suggestions',id),'APPROVED',true,'PUBLIC')).rejects.toThrow('PRIVATE_REPLIES_PROTECTED');});
 it('allows public questions to become private and keeps them from other students',async()=>{const id=await suggestion('PUBLIC','APPROVED',true);await editableAnswer(id);await editChecked('suggestion',id,ids.student,await versionOf('suggestions',id),'APPROVED',true,'PRIVATE');await actor(ids.president);expect((await db.query('select id from public.suggestions where id=$1',[id])).rows).toHaveLength(0);expect((await db.query('select id from public.suggestion_replies where suggestion_id=$1',[id])).rows).toHaveLength(0);});
 it('rechecks comments without moving the comment or losing replies and hearts',async()=>{const id=await editableComment();const version=await versionOf('comments',id);await actor(ids.president);await db.query("select public.toggle_heart('comment',$1)",[id]);await service();const child=(await db.query<{id:string}>("select public.store_moderated_comment($1,$2,'남겨야 하는 다른 회원의 답글',$3,'APPROVED','{}',true) as id",[ids.president,ids.post,id])).rows[0].id;await editChecked('comment',id,ids.student,version);await actor(ids.president);expect((await db.query('select id from public.comments where id=$1',[id])).rows).toHaveLength(0);await db.exec('reset role');expect((await db.query('select parent_id from public.comments where id=$1',[child])).rows[0]).toEqual({parent_id:id});expect((await db.query('select * from app_private.content_hearts where comment_id=$1',[id])).rows).toHaveLength(1);});
 it('blocks hidden comment edits',async()=>{const id=await editableComment();await db.exec('reset role');await db.query("update public.comments set status='HIDDEN' where id=$1",[id]);await expect(editChecked('comment',id,ids.student,await versionOf('comments',id))).rejects.toThrow('CONTENT_NOT_EDITABLE');});
 it('lets council authors recheck their answer and prevents self approval',async()=>{const id=await suggestion('PUBLIC','APPROVED',true);const answer=await editableAnswer(id);await editChecked('suggestion-reply',answer,ids.officer,await versionOf('suggestion_replies',answer));await actor(ids.student);expect((await db.query('select id from public.suggestion_replies where id=$1',[answer])).rows).toHaveLength(0);await actor(ids.officer);await expect(db.query("select public.review_suggestion_content('suggestion-reply',$1,'APPROVED')",[answer])).rejects.toThrow('OTHER_REVIEWER_REQUIRED');});
 it('blocks demoted council members from modifying old official answers',async()=>{const id=await suggestion();const answer=await editableAnswer(id);await db.exec('reset role');await db.query("update public.user_roles set role_code='STUDENT' where user_id=$1",[ids.officer]);await expect(editChecked('suggestion-reply',answer,ids.officer,await versionOf('suggestion_replies',answer))).rejects.toThrow('COUNCIL_REPLY_REQUIRED');});
});
async function match(){
 await actor(ids.president);await mutate('apply_mentoring',{application:{id:mentor,kind:'멘토',goal:'학교생활을 도와줄 수 있습니다.'}});
 await actor(ids.student);await mutate('apply_mentoring',{application:{id:mentee,kind:'멘티',goal:'학교생활에 도움을 받고 싶습니다.'}});
 await actor(ids.officer);await mutate('match_mentoring',{ids:[mentor,mentee]});
}

describe('authenticated daily post views',()=>{
 async function publicPost(){await db.query("update public.posts set status='APPROVED',views=0 where id=$1",[ids.post]);}
 const view=()=>db.query<{views:number}>('select public.record_post_view($1) as views',[ids.post]);
 it('counts another member once and leaves content timestamps unchanged',async()=>{
  await publicPost();const before=(await db.query('select created_at,updated_at from public.posts where id=$1',[ids.post])).rows[0];await actor(ids.president);expect((await view()).rows[0].views).toBe(1);expect((await view()).rows[0].views).toBe(1);
  await db.exec('reset role');expect((await db.query('select created_at,updated_at from public.posts where id=$1',[ids.post])).rows[0]).toEqual(before);expect((await db.query('select * from app_private.post_view_receipts where post_id=$1',[ids.post])).rows).toHaveLength(1);
 });
 it('does not count the author',async()=>{await publicPost();await actor(ids.student);expect((await view()).rows[0].views).toBe(0);await db.exec('reset role');expect((await db.query('select * from app_private.post_view_receipts')).rows).toHaveLength(0);});
 it('counts different members independently',async()=>{await publicPost();await actor(ids.president);await view();await actor(ids.vice);expect((await view()).rows[0].views).toBe(2);});
 it('counts a return on a later Korean calendar day',async()=>{await publicPost();await actor(ids.president);await view();await db.exec('reset role');await db.query("update app_private.post_view_receipts set last_counted_on=(current_timestamp at time zone 'Asia/Seoul')::date-1 where post_id=$1",[ids.post]);await actor(ids.president);expect((await view()).rows[0].views).toBe(2);expect((await view()).rows[0].views).toBe(2);});
 it.each(['DRAFT','PENDING','REJECTED','HIDDEN'])('does not count %s posts even for moderators',async(status)=>{await db.query('update public.posts set status=$2 where id=$1',[ids.post,status]);await actor(ids.teacher);await expect(view()).rejects.toThrow('PUBLIC_POST_REQUIRED');});
 it('requires an active initialized account',async()=>{await publicPost();await actor(ids.pending);await expect(view()).rejects.toThrow('ACTIVE_LOGIN_REQUIRED');});
 it('blocks suspended members',async()=>{await publicPost();await db.query("update public.profiles set status='SUSPENDED' where id=$1",[ids.president]);await actor(ids.president);await expect(view()).rejects.toThrow('ACTIVE_LOGIN_REQUIRED');});
 it('blocks unfinished credential setup',async()=>{await publicPost();await db.query('update public.profiles set credentials_pending=true where id=$1',[ids.president]);await actor(ids.president);await expect(view()).rejects.toThrow('ACTIVE_LOGIN_REQUIRED');});
 it('does not expose reader identities to a teacher or member',async()=>{await publicPost();await actor(ids.president);await view();await actor(ids.teacher);await expect(db.query('select * from app_private.post_view_receipts')).rejects.toThrow(/permission denied/);});
 it('does not allow direct client counter updates',async()=>{await publicPost();await actor(ids.president);await expect(db.query('update public.posts set views=999 where id=$1',[ids.post])).rejects.toThrow(/permission denied/);});
 it('does not grant anonymous execution',async()=>{await publicPost();await db.exec('set local role anon');await expect(view()).rejects.toThrow(/permission denied/);});
 it('cleans the receipt when its post is deleted',async()=>{await publicPost();await actor(ids.president);await view();await actor(ids.student);await db.query("select public.delete_community_content('post',$1,'')",[ids.post]);await db.exec('reset role');expect((await db.query('select * from app_private.post_view_receipts where post_id=$1',[ids.post])).rows).toHaveLength(0);});
});
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

describe('author and L4/L5 content deletion',()=>{
 it('lets authors delete posts and purges comments, revisions and hearts',async()=>{
  const id=await savePost(ids.student,'APPROVED',null,'이야기해용',true);
  await savePost(ids.student,'APPROVED',id,'이야기해용',true);
  await service();await db.query("select public.store_moderated_comment($1,$2,'다른 회원의 댓글입니다.',null,'APPROVED','{}',true)",[ids.president,id]);
  await actor(ids.president);await db.query("select public.toggle_heart('post',$1)",[id]);
  await actor(ids.student);await db.query("select public.delete_community_content('post',$1)",[id]);
  await db.exec('reset role');
  for(const table of ['posts','comments','post_revisions'])expect((await db.query('select 1 from public.'+table+' where '+(table==='posts'?'id':'post_id')+'=$1',[id])).rows).toHaveLength(0);
  expect((await db.query('select 1 from app_private.content_hearts where post_id=$1',[id])).rows).toHaveLength(0);
  const audit=(await db.query<{action:string;details:unknown}>('select action,details from public.audit_logs where resource_id=$1 order by created_at desc',[id])).rows.find(r=>r.action==='post.author_deleted');
  expect(audit).toBeDefined();expect(JSON.stringify(audit)).not.toContain('충분히 긴 수정 게시글 본문');
 });
 it('denies ordinary members deleting another author post',async()=>{await actor(ids.president);await expect(db.query("select public.delete_community_content('post',$1)",[ids.post])).rejects.toThrow('CONTENT_DELETE_PERMISSION_DENIED');});
 it('denies L3 force deletion even when a reason is supplied',async()=>{await actor(ids.officer);await expect(db.query("select public.delete_community_content('post',$1,'검토 후 강제 삭제 요청')",[ids.post])).rejects.toThrow('CONTENT_DELETE_PERMISSION_DENIED');});
 it('requires a reason from L4 force deletion',async()=>{await actor(ids.executive);await expect(db.query("select public.delete_community_content('post',$1)",[ids.post])).rejects.toThrow('DELETE_REASON_REQUIRED');});
 it.each([ids.executive,ids.teacher])('allows L4/L5 force post deletion and audits the actor',async user=>{await actor(user);await db.query("select public.delete_community_content('post',$1,'유해 게시글 운영 기준 위반')",[ids.post]);await db.exec('reset role');expect((await db.query('select 1 from public.posts where id=$1',[ids.post])).rows).toHaveLength(0);expect((await db.query('select actor_id,action from public.audit_logs where resource_id=$1',[ids.post])).rows).toContainEqual({actor_id:user,action:'post.force_deleted'});});
 it('keeps another author reply when the parent author deletes their comment',async()=>{
  await db.query("update public.posts set status='APPROVED' where id=$1",[ids.post]);await service();
  const parent=(await db.query<{id:string}>("select public.store_moderated_comment($1,$2,'삭제할 부모 댓글입니다.',null,'APPROVED','{}',true) as id",[ids.student,ids.post])).rows[0].id;
  const child=(await db.query<{id:string}>("select public.store_moderated_comment($1,$2,'유지할 다른 회원의 답글입니다.',$3,'APPROVED','{}',true) as id",[ids.president,ids.post,parent])).rows[0].id;
  await actor(ids.student);await db.query("select public.delete_community_content('comment',$1)",[parent]);await db.exec('reset role');
  expect((await db.query('select 1 from public.comments where id=$1',[parent])).rows).toHaveLength(0);
  expect((await db.query('select parent_id,content from public.comments where id=$1',[child])).rows).toEqual([{parent_id:null,content:'유지할 다른 회원의 답글입니다.'}]);
 });
 it('allows force comment deletion with a reason',async()=>{await db.query("update public.posts set status='APPROVED' where id=$1",[ids.post]);await service();const id=(await db.query<{id:string}>("select public.store_moderated_comment($1,$2,'삭제 대상 댓글입니다.',null,'APPROVED','{}',true) as id",[ids.student,ids.post])).rows[0].id;await actor(ids.executive);await db.query("select public.delete_community_content('comment',$1,'댓글 운영 기준 위반 확인')",[id]);await db.exec('reset role');expect((await db.query('select 1 from public.comments where id=$1',[id])).rows).toHaveLength(0);});
 it('rejects anonymous deletion RPC access',async()=>{await db.exec('set local role anon');await expect(db.query("select public.delete_community_content('post',$1)",[ids.post])).rejects.toThrow(/permission denied/);});
 it('prevents a suspended author from using deletion RPC',async()=>{await db.query("update public.profiles set status='SUSPENDED' where id=$1",[ids.student]);await actor(ids.student);await expect(db.query("select public.delete_community_content('post',$1)",[ids.post])).rejects.toThrow('ACTIVE_LOGIN_REQUIRED');});
});

describe('comment reporting permissions and moderation',()=>{
 async function reportable(status='APPROVED'){
  await db.query("update public.posts set status='APPROVED' where id=$1",[ids.post]);await service();
  return (await db.query<{id:string}>("select public.store_moderated_comment($1,$2,'신고 대상 가상 댓글입니다.',null,$3,'{}',$4) as id",[ids.student,ids.post,status,status==='APPROVED'])).rows[0].id;
 }
 it('accepts one report per member/comment and keeps it private from the author',async()=>{
  const comment=await reportable();await actor(ids.president);const first=(await db.query<{id:string}>("select public.report_comment($1,'욕설과 비방 내용이 포함됨') as id",[comment])).rows[0].id;
  expect((await db.query<{id:string}>("select public.report_comment($1,'중복 신고 사유입니다.') as id",[comment])).rows[0].id).toBe(first);
  expect((await db.query('select id from public.comment_reports')).rows).toHaveLength(1);await actor(ids.student);expect((await db.query('select id from public.comment_reports')).rows).toHaveLength(0);
 });
 it('denies self reporting',async()=>{const comment=await reportable();await actor(ids.student);await expect(db.query("select public.report_comment($1,'본인 댓글 신고 요청입니다.')",[comment])).rejects.toThrow('OWN_COMMENT_REPORT_DENIED');});
 it('denies reporting pending comments by guessed ID',async()=>{const comment=await reportable('PENDING');await actor(ids.president);await expect(db.query("select public.report_comment($1,'비공개 댓글을 추측한 신고')",[comment])).rejects.toThrow('PUBLIC_COMMENT_REQUIRED');});
 it('denies the moderation queue to regular members',async()=>{await actor(ids.president);await expect(db.query('select public.comment_report_queue()')).rejects.toThrow('REVIEWER_REQUIRED');});
 it('allows council review and records a notification without exposing report content publicly',async()=>{
  const comment=await reportable();await actor(ids.president);const id=(await db.query<{id:string}>("select public.report_comment($1,'운영 기준 위반 댓글입니다.') as id",[comment])).rows[0].id;
  await actor(ids.officer);expect((await db.query<{data:{id:string}[]}>('select public.comment_report_queue() as data')).rows[0].data.some(r=>r.id===id)).toBe(true);await db.query("select public.review_comment_report($1,'REVIEWED')",[id]);expect((await db.query<{data:unknown[]}>('select public.comment_report_queue() as data')).rows[0].data).toHaveLength(0);
  await db.exec('reset role');expect((await db.query('select status,reviewed_by from public.comment_reports where id=$1',[id])).rows).toEqual([{status:'REVIEWED',reviewed_by:ids.officer}]);
 });
 it('cleans up reports when a moderator deletes the comment',async()=>{const comment=await reportable();await actor(ids.president);await db.query("select public.report_comment($1,'삭제가 필요한 댓글입니다.')",[comment]);await actor(ids.executive);await db.query("select public.delete_community_content('comment',$1,'운영 기준 위반 댓글 삭제')",[comment]);await db.exec('reset role');expect((await db.query('select id from public.comment_reports where comment_id=$1',[comment])).rows).toHaveLength(0);});
 it('does not grant direct report insertion to authenticated clients',async()=>{await actor(ids.president);await expect(db.query("insert into public.comment_reports(comment_id,post_id,reporter_id,reason) values($1,$2,$3,'검사를 우회하는 직접 삽입')",[ids.post,ids.post,ids.president])).rejects.toThrow(/permission denied/);});
 it('requires a meaningful report reason',async()=>{const comment=await reportable();await actor(ids.president);await expect(db.query("select public.report_comment($1,'짧음')",[comment])).rejects.toThrow('INVALID_REPORT_REASON');});
});

describe('music board and runtime member-name directory',()=>{
 it('provides the ordinary music board without inserting demo posts',async()=>{await actor(ids.student);expect((await db.query("select title,official from public.boards where slug='music'")).rows).toEqual([{title:'노래 추천',official:false}]);});
 it('clears stale music prefixes at the storage boundary',async()=>{await service();const id=(await db.query<{id:string}>("select public.store_moderated_post($1,'music','노래 추천 검사','잔잔한 연주곡을 추천하는 게시글입니다.','APPROVED','{}',null,'오노추',true) as id",[ids.student])).rows[0].id;await db.exec('reset role');expect((await db.query('select prefix from public.posts where id=$1',[id])).rows).toEqual([{prefix:''}]);});
 it('does not expose the full moderation name list to authenticated clients',async()=>{await actor(ids.student);await expect(db.query('select public.moderation_member_names()')).rejects.toThrow(/permission denied/);});
 it('allows the trusted service to inspect current member display names',async()=>{await service();expect((await db.query<{names:string[]}>('select public.moderation_member_names() as names')).rows[0].names).toContain('체험student');});
});
