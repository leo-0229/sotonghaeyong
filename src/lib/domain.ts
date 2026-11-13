import { z } from 'zod';
export {BOARD_PREFIXES} from '../../supabase/functions/_shared/boards';
z.config(z.locales.ko());

export type Role = 'STUDENT' | 'CLASS_OFFICER' | 'COUNCIL_OFFICER' | 'COUNCIL_EXECUTIVE' | 'PR_DIRECTOR' | 'SUPERVISING_TEACHER';
export const ROLE_INFO: Record<Role, { level: number; label: string }> = {
  STUDENT: { level: 1, label: '일반 학생' }, CLASS_OFFICER: { level: 2, label: '학급 대표' },
  COUNCIL_OFFICER: { level: 3, label: '학생회 임원' }, COUNCIL_EXECUTIVE: { level: 4, label: '학생회 회장단' },
  PR_DIRECTOR: { level: 4, label: '정보통신부 부장' }, SUPERVISING_TEACHER: { level: 5, label: '담당 교사' },
};
export type MemberStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED' | 'WITHDRAWN';
export interface Member { id: string; name: string; role: Role; classId: string; gender?: 'MALE' | 'FEMALE'; studentId?: string; loginId?: string; mustChangeCredentials?: boolean; credentialVersion?: number; position?: 'CLASS_PRESIDENT' | 'CLASS_VICE_PRESIDENT'; status: MemberStatus }
export const classLabel = (id: string) => { const [grade, room] = id.split('-'); return `${grade}학년 ${room}반`; };
export const level = (member: Member | undefined) => member?.status === 'ACTIVE' && !member.mustChangeCredentials ? ROLE_INFO[member.role].level : 0;
export const isCouncil = (member:Member|undefined) => level(member)>=3&&level(member)<=4;
export const canReview = (member: Member | undefined) => level(member) >= 3;
export const canManage = (member: Member | undefined) => level(member) >= 4;
export const isTeacher = (member: Member | undefined) => level(member) === 5;
export type PostStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'HIDDEN';
export interface HeartSummary {count:number;liked:boolean}
export interface CommentReport {id:string;commentId:string;postId:string;reporterId:string;reason:string;date:string;status:'OPEN'|'REVIEWED'|'DISMISSED'}
export interface PostComment {updatedAt?:string;id:string;authorId:string;author:string;content:string;date:string;status:'PENDING'|'APPROVED';parentId?:string|null;hearts?:HeartSummary;demoHeartUsers?:string[];moderationReasons?:string[]}
export interface Post { rejection?:{reviewer:string;date:string;reason:string}; id: string; board: string; title: string; content: string; prefix?: string; updatedAt?: string; authorId: string; author: string; date: string; views: number; status: PostStatus; pinned?: boolean; reason?: string; moderationReasons?: string[]; hearts?: HeartSummary; demoHeartUsers?:string[]; comments: PostComment[] }
export const BOARDS = [{ id: 'all', label: '전체 게시글' }, { id: 'notice', label: '전체 공지' }, { id: 'council', label: '학생회 공지' }, { id: 'free', label: '자유게시판' }, { id: 'question', label: '질문게시판' }, { id: 'info', label: '정보공유' }, { id: 'report', label: '학생회 활동 보고' }, {id:'lost',label:'분실물 게시판'},{id:'music',label:'노래 추천'}];
export const boardLabel = (id: string) => BOARDS.find(b => b.id === id)?.label ?? id;
export type SubmissionStatus = 'DRAFT' | 'SUBMITTED' | 'REVISION_REQUESTED' | 'RESUBMITTED' | 'ACCEPTED' | 'CLOSED';
export const STATUS_LABELS: Record<string, string> = { NOT_SUBMITTED: '미제출', DRAFT: '임시 저장', SUBMITTED: '제출 완료', REVISION_REQUESTED: '보완 요청', RESUBMITTED: '재제출', ACCEPTED: '접수 확정', CLOSED: '업무 종료', PENDING: '승인 대기', APPROVED: '승인 완료', REJECTED: '반려', HIDDEN: '숨김', ACTIVE: '활성', SUSPENDED: '이용 정지', WITHDRAWN: '탈퇴' };
export interface FormField { id: string; label: string; type: 'text' | 'textarea' | 'number' | 'select' | 'multiselect' | 'date'; required: boolean; options?: string[] }
export interface ClassTask { id: string; title: string; description: string; department: string; type: '행사 참가' | '의견 제출' | '자료 제출' | '대표 설문' | '일반 업무'; start: string; deadline: string; targets: string[]; allowLate: boolean; closed: boolean; managerIds: string[]; fields: FormField[]; submittedCount?:number }
export interface Submission { taskId: string; classId: string; status: SubmissionStatus; answers: Record<string, string>; version: number; submittedBy: string; updatedBy: string; updatedAt: string; feedback?: string; history: { by: string; at: string; action: string; answers: Record<string, string> }[] }
export interface SchoolEvent { id: string; title: string; description: string; category: string; date: string; deadline: string; place: string; method: 'individual' | 'class' | 'none'; capacity: number; taskId?: string; color: string; applications: string[] }
export interface SuggestionReply {updatedAt?:string;id:string;authorId:string;author:string;content:string;date:string;status:'PENDING'|'APPROVED'|'REJECTED'}
export interface Suggestion {updatedAt?:string; id: string; authorId: string; title: string; category: string; content: string; status: '접수 완료' | '검토 중' | '담당자 전달' | '처리 완료' | '반려'; assignedTo?: string; date: string; reply?: string; visibility?:'PUBLIC'|'PRIVATE';publicationStatus?:'PENDING'|'APPROVED'|'REJECTED';moderationReasons?:string[];replies?:SuggestionReply[] }
export interface Pledge { id: string; title: string; department: string; progress: number; description: string; details?: string; status?: '추진 예정' | '추진 중' | '완료' | '보류'; updated: string }
export interface MentoringApplication { id: string; memberId: string; kind: '멘토' | '멘티'; time?: string; goal: string; status: string; partnerId?: string }
export interface Survey { id: string; title: string; description: string; deadline: string; options: string[]; responses: Record<string, string> }
export interface Notice { id: string; recipientId: string; title: string; href: string; read: boolean; date: string }
export interface AppState { demoPostViews?: Record<string,string>; members: Member[]; currentMemberId: string | null; posts: Post[]; tasks: ClassTask[]; submissions: Submission[]; events: SchoolEvent[]; suggestions: Suggestion[]; pledges: Pledge[]; surveys: Survey[]; mentoring: MentoringApplication[]; notifications: Notice[]; logs: { id: string; by: string; action: string; date: string }[]; reports: { id: string; postId: string; by: string; reason: string }[];commentReports?:CommentReport[] }
export const pledgeSchema = z.object({ title: z.string().trim().min(2).max(100), department: z.string().trim().min(1).max(50), description: z.string().trim().min(2).max(1000), details: z.string().trim().max(10000), progress: z.number().int().min(0).max(100), status: z.enum(['추진 예정','추진 중','완료','보류']) });
export function canMatchMentoring(a: MentoringApplication, b: MentoringApplication, members: Member[]) {
  const mentor = members.find(m => m.id === a.memberId); const mentee = members.find(m => m.id === b.memberId);
  return a.kind === '멘토' && b.kind === '멘티' && a.memberId !== b.memberId && a.status === '매칭 대기' && b.status === '매칭 대기' && !!mentor?.gender && mentor.gender === mentee?.gender && level(mentor)>0 && level(mentee)>0;
}

