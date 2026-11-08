'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createSeed } from '@/lib/seed';
import { demoAllowed, supabase } from '@/lib/supabase/browser';
import { cloudMutation } from '@/lib/backend';
import { localModeration } from '@/lib/moderation';
import {authEmail,normalizeLoginId,parseStudentId,temporaryCredentials,validateCredentials} from '@/lib/accounts';
import { ROLE_INFO, canManageTask, canReadSuggestion, canReview, isTeacher, level, postSchema, submitForClass, suggestionSchema, type AppState, type Member, type Role, type SubmissionStatus } from '@/lib/domain';

const STORAGE_KEY = 'mpms-draft-v2';
type Update = (state: AppState, member: Member) => AppState;
interface DemoContextValue {
  state: AppState; member: Member | undefined; ready: boolean; toast: string;
  mode: 'demo' | 'supabase' | 'unconfigured'; busy: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  issueAccount: (input:{studentId:string;name:string;gender:'MALE'|'FEMALE';role:Role;position?:string})=>Promise<{loginId:string;password:string;studentId:string;name:string}>;
  changeCredentials:(loginId:string,currentPassword:string,newPassword:string)=>Promise<void>;
  notify: (text: string) => void; commit: (update: Update) => Promise<void>;
  switchMember: (id: string | null) => Promise<void>; reset: () => void;
  createPost: (input: { board: string; title: string; content: string }, draft?: boolean, editId?: string) => Promise<string>;
  reviewPost: (id: string, approve: boolean, reason?: string) => Promise<void>;
  saveSubmission: (taskId: string, answers: Record<string, string>, version: number, draft: boolean) => Promise<void>;
  applyEvent: (id: string) => Promise<void>;
  createSuggestion: (input: { title: string; category: string; content: string }) => Promise<void>;
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
    if(own?.role==='SUPERVISING_TEACHER'&&!own.mustChangeCredentials&&own.status==='ACTIVE'){
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
  const signIn=async(email:string,password:string)=>{
    if(!supabase) throw new Error('운영 계정 서버가 설정되지 않았습니다.');
    const id=normalizeLoginId(email);const loginEmail=id.includes('@')?id:authEmail(id);
    setBusy(true);try{const {error}=await supabase.auth.signInWithPassword({email:loginEmail,password});if(error) throw new Error('아이디 또는 비밀번호를 확인해 주세요.');await refresh();}finally{setBusy(false);}
  };
  async function issueAccount(input:{studentId:string;name:string;gender:'MALE'|'FEMALE';role:Role;position?:string}){
    if(!isTeacher(ref.current.members.find(m=>m.id===ref.current.currentMemberId)))throw new Error('담당 교사만 계정을 발급할 수 있습니다.');
    const parsed=input.role==='SUPERVISING_TEACHER'?{studentId:'',classId:''}:parseStudentId(input.studentId);if(input.name.trim().length<2||input.name.trim().length>30||(input.role!=='SUPERVISING_TEACHER'&&!['MALE','FEMALE'].includes(input.gender)))throw new Error('이름·성별·등급을 확인해 주세요.');
    if(supabase){setBusy(true);try{const {data,error}=await supabase.functions.invoke('account-access',{body:{operation:'issue',...input,studentId:parsed.studentId}});if(error)throw new Error('발급하지 못했습니다. 학번 중복 여부와 계정 서버를 확인해 주세요.');await refresh();return data;}finally{setBusy(false);}}
    if(!demoAllowed())throw new Error('계정 서버가 설정되지 않았습니다.');
    if(parsed.studentId&&ref.current.members.some(m=>m.studentId===parsed.studentId))throw new Error('이미 발급된 학번입니다.');
    const credentials=temporaryCredentials();const id=uid();
    persist({...ref.current,members:[...ref.current.members,{id,name:input.name.trim(),studentId:parsed.studentId,classId:parsed.classId,gender:input.gender,role:input.role,position:input.role==='CLASS_OFFICER'?input.position as Member['position']:undefined,status:'ACTIVE',loginId:credentials.loginId,mustChangeCredentials:true,credentialVersion:0}]});
    return {...credentials,studentId:parsed.studentId,name:input.name.trim()};
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
    persist({ ...ref.current, currentMemberId: id }); notify(id ? '체험 계정을 전환했습니다.' : '로그아웃했습니다.');
  };
  const reset = () => { persist(createSeed()); notify('체험 데이터를 처음 상태로 되돌렸습니다.'); };
  async function createPost(input: { board: string; title: string; content: string }, draft = false, editId?: string) {
    const parsed = postSchema.parse(input); const id = editId ?? uid();
    if(supabase){
      setBusy(true);try{const {data,error}=await supabase.functions.invoke('moderate-post',{body:{...parsed,draft,editId}});if(error)throw new Error('게시글을 저장하지 못했습니다. 검토 서버 연결을 확인해 주세요.');await refresh();notify(draft?'임시 저장했습니다.':'승인 대기로 저장했습니다. 운영진 승인 후 공개됩니다.');return data.id as string;}finally{setBusy(false);}
    }
    await commit((s, m) => {
      if (['notice', 'council', 'report'].includes(parsed.board) && level(m) < 4) throw new Error('공식 게시판은 LEVEL 4 이상만 작성할 수 있습니다.');
      const previous = s.posts.find(p => p.id === id);
      if (previous && (previous.authorId !== m.id || !['DRAFT', 'REJECTED'].includes(previous.status))) throw new Error('본인의 임시 저장·반려 글만 수정할 수 있습니다.');
      const reasons=localModeration(parsed.title,parsed.content);
      const post = { ...previous, ...parsed, id, authorId: m.id, author: m.name, date: stamp(), status: draft ? 'DRAFT' as const : 'PENDING' as const, moderationReasons:[...reasons,'전체 게시글 운영진 승인 필요'], comments: previous?.comments ?? [], views: previous?.views ?? 0, reason: undefined };
      return addLog({ ...s, posts: previous ? s.posts.map(p => p.id === id ? post : p) : [post, ...s.posts] }, m, `${draft ? '글 임시 저장' : '글 승인 요청'}: ${post.title}`);
    });
    notify(draft ? '글을 임시 저장했습니다.' : '승인을 요청했습니다. 검토 후 공개됩니다.'); return id;
  }
  async function reviewPost(id: string, approve: boolean, reason?: string) {
    await commit((s, m) => {
      if (!canReview(m)) throw new Error('게시글 승인 권한이 없습니다.');
      const post = s.posts.find(p => p.id === id);
      if (!post || post.authorId === m.id) throw new Error('자신이 작성한 글은 다른 운영진이 검토해야 합니다.');
      if (post.status !== 'PENDING' && level(m) < 4) throw new Error('이미 처리된 글의 재검토는 LEVEL 4 이상만 가능합니다.');
      if (!approve && !reason?.trim()) throw new Error('반려 사유를 입력해 주세요.');
      return addLog({ ...s, posts: s.posts.map(p => p.id === id ? { ...p, status: approve ? 'APPROVED' : 'REJECTED', reason: approve ? undefined : reason } : p), notifications: [{ id: uid(), recipientId: post.authorId, title: `게시글이 ${approve ? '승인' : '반려'}되었습니다: ${post.title}`, href: `/posts/${id}`, read: false, date: stamp() }, ...s.notifications] }, m, `게시글 ${approve ? '승인' : '반려'}: ${post.title}`);
    }); notify('게시글 검토 결과를 저장했습니다.');
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
  async function createSuggestion(input: { title: string; category: string; content: string }) {
    const parsed = suggestionSchema.parse(input);
    await commit((s, m) => ({ ...s, suggestions: [{ ...parsed, id: uid(), authorId: m.id, status: '접수 완료', date: stamp() }, ...s.suggestions] })); notify('비공개 건의를 접수했습니다. 내 건의 내역에서 확인하세요.');
  }
  function register(name: string, classId: string) {
    if(!demoAllowed())throw new Error('회원 계정은 담당 교사가 별도로 발급합니다.');
    if (name.trim().length < 2 || !/^[1-3]-[1-6]$/.test(classId)) throw new Error('체험 이름과 학급을 확인해 주세요.');
    const id = uid(); persist({ ...ref.current, members: [...ref.current.members, { id, name: name.trim(), classId, role: 'STUDENT' as Role, status: 'PENDING' }], currentMemberId: id });
    notify('체험 가입 신청을 저장했습니다. 담당 교사 계정에서 승인할 수 있어요.'); return id;
  }
  return <DemoContext.Provider value={{ state, member, ready, toast, mode,busy,signIn,issueAccount,changeCredentials,notify, commit, switchMember, reset, createPost, reviewPost, saveSubmission, applyEvent, createSuggestion, register }}>{children}</DemoContext.Provider>;
}
export function useDemo() { const ctx = useContext(DemoContext); if (!ctx) throw new Error('DemoProvider가 필요합니다.'); return ctx; }
export async function runAction(action: () => unknown | Promise<unknown>, notify: (text: string) => void) { try { await action(); } catch (e) { notify(e instanceof Error ? e.message : '처리하지 못했습니다. 다시 시도해 주세요.'); } }
function emptyState():AppState{return {members:[],currentMemberId:null,posts:[],tasks:[],submissions:[],events:[],suggestions:[],pledges:[],surveys:[],mentoring:[],notifications:[],logs:[],reports:[]};}
