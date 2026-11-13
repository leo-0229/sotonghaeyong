'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createSeed } from '@/lib/seed';
import {viewDate} from '@/lib/post-views';
import { demoAllowed, supabase } from '@/lib/supabase/browser';
import { cloudMutation } from '@/lib/backend';
import { localModeration,publicationStatus } from '@/lib/moderation';
import {BOARD_PREFIXES} from '../../supabase/functions/_shared/boards';
import {authEmail,normalizeLoginId,parseStudentId,temporaryCredentials,validateCredentials} from '@/lib/accounts';
import { ROLE_INFO, canManageTask, canReadSuggestion, canReview, isTeacher, isCouncil, level, postSchema, submitForClass, suggestionSchema, type AppState, type Member, type Role, type SubmissionStatus } from '@/lib/domain';

const STORAGE_KEY = 'mpms-draft-v2';
type Update = (state: AppState, member: Member) => AppState;
interface DemoContextValue {
  reviewRevision:number;
  state: AppState; member: Member | undefined; ready: boolean; toast: string;
  mode: 'demo' | 'supabase' | 'unconfigured'; busy: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  issueAccount: (input:{studentId:string;name:string;gender:'MALE'|'FEMALE';role:Role;position?:string})=>Promise<{loginId:string;password:string;studentId:string;name:string}>;
  manageAccount:(userId:string,operation:'reissue'|'delete',confirmName:string)=>Promise<void>;
  changeCredentials:(loginId:string,currentPassword:string,newPassword:string)=>Promise<void>;
  notify: (text: string) => void; commit: (update: Update) => Promise<void>;
  switchMember: (id: string | null) => Promise<void>; reset: () => void;
  createPost: (input: { board: string; title: string; content: string; prefix?: string }, draft?: boolean, editId?: string) => Promise<string>;
  refreshData:()=>Promise<void>;
  recordPostView:(id:string)=>Promise<void>;
  editContent:(kind:'suggestion'|'suggestion-reply'|'comment',id:string,content:string,expectedUpdatedAt:string,details?:{title:string;category:string;visibility:'PUBLIC'|'PRIVATE'})=>Promise<void>;
  createComment:(postId:string,content:string,parentId?:string)=>Promise<void>;
  toggleHeart:(kind:'post'|'comment',id:string)=>Promise<void>;
  deleteContent:(kind:'post'|'comment',id:string,reason?:string)=>Promise<void>;
  reportComment:(id:string,reason:string)=>Promise<void>;
  reviewCommentReport:(id:string,status:'REVIEWED'|'DISMISSED')=>Promise<void>;
  replySuggestion:(id:string,content:string)=>Promise<void>;
  reviewSuggestionContent:(kind:'suggestion'|'suggestion-reply',id:string,approve:boolean)=>Promise<void>;
  reviewPost: (id: string, approve: boolean, reason?: string) => Promise<void>;
  saveSubmission: (taskId: string, answers: Record<string, string>, version: number, draft: boolean) => Promise<void>;
  applyEvent: (id: string) => Promise<void>;
  createSuggestion: (input: { title: string; category: string; content: string; visibility?:'PUBLIC'|'PRIVATE' }) => Promise<void>;
  register: (name: string, classId: string) => string;
}
const DemoContext = createContext<DemoContextValue | null>(null);
const uid = () => crypto.randomUUID();
const stamp = () => new Date().toISOString();
function addLog(state: AppState, member: Member, action: string) { return { ...state, logs: [{ id: uid(), by: member.name, action, date: stamp() }, ...state.logs] }; }

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(createSeed);
  const ref = useRef(state);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState('');
  const [mode,setMode]=useState<'demo'|'supabase'|'unconfigured'>('unconfigured');
  const [busy,setBusy]=useState(false);
  const [reviewRevision,setReviewRevision]=useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const notify = useCallback((message: string) => { setToast(message); clearTimeout(timer.current); timer.current = setTimeout(() => setToast(''), 4500); }, []);
  const persist = useCallback((next: AppState) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { throw new Error('브라우저 저장 공간을 사용할 수 없습니다. 저장 설정을 확인해 주세요.'); }
    ref.current = next; setState(next);
  }, []);
  const refresh=useCallback(async()=>{
    if(!supabase) return;
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){ const empty=emptyState(); ref.current=empty;setState(empty);return; }
    const [snapshot,identity]=await Promise.all([supabase.rpc('community_snapshot'),supabase.rpc('own_account')]);
    if(snapshot.error||identity.error) throw new Error('서버 데이터를 불러오지 못했습니다. 최신 SQL 마이그레이션 적용 여부를 확인해 주세요.');
    const data=snapshot.data as AppState;data.members=data.members.map(m=>m.id===user.id?{...m,...identity.data}:m);
    const own=data.members.find(m=>m.id===user.id);
    if(level(own)>=4){
      const {data:directory,error}=await supabase.rpc('account_directory');if(error)throw new Error('회원 계정 정보를 불러오지 못했습니다.');
      data.members=data.members.map(m=>({...m,...directory?.find((entry:{id:string})=>entry.id===m.id)}));
    }
    ref.current=data;setState(data);
  },[]);
  useEffect(() => {
    if(supabase){
      setMode('supabase');
      void refresh().catch(e=>notify(e.message)).finally(()=>setReady(true));
      const {data:{subscription}}=supabase.auth.onAuthStateChange(()=>{ setTimeout(()=>void refresh().catch(e=>notify(e.message)),0); });
      return ()=>subscription.unsubscribe();
    }
    if(!demoAllowed()){const empty=emptyState();ref.current=empty;setState(empty);setReady(true);return;}
    setMode('demo');
    const load = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) { const parsed = JSON.parse(raw) as AppState; if (Array.isArray(parsed.members) && Array.isArray(parsed.posts) && Array.isArray(parsed.tasks)) { ref.current = parsed; setState(parsed); } }
      } catch { notify('저장된 체험 데이터를 읽지 못해 기본 화면을 표시합니다.'); }
      setReady(true);
    };
    load();
    const handle = (e: StorageEvent) => { if (e.key === STORAGE_KEY) load(); };
    window.addEventListener('storage', handle);
    return () => { window.removeEventListener('storage', handle); clearTimeout(timer.current); };
  }, [notify,refresh]);
  const member = state.members.find(m => m.id === state.currentMemberId);
  const commit = useCallback(async (update: Update) => {
    if(supabase){
      const actor=ref.current.members.find(m=>m.id===ref.current.currentMemberId);
      if(!actor||!level(actor)) throw new Error('승인된 회원으로 로그인해 주세요.');
      setBusy(true);
      try {const before=ref.current;await cloudMutation(before,update(structuredClone(before),actor),actor);await refresh();} finally{setBusy(false);}
      return;
    }
    if(!demoAllowed()) throw new Error('운영 로그인 서버를 먼저 설정해 주세요.');
    // Re-read persisted state so another tab's newer submission version is respected.
    const raw = localStorage.getItem(STORAGE_KEY);
    const latest: AppState = raw ? JSON.parse(raw) : ref.current;
    const actor = latest.members.find(m => m.id === ref.current.currentMemberId);
    if (!actor || !level(actor)) throw new Error('승인된 체험 계정을 선택해 주세요.');
    persist(update({ ...latest, currentMemberId: actor.id }, actor));
  }, [persist,refresh]);
  const recordPostView=useCallback(async(id:string)=>{
    const viewer=ref.current.members.find(m=>m.id===ref.current.currentMemberId);
    if(!level(viewer))return;
    if(supabase){
      const {data,error}=await supabase.rpc('record_post_view',{p_post:id});
      if(error)throw new Error('조회수를 반영하지 못했습니다. 잠시 후 다시 확인해 주세요.');
      if(ref.current.currentMemberId!==viewer!.id)return;
      const next={...ref.current,posts:ref.current.posts.map(p=>p.id===id?{...p,views:Math.max(p.views,data as number)}:p)};
      ref.current=next;setState(next);return;
    }
    await commit((s,m)=>{
      const post=s.posts.find(p=>p.id===id);const date=viewDate();const key=m.id+':'+id;
      if(!post||post.status!=='APPROVED'||post.authorId===m.id||s.demoPostViews?.[key]===date)return s;
      return {...s,demoPostViews:{...s.demoPostViews,[key]:date},posts:s.posts.map(p=>p.id===id?{...p,views:p.views+1}:p)};
    });
  },[commit]);
  const signIn=async(email:string,password:string)=>{
    if(!supabase) throw new Error('운영 계정 서버가 설정되지 않았습니다.');
    const id=normalizeLoginId(email);const loginEmail=id.includes('@')?id:authEmail(id);
    setBusy(true);try{const {error}=await supabase.auth.signInWithPassword({email:loginEmail,password});if(error) throw new Error('아이디 또는 비밀번호를 확인해 주세요.');await refresh();}finally{setBusy(false);}
  };
  async function issueAccount(input:{studentId:string;name:string;gender:'MALE'|'FEMALE';role:Role;position?:string}){
    const issuer=ref.current.members.find(m=>m.id===ref.current.currentMemberId);
    if(level(issuer)<4)throw new Error('L4 이상만 계정을 발급할 수 있습니다.');
    if(input.role==='SUPERVISING_TEACHER'&&!isTeacher(issuer))throw new Error('L5 계정은 L5만 발급할 수 있습니다.');
    const parsed=input.role==='SUPERVISING_TEACHER'?{studentId:'',classId:''}:parseStudentId(input.studentId);if(input.name.trim().length<2||input.name.trim().length>30||(input.role!=='SUPERVISING_TEACHER'&&!['MALE','FEMALE'].includes(input.gender)))throw new Error('이름·성별·등급을 확인해 주세요.');
    if(supabase){setBusy(true);try{const {data,error}=await supabase.functions.invoke('account-access',{body:{operation:'issue',...input,studentId:parsed.studentId}});if(error)throw new Error('발급하지 못했습니다. 학번 중복 여부와 계정 서버를 확인해 주세요.');await refresh();return data;}finally{setBusy(false);}}
    if(!demoAllowed())throw new Error('계정 서버가 설정되지 않았습니다.');
    if(parsed.studentId&&ref.current.members.some(m=>m.studentId===parsed.studentId))throw new Error('이미 발급된 학번입니다.');
    const credentials=temporaryCredentials();const id=uid();
    persist({...ref.current,members:[...ref.current.members,{id,name:input.name.trim(),studentId:parsed.studentId,classId:parsed.classId,gender:input.gender,role:input.role,position:input.role==='CLASS_OFFICER'?input.position as Member['position']:undefined,status:'ACTIVE',loginId:credentials.loginId,mustChangeCredentials:true,credentialVersion:0}]});
    return {...credentials,studentId:parsed.studentId,name:input.name.trim()};
  }
  async function manageAccount(userId:string,operation:'reissue'|'delete',confirmName:string){
    const actor=ref.current.members.find(m=>m.id===ref.current.currentMemberId);
    if(level(actor)<4||(operation==='reissue'&&!isTeacher(actor))||actor?.id===userId)throw new Error('계정 처리 권한을 확인해 주세요.');
    const target=ref.current.members.find(m=>m.id===userId);
    if(!target||target.name!==confirmName)throw new Error('대상 이름을 정확히 확인하세요.');
    if(supabase){
      setBusy(true);try{
        const {error}=await supabase.functions.invoke('account-access',{body:{operation,userId,confirmName}});
        await refresh();
        if(error){let message='처리하지 못했습니다. 대상 이름과 계정 상태를 확인하세요.';try{const body=await error.context?.json();if(body?.error)message=body.error;}catch{}throw new Error(message);}
      }finally{setBusy(false);}
      return;
    }
    if(!demoAllowed())throw new Error('계정 서버를 확인하세요.');
    if(operation==='reissue'){
      if(target.status!=='ACTIVE')throw new Error('이용 중인 계정만 재발급할 수 있습니다.');
      const credentials=temporaryCredentials();
      persist({...ref.current,members:ref.current.members.map(m=>m.id===userId?{...m,loginId:credentials.loginId,mustChangeCredentials:true,credentialVersion:(m.credentialVersion??0)+1}:m)});
    }else{
      persist({...ref.current,members:ref.current.members.filter(m=>m.id!==userId),posts:ref.current.posts.map(p=>({...p,...(p.authorId===userId?{author:'탈퇴 회원',authorId:''}:{}),comments:p.comments.map(c=>c.authorId===userId?{...c,author:'탈퇴 회원',authorId:''}:c)}))});
    }
  }
  async function changeCredentials(loginId:string,currentPassword:string,newPassword:string){
    const own=ref.current.members.find(m=>m.id===ref.current.currentMemberId);if(!own?.loginId||own.status!=='ACTIVE')throw new Error('발급 계정으로 로그인해 주세요.');
    const id=validateCredentials(own.loginId,loginId,currentPassword,newPassword);
    if(supabase){setBusy(true);try{const {error}=await supabase.functions.invoke('account-access',{body:{operation:'change',loginId:id,currentPassword,newPassword}});if(error)throw new Error('변경하지 못했습니다. 현재 비밀번호와 새 아이디 중복 여부를 확인해 주세요.');const {error:loginError}=await supabase.auth.signInWithPassword({email:authEmail(id),password:newPassword});if(loginError){await supabase.auth.signOut();throw new Error('변경은 완료됐습니다. 새 아이디와 비밀번호로 다시 로그인해 주세요.');}await refresh();}finally{setBusy(false);}}
    else{if(!demoAllowed())throw new Error('운영 로그인 서버가 설정되지 않았습니다.');if(ref.current.members.some(m=>m.id!==own.id&&m.loginId===id))throw new Error('이미 사용 중인 아이디입니다.');persist({...ref.current,members:ref.current.members.map(m=>m.id===own.id?{...m,loginId:id,mustChangeCredentials:false,credentialVersion:(m.credentialVersion??0)+1}:m)});}
    notify('아이디와 비밀번호를 변경했습니다.');
  }
  const switchMember = async (id: string | null) => {
    if(supabase){if(id)throw new Error('운영 환경에서는 역할을 임의로 바꿀 수 없습니다.');const {error}=await supabase.auth.signOut();if(error)throw error;const empty=emptyState();ref.current=empty;setState(empty);return;}
    if(!demoAllowed())throw new Error('운영 로그인 서버가 설정되지 않았습니다.');
    persist({ ...ref.current, currentMemberId: id,posts:ref.current.posts.map(p=>({...p,hearts:{count:p.demoHeartUsers?.length??0,liked:!!id&&!!p.demoHeartUsers?.includes(id)},comments:p.comments.map(c=>({...c,hearts:{count:c.demoHeartUsers?.length??0,liked:!!id&&!!c.demoHeartUsers?.includes(id)}}))})) }); notify(id ? '체험 계정을 전환했습니다.' : '로그아웃했습니다.');
  };
  const reset = () => { persist(createSeed()); notify('체험 데이터를 처음 상태로 되돌렸습니다.'); };
  function inspectContent(title:string,content:string){return localModeration(title,content,ref.current.members.map(m=>m.name));}
  async function createPost(input: { board: string; title: string; content: string; prefix?: string }, draft = false, editId?: string) {
    const parsed = postSchema.parse(input);parsed.prefix=parsed.board==='music'?'':parsed.prefix||BOARD_PREFIXES[parsed.board]?.[0]||''; const id = editId ?? uid();
    if(supabase){
      setBusy(true);try{const {data,error}=await supabase.functions.invoke('moderate-post',{body:{...parsed,draft,editId}});if(error)throw new Error('게시글을 저장하지 못했습니다. 검토 서버 연결을 확인해 주세요.');await refresh();notify(draft?'임시 저장했습니다.':data.status==='APPROVED'?'규칙 검사를 통과해 공개되었습니다.':'공개되지 않았습니다. 운영진 승인 대기로 저장했습니다.');return data.id as string;}finally{setBusy(false);}
    }
    await commit((s, m) => {
      if (['notice', 'council', 'report'].includes(parsed.board) && level(m) < 4) throw new Error('공식 게시판은 LEVEL 4 이상만 작성할 수 있습니다.');
      const previous = s.posts.find(p => p.id === id);
      if (previous && (previous.authorId !== m.id || !['DRAFT', 'REJECTED', 'PENDING', 'APPROVED'].includes(previous.status))) throw new Error('본인 글만 수정할 수 있으며 숨김 처리된 글은 운영진에게 문의해 주세요.');
      const reasons=inspectContent([parsed.prefix,parsed.title].filter(Boolean).join(' '),parsed.content);
      const post = { ...previous, ...parsed, id, authorId: m.id, author: m.name, date: previous?.date??stamp(), updatedAt:stamp(), status: draft ? 'DRAFT' as const : publicationStatus(reasons), moderationReasons:reasons, comments: previous?.comments ?? [], views: previous?.views ?? 0, reason: undefined };
      return addLog({ ...s, posts: previous ? s.posts.map(p => p.id === id ? post : p) : [post, ...s.posts] }, m, `${draft ? '글 임시 저장' : '글 승인 요청'}: ${post.title}`);
    });
    notify(draft ? '글을 임시 저장했습니다.' : publicationStatus(localModeration([parsed.prefix,parsed.title].join(' '),parsed.content))==='APPROVED'?'규칙 검사를 통과해 공개되었습니다.':'공개되지 않았습니다. 운영진 승인 대기로 저장했습니다.'); return id;
  }
  async function reviewPost(id: string, approve: boolean, reason?: string) {
    await commit((s, m) => {
      if (!canReview(m)) throw new Error('게시글 승인 권한이 없습니다.');
      const post = s.posts.find(p => p.id === id);
      if (!post || post.authorId === m.id) throw new Error('자신이 작성한 글은 다른 운영진이 검토해야 합니다.');
      if (post.status !== 'PENDING' && !(post.status==='REJECTED'&&approve) && level(m) < 4) throw new Error('공개·숨김 글의 재검토는 LEVEL 4 이상만 가능합니다.');
      if (!approve && (!reason||reason.trim().length<2||reason.trim().length>1000)) throw new Error('반려 사유는 2~1000자로 입력해 주세요.');
      return addLog({ ...s, posts: s.posts.map(p => p.id === id ? { ...p, status: approve ? 'APPROVED' : 'REJECTED', reason: approve ? undefined : reason!.trim(), rejection:approve?undefined:{reviewer:m.name,date:stamp(),reason:reason!.trim()} } : p), notifications: [{ id: uid(), recipientId: post.authorId, title: `게시글이 ${approve ? '승인' : '반려'}되었습니다: ${post.title}`, href: `/posts/${id}`, read: false, date: stamp() }, ...s.notifications] }, m, `게시글 ${approve ? '승인' : '반려'}: ${post.title}`);
    }); setReviewRevision(n=>n+1); notify('게시글 검토 결과를 저장했습니다.');
  }
  async function saveSubmission(taskId: string, answers: Record<string, string>, version: number, draft: boolean) {
    if(supabase){
      const task=ref.current.tasks.find(t=>t.id===taskId);if(!task)throw new Error('업무를 찾을 수 없습니다.');
      const encoded=Object.fromEntries(Object.entries(answers).map(([k,v])=>[k,task.fields.find(f=>f.id===k)?.type==='multiselect'?v.split('|').filter(Boolean):v]));
      const {error}=await supabase.rpc('submit_class_task',{p_task:taskId,p_answers:encoded,p_expected_version:version,p_draft:draft});if(error)throw new Error(error.message);await refresh();notify(draft?'임시 저장했습니다.':'제출 내용을 저장했습니다. 마감 전까지 수정할 수 있습니다.');return;
    }
    await commit((s, m) => {
      const submission = submitForClass(s, m, taskId, answers, version, draft);
      const task = s.tasks.find(t => t.id === taskId)!;
      const recipients = s.members.filter(p => p.status === 'ACTIVE' && p.id !== m.id && ((p.classId === m.classId && p.role === 'CLASS_OFFICER') || canManageTask(p, task)));
      return addLog({ ...s, submissions: [...s.submissions.filter(v => !(v.taskId === taskId && v.classId === m.classId)), submission], notifications: draft ? s.notifications : [...recipients.map(p => ({ id: uid(), recipientId: p.id, title: `${m.classId} 학급 제출 완료: ${task.title}`, href: p.role === 'CLASS_OFFICER' ? `/class-tasks/${taskId}` : `/admin/class-tasks/${taskId}/submissions`, read: false, date: stamp() })), ...s.notifications] }, m, `${submission.classId} 학급 ${draft ? '임시 저장' : '제출'}: ${taskId}`);
    });
    notify(draft ? '학급 제출 내용을 임시 저장했습니다.' : '학급 대표 제출을 완료했습니다.');
  }
  async function applyEvent(id: string) {
    await commit((s, m) => {
      const event = s.events.find(e => e.id === id);
      if (!event || event.method !== 'individual') throw new Error('개인 신청 가능한 행사가 아닙니다.');
      if (new Date() > new Date(event.deadline)) throw new Error('신청 기간이 종료되었습니다.');
      const cancel = event.applications.includes(m.id);
      if (!cancel && event.applications.length >= event.capacity) throw new Error('모집 인원이 마감되었습니다.');
      return { ...s, events: s.events.map(e => e.id === id ? { ...e, applications: cancel ? e.applications.filter(x => x !== m.id) : [...e.applications, m.id] } : e) };
    }); notify('행사 신청 상태를 변경했습니다.');
  }
  async function createComment(postId:string,content:string,parentId?:string){
    if(content.trim().length<2||content.length>2000)throw new Error('댓글은 2~2000자로 입력하세요.');
    if(supabase){setBusy(true);try{const {data,error}=await supabase.functions.invoke('moderate-post',{body:{kind:'comment',postId,content,parentId}});if(error)throw new Error('댓글을 저장하지 못했습니다.');await refresh();notify(data.status==='APPROVED'?'댓글이 공개되었습니다.':'댓글 승인을 요청했습니다.');}finally{setBusy(false);}return;}
    await commit((s,m)=>{const post=s.posts.find(p=>p.id===postId);if(!post||post.status!=='APPROVED')throw new Error('공개된 글에 댓글을 작성하세요.');return {...s,posts:s.posts.map(p=>p.id===postId?{...p,comments:[...p.comments,{id:uid(),authorId:m.id,author:m.name,content:content.trim(),date:stamp(),status:publicationStatus(localModeration('',content)),parentId,moderationReasons:localModeration('',content)}]}:p)};});notify(publicationStatus(localModeration('',content))==='APPROVED'?'댓글이 공개되었습니다.':'댓글 승인을 요청했습니다.');
  }
  async function editContent(kind:'suggestion'|'suggestion-reply'|'comment',id:string,content:string,expectedUpdatedAt:string,details?:{title:string;category:string;visibility:'PUBLIC'|'PRIVATE'}){
    const text=content.trim();const min=kind==='comment'?2:kind==='suggestion-reply'?5:10;const max=kind==='comment'?2000:kind==='suggestion-reply'?3000:5000;
    if(text.length<min||text.length>max)throw new Error(`내용은 ${min}~${max}자로 입력하세요.`);
    if(kind==='suggestion')suggestionSchema.parse({...details,content:text});
    const parentPost=ref.current.posts.find(p=>p.comments.some(c=>c.id===id));
    const parentQuestion=ref.current.suggestions.find(s=>s.replies?.some(r=>r.id===id));
    if(supabase){setBusy(true);try{
      const {data,error}=await supabase.functions.invoke('moderate-post',{body:{kind,editId:id,expectedUpdatedAt,content:text,...details,postId:parentPost?.id,suggestionId:parentQuestion?.id}});
      if(error){let message='내용을 수정하지 못했습니다. 권한과 최신 상태를 확인하세요.';try{const body=await error.context?.json();if(body?.error)message=body.error;}catch{}throw new Error(message);}
      await refresh();notify(data.status==='APPROVED'?'수정 내용을 저장했습니다.':'수정 내용을 승인 대기로 저장했습니다.');
    }finally{setBusy(false);}return;}
    await commit((s,m)=>{
      const question=s.suggestions.find(q=>q.id===id);
      const answer=s.suggestions.flatMap(q=>q.replies??[]).find(r=>r.id===id);
      const comment=s.posts.flatMap(p=>p.comments).find(c=>c.id===id);
      const target=kind==='suggestion'?question:kind==='suggestion-reply'?answer:comment;
      if(!target||target.authorId!==m.id)throw new Error('본인이 작성한 내용만 수정할 수 있습니다.');
      if((target.updatedAt??target.date)!==expectedUpdatedAt)throw new Error('다른 곳에서 내용이 바뀌었습니다. 새로고침 후 다시 수정하세요.');
      if(kind==='suggestion-reply'&&!isCouncil(m))throw new Error('학생회 임원만 본인 답변을 수정할 수 있습니다.');
      if(kind==='comment'&&!s.posts.some(p=>p.status==='APPROVED'&&p.comments.some(c=>c.id===id)))throw new Error('공개된 글의 댓글만 수정할 수 있습니다.');
      if(kind==='suggestion'&&question?.visibility==='PRIVATE'&&details?.visibility==='PUBLIC'&&(question.replies?.length||question.reply))throw new Error('답변이 달린 비공개 건의는 공개로 바꿀 수 없습니다. 새 공개 질문을 작성해 주세요.');
      const reasons=inspectContent(details?.title??'',text);const status=publicationStatus(reasons);const updatedAt=stamp();
      if(kind==='comment')return {...s,posts:s.posts.map(p=>({...p,comments:p.comments.map(c=>c.id===id?{...c,content:text,status,moderationReasons:reasons,updatedAt}:c)}))};
      return {...s,suggestions:s.suggestions.map(q=>{
        if(kind==='suggestion'&&q.id===id)return {...q,...details,content:text,publicationStatus:status,moderationReasons:reasons,updatedAt};
        if(kind!=='suggestion-reply'||!q.replies?.some(r=>r.id===id))return q;
        const replies=q.replies.map(r=>r.id===id?{...r,content:text,status,updatedAt}:r);
        return {...q,replies,reply:undefined,status:status==='APPROVED'?'처리 완료' as const:q.status==='처리 완료'&&!replies.some(r=>r.status==='APPROVED')?'검토 중' as const:q.status};
      })};
    });notify('수정 내용을 저장하고 다시 검사했습니다.');
  }
  async function toggleHeart(kind:'post'|'comment',id:string){
    if(supabase){const {error}=await supabase.rpc('toggle_heart',{p_kind:kind,p_id:id});if(error)throw new Error('하트를 변경하지 못했습니다. 공개된 글·댓글인지 확인하세요.');await refresh();return;}
    await commit((s,m)=>({...s,posts:s.posts.map(p=>{
      if(kind==='post'&&p.id===id){const voters=p.demoHeartUsers??[];const changed=voters.includes(m.id)?voters.filter(u=>u!==m.id):[...voters,m.id];return {...p,demoHeartUsers:changed,hearts:{count:changed.length,liked:changed.includes(m.id)}};}
      return {...p,comments:p.comments.map(c=>{if(kind!=='comment'||c.id!==id)return c;const voters=c.demoHeartUsers??[];const changed=voters.includes(m.id)?voters.filter(u=>u!==m.id):[...voters,m.id];return {...c,demoHeartUsers:changed,hearts:{count:changed.length,liked:changed.includes(m.id)}};})};
    })}));
  }
  async function deleteContent(kind:'post'|'comment',id:string,reason=''){
    if(supabase){const {error}=await supabase.rpc('delete_community_content',{p_kind:kind,p_id:id,p_reason:reason.trim()});if(error)throw new Error('삭제 권한과 사유를 확인해 주세요. 이미 삭제된 내용일 수도 있습니다.');await refresh();notify(kind==='post'?'게시글을 삭제했습니다.':'댓글을 삭제했습니다.');return;}
    await commit((s,m)=>{
      const target=kind==='post'?s.posts.find(p=>p.id===id):s.posts.flatMap(p=>p.comments).find(c=>c.id===id);
      if(!target)throw new Error('이미 삭제되었거나 찾을 수 없는 내용입니다.');
      const forced=target.authorId!==m.id;
      if(forced&&level(m)<4)throw new Error('다른 회원의 글·댓글 강제 삭제는 L4 이상만 가능합니다.');
      if(reason.length>500||(forced&&reason.trim().length<5))throw new Error('강제 삭제 사유는 5~500자로 입력하세요.');
      const posts=kind==='post'?s.posts.filter(p=>p.id!==id):s.posts.map(p=>({...p,comments:p.comments.filter(c=>c.id!==id).map(c=>c.parentId===id?{...c,parentId:null}:c)}));
      return addLog({...s,posts,commentReports:(s.commentReports??[]).filter(r=>kind==='post'?r.postId!==id:r.commentId!==id),reports:kind==='post'?s.reports.filter(r=>r.postId!==id):s.reports,notifications:kind==='post'?s.notifications.filter(n=>n.href!=='/posts/'+id):s.notifications},m,(kind==='post'?'게시글':'댓글')+(forced?' 강제 삭제':' 본인 삭제')+' · 대상 '+id);
    });notify(kind==='post'?'게시글을 삭제했습니다.':'댓글을 삭제했습니다.');
  }
  async function reportComment(id:string,reason:string){
    const trimmed=reason.trim();if(trimmed.length<5||trimmed.length>1000)throw new Error('신고 사유는 5~1000자로 입력하세요.');
    if(supabase){const {error}=await supabase.rpc('report_comment',{p_comment:id,p_reason:trimmed});if(error)throw new Error('공개된 다른 회원의 댓글만 신고할 수 있습니다. 잠시 후 다시 시도하세요.');notify('댓글 신고를 접수했습니다.');return;}
    await commit((s,m)=>{const post=s.posts.find(p=>p.comments.some(c=>c.id===id));const comment=post?.comments.find(c=>c.id===id);if(!post||post.status!=='APPROVED'||comment?.status!=='APPROVED'||comment.authorId===m.id)throw new Error('공개된 다른 회원의 댓글만 신고할 수 있습니다.');const reports=s.commentReports??[];if(reports.some(r=>r.commentId===id&&r.reporterId===m.id))return s;if(reports.filter(r=>r.reporterId===m.id&&+new Date(r.date)>Date.now()-600000).length>=10)throw new Error('신고가 많습니다. 잠시 후 다시 시도하세요.');return {...s,commentReports:[{id:uid(),commentId:id,postId:post.id,reporterId:m.id,reason:trimmed,date:stamp(),status:'OPEN'},...reports]};});notify('댓글 신고를 접수했습니다.');
  }
  async function reviewCommentReport(id:string,status:'REVIEWED'|'DISMISSED'){
    if(supabase){const {error}=await supabase.rpc('review_comment_report',{p_report:id,p_status:status});if(error)throw new Error('신고 처리 권한과 현재 상태를 확인하세요.');await refresh();return;}
    await commit((s,m)=>{if(level(m)<3)throw new Error('신고 처리 권한이 없습니다.');return {...s,commentReports:(s.commentReports??[]).map(r=>r.id===id?{...r,status}:r)};});notify('댓글 신고 처리 상태를 저장했습니다.');
  }
  async function createSuggestion(input:{title:string;category:string;content:string;visibility?:'PUBLIC'|'PRIVATE'}){
    const parsed=suggestionSchema.parse(input);
    if(supabase){setBusy(true);try{const {data,error}=await supabase.functions.invoke('moderate-post',{body:{kind:'suggestion',...parsed}});if(error)throw new Error('건의를 저장하지 못했습니다.');await refresh();notify(data.status==='APPROVED'?'건의를 접수했습니다.':'건의를 접수했습니다. 공개 글은 검토 후 표시됩니다.');}finally{setBusy(false);}return;}
    await commit((s,m)=>({...s,suggestions:[{...parsed,id:uid(),authorId:m.id,status:'접수 완료',publicationStatus:publicationStatus(localModeration(parsed.title,parsed.content)),moderationReasons:localModeration(parsed.title,parsed.content),date:stamp()},...s.suggestions]}));notify('건의를 접수했습니다.');
  }
  async function replySuggestion(id:string,content:string){
    if(!isCouncil(ref.current.members.find(m=>m.id===ref.current.currentMemberId)))throw new Error('학생회 임원만 답변할 수 있습니다.');
    if(content.trim().length<5)throw new Error('답변은 5자 이상 입력하세요.');
    if(supabase){setBusy(true);try{const {data,error}=await supabase.functions.invoke('moderate-post',{body:{kind:'suggestion-reply',suggestionId:id,content}});if(error)throw new Error('답변을 저장하지 못했습니다.');await refresh();notify(data.status==='APPROVED'?'답변이 공개되었습니다.':'답변 승인을 요청했습니다.');}finally{setBusy(false);}return;}
    await commit((s,m)=>({...s,suggestions:s.suggestions.map(item=>item.id===id?{...item,replies:[...(item.replies??[]),{id:uid(),authorId:m.id,author:m.name,content:content.trim(),date:stamp(),status:publicationStatus(localModeration('',content))}]}:item)}));notify(publicationStatus(localModeration('',content))==='APPROVED'?'답변이 공개되었습니다.':'답변 승인을 요청했습니다.');
  }
  async function reviewSuggestionContent(kind:'suggestion'|'suggestion-reply',id:string,approve:boolean){
    if(supabase){const {error}=await supabase.rpc('review_suggestion_content',{p_kind:kind,p_id:id,p_decision:approve?'APPROVED':'REJECTED'});if(error)throw new Error('다른 운영진이 검토해야 합니다.');await refresh();return;}
    await commit((s,m)=>{if(level(m)<3)throw new Error('검토 권한이 없습니다.');return {...s,suggestions:s.suggestions.map(item=>{
      if(kind==='suggestion'&&item.id===id){if(item.authorId===m.id)throw new Error('다른 운영진이 검토해야 합니다.');return {...item,publicationStatus:approve?'APPROVED':'REJECTED'};}
      return {...item,replies:item.replies?.map(reply=>{if(kind!=='suggestion-reply'||reply.id!==id)return reply;if(reply.authorId===m.id)throw new Error('다른 운영진이 검토해야 합니다.');return {...reply,status:approve?'APPROVED':'REJECTED'};}),...(kind==='suggestion-reply'&&approve&&item.replies?.some(r=>r.id===id)?{status:'처리 완료' as const}:{})};
    })};});
  }
  function register(name: string, classId: string) {
    if(!demoAllowed())throw new Error('회원 계정은 담당 교사가 별도로 발급합니다.');
    if (name.trim().length < 2 || !/^[1-3]-[1-6]$/.test(classId)) throw new Error('체험 이름과 학급을 확인해 주세요.');
    const id = uid(); persist({ ...ref.current, members: [...ref.current.members, { id, name: name.trim(), classId, role: 'STUDENT' as Role, status: 'PENDING' }], currentMemberId: id });
    notify('체험 가입 신청을 저장했습니다. 담당 교사 계정에서 승인할 수 있어요.'); return id;
  }
  return <DemoContext.Provider value={{ reviewRevision,state, member, ready, toast, mode,busy,signIn,issueAccount,manageAccount,changeCredentials,notify, commit, switchMember, reset, createPost,recordPostView,createComment,editContent,toggleHeart,deleteContent,reportComment,reviewCommentReport,replySuggestion,reviewSuggestionContent,refreshData:refresh, reviewPost, saveSubmission, applyEvent, createSuggestion, register }}>{children}</DemoContext.Provider>;
}
export function useDemo() { const ctx = useContext(DemoContext); if (!ctx) throw new Error('DemoProvider가 필요합니다.'); return ctx; }
export async function runAction(action: () => unknown | Promise<unknown>, notify: (text: string) => void) { try { await action(); } catch (e) { notify(e instanceof Error ? e.message : '처리하지 못했습니다. 다시 시도해 주세요.'); } }
function emptyState():AppState{return {members:[],currentMemberId:null,posts:[],tasks:[],submissions:[],events:[],suggestions:[],pledges:[],surveys:[],mentoring:[],notifications:[],logs:[],reports:[]};}
