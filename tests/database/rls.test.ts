import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
const ids = {
  student: '00000000-0000-4000-8000-000000000001', president: '00000000-0000-4000-8000-000000000002',
  vice: '00000000-0000-4000-8000-000000000003', officer: '00000000-0000-4000-8000-000000000004',
  executive: '00000000-0000-4000-8000-000000000005', teacher: '00000000-0000-4000-8000-000000000006',
  otherRep: '00000000-0000-4000-8000-000000000007', pending: '00000000-0000-4000-8000-000000000008',
  class1: '10000000-0000-4000-8000-000000000001', class2: '10000000-0000-4000-8000-000000000002',
  task: '20000000-0000-4000-8000-000000000001', suggestion: '30000000-0000-4000-8000-000000000001',
  post: '40000000-0000-4000-8000-000000000001', request: '50000000-0000-4000-8000-000000000001',
};
let db: PGlite;
async function actor(id: string) {
  await db.exec('set local role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
}
const submit = (version = 0, answers: Record<string, unknown> = { name: '부스 이름', count: '12' }, draft: boolean | null = false) => db.query<{ class_id: string; version: number; submitted_by: string; updated_by: string; status: string }>('select * from public.submit_class_task($1,$2::jsonb,$3,$4)', [ids.task, JSON.stringify(answers), version, draft]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth; grant usage on schema auth to authenticated; grant usage on schema public to authenticated;
    create table auth.users(id uuid primary key,raw_user_meta_data jsonb not null default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
  await db.exec(await readFile('supabase/migrations/202611080001_initial.sql', 'utf8'));
  await db.query('insert into public.school_classes(id,school_year,grade,room) values ($1,2026,2,3),($2,2026,1,1)', [ids.class1, ids.class2]);
  const users = [['student', 'STUDENT'], ['president', 'CLASS_OFFICER'], ['vice', 'CLASS_OFFICER'], ['officer', 'COUNCIL_OFFICER'], ['executive', 'COUNCIL_EXECUTIVE'], ['teacher', 'SUPERVISING_TEACHER'], ['otherRep', 'CLASS_OFFICER'], ['pending', 'STUDENT']] as const;
  for (const [key, role] of users) {
    await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2::jsonb)', [ids[key], JSON.stringify({ display_name: `체험${key}` })]);
    await db.query('update public.profiles set status=$2,class_id=$3 where id=$1', [ids[key], key === 'pending' ? 'PENDING' : 'ACTIVE', key === 'otherRep' ? ids.class2 : ids.class1]);
    await db.query('update public.user_roles set role_code=$2 where user_id=$1', [ids[key], role]);
  }
  await db.query("insert into public.class_officer_assignments(user_id,class_id,position) values($1,$4,'CLASS_PRESIDENT'),($2,$4,'CLASS_VICE_PRESIDENT'),($3,$5,'CLASS_PRESIDENT')", [ids.president, ids.vice, ids.otherRep, ids.class1, ids.class2]);
  await db.query("insert into public.class_tasks(id,title,description,department,task_type,starts_at,deadline,created_by) values($1,'축제 부스 신청','신청 안내','문화부','DOCUMENT',now()-interval '1 day',now()+interval '1 day',$2)", [ids.task, ids.executive]);
  await db.query('insert into public.class_task_targets(task_id,class_id) values($1,$2)', [ids.task, ids.class1]);
  await db.query('insert into public.class_task_managers(task_id,user_id) values($1,$2)', [ids.task, ids.officer]);
  await db.query("insert into public.class_task_form_fields(task_id,field_key,label,field_type,required) values($1,'name','부스 이름','text',true),($1,'count','참가 인원','number',true)", [ids.task]);
  await db.query("insert into public.suggestions(id,author_id,title,category,content) values($1,$2,'도서관 개선','학교 시설','도서관에 독서대를 추가하면 좋겠어요.')", [ids.suggestion, ids.student]);
  await db.query('insert into public.suggestion_assignments(suggestion_id,user_id,assigned_by) values($1,$2,$3)', [ids.suggestion, ids.officer, ids.teacher]);
  await db.query("insert into public.posts(id,board_id,author_id,title,content) select $1,id,$2,'독서 모임 안내','친구들과 함께 독서 모임을 만들어 보고 싶어요.' from public.boards where slug='free'", [ids.post, ids.student]);
  await db.query('insert into public.membership_requests(id,user_id,class_id,student_number) values($1,$2,$3,8)', [ids.request, ids.pending, ids.class1]);
});
beforeEach(async () => { await db.exec('begin'); });
afterEach(async () => { await db.exec('rollback'); });
afterAll(async () => { await db?.close(); });

