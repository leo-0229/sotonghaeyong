import type { AppState, Member } from './domain';
import { supabase } from './supabase/browser';

const changed = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b);
export function inferMutation(before: AppState, after: AppState, actor: Member): { operation: string; payload: Record<string, unknown> } {
  const member = after.members.find(m => { const old=before.members.find(o=>o.id===m.id); return old && changed(old,m); });
  if (member) {
    const old=before.members.find(m=>m.id===member.id)!;
    if (member.status==='WITHDRAWN') return { operation:'withdraw',payload:{} };
    if (old.role!==member.role || old.position!==member.position) return { operation:'member_role',payload:{ userId:member.id,role:member.role,classId:member.classId,position:member.position } };
    return {operation:'member_status',payload:{userId:member.id,status:member.status}};
  }
  const task=after.tasks.find(t=>!before.tasks.some(o=>o.id===t.id));
  if(task) return {operation:'create_task',payload:{task}};
  const editedTask=after.tasks.find(t=>before.tasks.some(o=>o.id===t.id && o.closed!==t.closed));
  if(editedTask) return {operation:'close_task',payload:{id:editedTask.id,closed:editedTask.closed}};
  const pledge=after.pledges.find(p=>changed(p,before.pledges.find(o=>o.id===p.id)));
  if(pledge) return {operation:'save_pledge',payload:{pledge}};
  const suggestion=after.suggestions.find(p=>changed(p,before.suggestions.find(o=>o.id===p.id)));
  if(suggestion) return {operation:'save_suggestion',payload:{suggestion}};
  const event=after.events.find(p=>changed(p.applications,before.events.find(o=>o.id===p.id)?.applications));
  if(event) return {operation:'apply_event',payload:{id:event.id,apply:event.applications.includes(actor.id)}};
  const survey=after.surveys.find(p=>changed(p.responses,before.surveys.find(o=>o.id===p.id)?.responses));
  if(survey) return {operation:'answer_survey',payload:{id:survey.id,answer:survey.responses[actor.id]}};
  const application=after.mentoring.find(p=>!before.mentoring.some(o=>o.id===p.id));
  if(application) return {operation:'apply_mentoring',payload:{application}};
  const matches=after.mentoring.filter(p=>changed(p,before.mentoring.find(o=>o.id===p.id)));
  if(matches.length===2) return {operation:'match_mentoring',payload:{ids:matches.map(m=>m.id)}};
  const post=after.posts.find(p=>changed(p,before.posts.find(o=>o.id===p.id)));
  if(post) {
    const old=before.posts.find(p=>p.id===post.id);
    const comment=post.comments.find(c=>changed(c,old?.comments.find(o=>o.id===c.id)));
    if(comment) return {operation:'comment',payload:{postId:post.id,comment}};
    return {operation:'review_post',payload:{id:post.id,decision:post.status,reason:post.reason}};
  }
  const report=after.reports.find(p=>!before.reports.some(o=>o.id===p.id));
  if(report) return {operation:'report_post',payload:{report}};
  if(changed(before.notifications,after.notifications)) return {operation:'read_notifications',payload:{ids:after.notifications.filter(n=>n.read && n.recipientId===actor.id).map(n=>n.id)}};
  throw new Error('저장할 변경 내용을 확인하지 못했습니다.');
}
export async function cloudMutation(before: AppState, after: AppState, actor: Member) {
  if(!supabase) throw new Error('로그인 서버가 설정되지 않았습니다.');
  const {operation,payload}=inferMutation(before,after,actor);
  const {error}=await supabase.rpc('community_mutate',{p_operation:operation,p_payload:payload});
  if(error) throw new Error(`저장하지 못했습니다: ${error.message}`);
}
