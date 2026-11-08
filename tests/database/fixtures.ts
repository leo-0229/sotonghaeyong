import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
export const ids = {
  student: '00000000-0000-4000-8000-000000000001', president: '00000000-0000-4000-8000-000000000002',
  vice: '00000000-0000-4000-8000-000000000003', officer: '00000000-0000-4000-8000-000000000004',
  executive: '00000000-0000-4000-8000-000000000005', teacher: '00000000-0000-4000-8000-000000000006',
  otherRep: '00000000-0000-4000-8000-000000000007', pending: '00000000-0000-4000-8000-000000000008',
  class1: '10000000-0000-4000-8000-000000000001', class2: '10000000-0000-4000-8000-000000000002',
  task: '20000000-0000-4000-8000-000000000001', suggestion: '30000000-0000-4000-8000-000000000001',
  post: '40000000-0000-4000-8000-000000000001', request: '50000000-0000-4000-8000-000000000001',
};

export async function createPolicyDatabase(){
  const db = new PGlite();
  await db.exec(`create role service_role; create role anon; create role authenticated; create schema auth; grant usage on schema auth to authenticated; grant usage on schema public to authenticated;
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
 await db.exec(await readFile('supabase/migrations/202611080002_pages_and_policy.sql','utf8'));
 await db.exec("update public.profiles set gender='FEMALE';");
 await db.query("update public.profiles set gender='MALE' where id=$1",[ids.officer]);
 return db;
}