describe('PostgreSQL migration and RLS', () => {
  it('enables RLS on every public table', async () => { const result = await db.query("select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity"); expect(result.rows).toHaveLength(0); });
  it('blocks direct role escalation', async () => { await actor(ids.student); await expect(db.query("update public.user_roles set role_code='SUPERVISING_TEACHER' where user_id=$1", [ids.student])).rejects.toThrow(/permission denied/); });
  it('blocks a student from the class submission RPC', async () => { await actor(ids.student); await expect(submit()).rejects.toThrow('CLASS_OFFICER_REQUIRED'); });
  it('rejects a representative of a different class', async () => { await actor(ids.otherRep); await expect(submit()).rejects.toThrow('NOT_TARGET_CLASS'); });
  it('derives the class, shares the row and retains both actors', async () => { await actor(ids.president); const first = (await submit()).rows[0]; expect(first.class_id).toBe(ids.class1); await actor(ids.vice); const second = (await submit(1, { name: '수정 부스', count: '15' })).rows[0]; expect(second.version).toBe(2); expect(second.submitted_by).toBe(ids.president); expect(second.updated_by).toBe(ids.vice); expect((await db.query('select * from public.class_task_submissions')).rows).toHaveLength(1); expect((await db.query('select * from public.class_task_submission_revisions')).rows).toHaveLength(2); });
  it('rejects stale versions rather than creating a duplicate', async () => { await actor(ids.president); await submit(); await actor(ids.vice); await expect(submit()).rejects.toThrow('VERSION_CONFLICT'); });
  it('performs required-field validation in PostgreSQL', async () => { await actor(ids.president); await expect(submit(0, {})).rejects.toThrow('REQUIRED_FIELD'); });
  it('rejects injected fields and a null draft flag', async () => { await actor(ids.president); await expect(submit(0, { name: '이름', count: '12', class_id: ids.class2 })).rejects.toThrow('UNKNOWN_FIELD'); });
  it('cannot bypass validation using null as the draft flag', async () => { await actor(ids.president); await expect(submit(0, {}, null)).rejects.toThrow('INVALID_DRAFT_FLAG'); });
  it('retains revision intent across a draft save', async () => { await actor(ids.president); const item = (await submit()).rows[0] as unknown as { id: string }; await actor(ids.officer); await db.query("select public.review_class_submission($1,1,'REVISION_REQUESTED','내용 보완 요청')", [item.id]); await actor(ids.vice); await submit(2, {}, true); expect((await submit(3)).rows[0].status).toBe('RESUBMITTED'); });
  it('stores a draft without exposing it to assigned managers', async () => { await actor(ids.president); await submit(0, {}, true); await actor(ids.officer); expect((await db.query('select * from public.class_task_submissions')).rows).toHaveLength(0); });
  it('limits review to assigned managers', async () => { await db.query('delete from public.class_task_managers'); await actor(ids.president); const s = await submit(); await actor(ids.officer); await expect(db.query("select public.review_class_submission($1,1,'ACCEPTED',null)", [(s.rows[0] as unknown as {id:string}).id])).rejects.toThrow('NOT_ASSIGNED_MANAGER'); });
  it('supports revision, resubmission, acceptance and locks the final submission', async () => { await actor(ids.president); const s = (await submit()).rows[0] as unknown as { id: string }; await actor(ids.officer); await db.query("select public.review_class_submission($1,1,'REVISION_REQUESTED','운영 계획을 보완해 주세요.')", [s.id]); await actor(ids.vice); const resubmitted = (await submit(2)).rows[0]; expect(resubmitted.status).toBe('RESUBMITTED'); await actor(ids.officer); await db.query("select public.review_class_submission($1,3,'ACCEPTED',null)", [s.id]); await actor(ids.president); await expect(submit(4)).rejects.toThrow('SUBMISSION_LOCKED'); });
  it('hides private suggestions from unassigned executives', async () => { await actor(ids.executive); expect((await db.query('select * from public.suggestions')).rows).toHaveLength(0); });
  it('shows private suggestions only to their author, assignee or teacher', async () => { for (const id of [ids.student, ids.officer, ids.teacher]) { await actor(id); expect((await db.query('select * from public.suggestions')).rows).toHaveLength(1); } });
  it('rejects an officer calling teacher-only membership approval', async () => { await actor(ids.officer); await expect(db.query('select public.approve_membership($1,true)', [ids.request])).rejects.toThrow('TEACHER_REQUIRED'); });
  it('requires explicit school verification and leaves students pending by default', async () => { await actor(ids.pending); const result = await db.query<{ status: string }>('select status from public.profiles where id=$1', [ids.pending]); expect(result.rows[0].status).toBe('PENDING'); await actor(ids.teacher); await expect(db.query('select public.approve_membership($1,false)', [ids.request])).rejects.toThrow('SCHOOL_VERIFICATION_REQUIRED'); });
  it('lets the teacher approve into level 1 and writes an audit trail', async () => { await actor(ids.teacher); await db.query('select public.approve_membership($1,true)', [ids.request]); expect((await db.query<{ role_code: string }>('select role_code from public.user_roles where user_id=$1', [ids.pending])).rows[0].role_code).toBe('STUDENT'); expect((await db.query("select * from public.audit_logs where action='member.approve'")).rows).toHaveLength(1); });
  it('does not allow teachers to grant level 5 from the app RPC', async () => { await actor(ids.teacher); await expect(db.query("select public.set_member_role($1,'SUPERVISING_TEACHER',null,null)", [ids.student])).rejects.toThrow('INVALID_ROLE'); });
  it('does not expose pending posts to other students and publishes after review', async () => { await actor(ids.president); expect((await db.query('select * from public.posts')).rows).toHaveLength(0); await actor(ids.officer); await db.query("select public.review_post($1,'APPROVED',null)", [ids.post]); await actor(ids.president); expect((await db.query('select * from public.posts')).rows).toHaveLength(1); });
  it('prevents an operator from approving their own post', async () => { await db.query('update public.posts set author_id=$1 where id=$2', [ids.officer, ids.post]); await actor(ids.officer); await expect(db.query("select public.review_post($1,'APPROVED',null)", [ids.post])).rejects.toThrow('OTHER_REVIEWER_REQUIRED'); });
  it('rejects a direct post insert with APPROVED status', async () => { await actor(ids.student); await expect(db.query("insert into public.posts(board_id,author_id,title,content,status) select id,$1,'우회 글쓰기','승인 과정을 우회해서 공개하려는 게시글입니다.','APPROVED' from public.boards where slug='free'", [ids.student])).rejects.toThrow(/row-level security/); });
});
