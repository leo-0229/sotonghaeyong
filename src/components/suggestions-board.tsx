'use client';
import {useEffect,useState} from 'react';
import Link,{usePathname,useRouter,useSearchParams} from './navigation';
import {useDemo,runAction} from './demo-provider';
import {isCouncil,isTeacher,level,canReadSuggestion,suggestionSchema} from '@/lib/domain';
import {AccessDenied,EmptyState,PageHeading,StatusBadge} from './shared';
import {Button} from './ui/button';
import {dateTime} from '@/lib/utils';
import {useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {z} from 'zod';
export function SuggestionsScreen({create=false,admin=false}:{create?:boolean;admin?:boolean}){
 const {state,member,createSuggestion,replySuggestion,notify,busy}=useDemo();
 const router=useRouter(),path=usePathname(),params=useSearchParams();
 const [tab,setTab]=useState(path.endsWith('/mine')?'mine':admin?'manage':'public');const [reply,setReply]=useState('');
 useEffect(()=>{setTab(path.endsWith('/mine')?'mine':admin?'manage':'public');setReply('');},[path,admin]);
 const form=useForm<z.input<typeof suggestionSchema>,unknown,z.output<typeof suggestionSchema>>({resolver:zodResolver(suggestionSchema),defaultValues:{category:'학교 시설',title:'',content:'',visibility:'PRIVATE'}});
 if(!level(member))return <AccessDenied/>;
 const canManage=isCouncil(member)||isTeacher(member);
 const selected=state.suggestions.find(s=>s.id===params.get('id')&&canReadSuggestion(member,s));
 const visible=state.suggestions.filter(s=>canReadSuggestion(member,s)&&(tab==='mine'?s.authorId===member?.id:tab==='manage'?canManage:s.visibility==='PUBLIC'&&s.publicationStatus==='APPROVED')).sort((a,b)=>+new Date(b.date)-+new Date(a.date));
 return <><PageHeading eyebrow="학생 참여" title={create?'건의·질문 작성':'전자 건의함'} description="공개 질문과 비공개 문의를 선택할 수 있습니다. 답변은 학생회 임원이 작성합니다." action={!create&&<Button asChild><Link href="/suggestions/new">글쓰기</Link></Button>}/>
  {create?<section className="panel form-panel"><form onSubmit={form.handleSubmit(data=>runAction(async()=>{await createSuggestion(data);router.push('/suggestions/mine');},notify))}>
   <label>공개 범위<select {...form.register('visibility')}><option value="PRIVATE">비공개 · 작성자와 운영 담당자만</option><option value="PUBLIC">공개 · 검토 후 모든 회원에게</option></select></label>
   <label>건의 분야<select {...form.register('category')}>{['학교 시설','학교 행사','학생회','급식','생활 환경','기타'].map(c=><option key={c}>{c}</option>)}</select></label>
   <label>제목<input {...form.register('title')} maxLength={100}/></label><label>건의 내용<textarea {...form.register('content')} minLength={10} maxLength={5000} rows={10}/></label>
   <p className="muted">공개 글은 규칙 검사를 통과하면 바로 표시합니다. 욕설·교사 호칭·정치 관련 표현 등 의심되는 내용은 운영진이 검토합니다. 개인정보는 적지 마세요.</p>
   {Object.values(form.formState.errors).map((error,i)=><p className="field-error" key={i}>{error.message}</p>)}<div className="form-actions"><Button disabled={busy}>건의·질문 등록</Button></div>
  </form></section>:<>
   <div className="filter-tabs"><button onClick={()=>setTab('public')} aria-pressed={tab==='public'}>공개 질문</button><button onClick={()=>setTab('mine')} aria-pressed={tab==='mine'}>내 질문</button>{canManage&&<button onClick={()=>setTab('manage')} aria-pressed={tab==='manage'}>학생회 확인 목록</button>}</div>
   {selected&&<article className="panel article"><div className="article-category">{selected.visibility==='PUBLIC'?'공개':'비공개'} · {selected.category} <StatusBadge status={selected.status}/></div><h1>{selected.title}</h1><p className="muted">작성 {dateTime(selected.date)}</p><div className="article-body">{selected.content}</div>{selected.publicationStatus==='PENDING'&&selected.visibility==='PUBLIC'&&<div className="info-box">공개 검토 중입니다.</div>}
    {(selected.replies??[]).map(answer=><section className="comment" key={answer.id}><strong>학생회 · {answer.author}</strong><p className="muted">{dateTime(answer.date)} · <StatusBadge status={answer.status}/></p><p className="article-body">{answer.content}</p></section>)}
    {!selected.replies?.length&&selected.reply&&<div className="info-box"><div><strong>학생회 답변</strong><p>{selected.reply}</p></div></div>}
    {isCouncil(member)&&<form onSubmit={e=>{e.preventDefault();void runAction(async()=>{await replySuggestion(selected.id,reply);setReply('');},notify);}}><label>학생회 답변<textarea required minLength={5} maxLength={3000} value={reply} onChange={e=>setReply(e.target.value)}/></label><Button disabled={busy}>답변 등록</Button></form>}
   </article>}
   <section className="panel"><div className="table-scroll"><table><thead><tr><th>공개 범위</th><th>제목</th><th>처리 상태</th><th>작성 시각</th></tr></thead><tbody>{visible.map(s=><tr key={s.id}><td>{s.visibility==='PUBLIC'?'공개':'비공개'}</td><td><Link href={'/suggestions'+(tab==='mine'?'/mine':'')+'?id='+s.id}>{s.title}</Link>{s.publicationStatus==='PENDING'&&s.visibility==='PUBLIC'&&<StatusBadge status="PENDING"/>}</td><td><StatusBadge status={s.status}/></td><td><time dateTime={s.date}>{dateTime(s.date)}</time></td></tr>)}</tbody></table></div>{!visible.length&&<EmptyState title="표시할 질문이 없습니다." description="공개 질문을 보거나 내 질문을 작성해 보세요."/>}</section>
  </>}
 </>;
}