export const postSchema = z.object({ board: z.string().min(1), prefix: z.string().trim().max(20, '말머리는 20자 이내로 입력해 주세요.').default(''), title: z.string().trim().min(2, '제목을 2자 이상 입력해 주세요.').max(100, '제목은 100자 이내로 입력해 주세요.'), content: z.string().trim().min(10, '내용을 10자 이상 입력해 주세요.').max(10000) });
export const suggestionSchema = z.object({ title: z.string().trim().min(2).max(100), category: z.string().min(1), content: z.string().trim().min(10, '건의 내용을 10자 이상 입력해 주세요.').max(5000), visibility:z.enum(['PUBLIC','PRIVATE']).default('PRIVATE') });
export function validateAnswers(task: ClassTask, answers: Record<string, string>) {
  for (const field of task.fields) {
    const value = answers[field.id]?.trim() ?? '';
    if (field.required && !value) throw new Error(`${field.label} 항목을 입력해 주세요.`);
    if (value.length > 5000) throw new Error(`${field.label} 항목은 5,000자까지 입력할 수 있습니다.`);
    if (value && field.type === 'number' && (!Number.isFinite(Number(value)) || Number(value) < 0 || !Number.isInteger(Number(value)))) throw new Error(`${field.label} 항목에 0 이상의 정수를 입력해 주세요.`);
    if (value && field.type === 'select' && !field.options?.includes(value)) throw new Error('올바른 선택 항목이 아닙니다.');
    if (value && field.type === 'multiselect' && value.split('|').some(v => !field.options?.includes(v))) throw new Error('올바른 복수 선택 항목이 아닙니다.');
    if (value && field.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('날짜 형식을 확인해 주세요.');
  }
}
export function submitForClass(state: AppState, member: Member, taskId: string, answers: Record<string, string>, expectedVersion: number, draft: boolean, now = new Date().toISOString()): Submission {
  if (member.status !== 'ACTIVE' || member.role !== 'CLASS_OFFICER' || !member.position) throw new Error('승인된 학급 대표만 제출할 수 있습니다.');
  const task = state.tasks.find(t => t.id === taskId);
  if (!task || !task.targets.includes(member.classId)) throw new Error('본인 학급에 요청된 업무만 제출할 수 있습니다.');
  if (task.closed || +new Date(now) < +new Date(task.start) || (!task.allowLate && +new Date(now) > +new Date(task.deadline))) throw new Error('현재 제출 가능한 기간이 아닙니다.');
  const previous = state.submissions.find(s => s.taskId === taskId && s.classId === member.classId);
  if(previous&&+new Date(now)>+new Date(task.deadline))throw new Error('마감 후 수정은 학생회에 개인적으로 연락해 주세요.');
  if ((previous?.version ?? 0) !== expectedVersion) throw new Error('다른 대표가 내용을 수정했습니다. 새로고침 후 다시 확인해 주세요.');
  const status: SubmissionStatus = draft && (!previous || previous.status === 'DRAFT') ? 'DRAFT' : 'SUBMITTED';
  if (status === 'SUBMITTED') validateAnswers(task, answers);
  return { taskId, classId: member.classId, answers, version: expectedVersion + 1, status, submittedBy: previous?.submittedBy ?? member.id, updatedBy: member.id, updatedAt: now, feedback: previous?.feedback, history: [...(previous?.history ?? []), { by: member.id, at: now, action: STATUS_LABELS[status], answers }] };
}
export function taskStats(task: ClassTask, submissions: Submission[]) {
  const rows = submissions.filter(s => s.taskId === task.id && task.targets.includes(s.classId));
  const complete = task.submittedCount??rows.filter(s => ['SUBMITTED', 'RESUBMITTED', 'ACCEPTED', 'CLOSED'].includes(s.status)).length;
  const revision = rows.filter(s => s.status === 'REVISION_REQUESTED').length;
  return { total: task.targets.length, complete, revision, missing: task.targets.length - complete - revision, rate: task.targets.length ? Math.round(complete / task.targets.length * 100) : 0 };
}
export function canReadSuggestion(member: Member | undefined, item: Suggestion) { return !!level(member) && (member?.id===item.authorId||(item.visibility==='PUBLIC'&&item.publicationStatus==='APPROVED')||isCouncil(member)||isTeacher(member)); }
export function canManageTask(member: Member | undefined, task: ClassTask) { return canManage(member) || (canReview(member) && !!member && task.managerIds.includes(member.id)); }
