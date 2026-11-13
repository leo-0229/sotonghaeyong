'use client';
import Link from '@/components/navigation';
import { useRouter, useSearchParams } from '@/components/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {getPopularPosts} from '@/lib/post-views';
import boardStyles from './board-layout.module.css';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDown, ArrowRight, BookOpen, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, Eye, FileText, GraduationCap, LockKeyhole, Megaphone, MessageCircle, MessagesSquare, Paperclip, PenLine, Pin, Search, Send, ShieldCheck, Sparkles, Users, Vote } from 'lucide-react';
import { z } from 'zod';
import { Button } from './ui/button';
import {DeleteContentButton} from './content-deletion';
import {HeartButton,PostComments} from './post-thread';
import { useDemo, runAction } from './demo-provider';
import { AccessDenied, EmptyState, PageHeading, PanelHeading, StatusBadge } from './shared';
import { BOARDS, boardLabel, canManageTask, classLabel, level, postSchema, ROLE_INFO, taskStats, type Post,BOARD_PREFIXES } from '@/lib/domain';
import { cn, dateTime, shortDate } from '@/lib/utils';

export function HomeScreen(){return <BoardScreen home/>;}
export function PostTable({posts,showNumber=false,ranked=false,offset=0}:{posts:Post[];showNumber?:boolean;ranked?:boolean;offset?:number}){
 return <div className="table-scroll"><table className={boardStyles.table}><thead><tr>{showNumber&&<th className={boardStyles.number}>{ranked?'순위':'번호'}</th>}<th>제목</th><th className={boardStyles.authorCell}>작성자</th><th className={boardStyles.dateCell}>작성 시각</th><th className={boardStyles.views}>조회</th><th className={boardStyles.likes}>♥</th></tr></thead><tbody>{posts.map((p,i)=><tr className={cn('post-row',boardStyles.row)} key={p.id}>{showNumber&&<td className={boardStyles.number}>{ranked?offset+i+1:p.pinned?'공지':posts.length-i}</td>}<td className={boardStyles.titleCell}><Link href={'/posts/'+p.id}><span className="post-category">{boardLabel(p.board)}</span>{p.board!=='music'&&p.prefix&&<span className={boardStyles.prefix}>[{p.prefix}]</span>}<span className={boardStyles.titleText}>{p.title}</span>{p.comments.some(c=>c.status==='APPROVED')&&<span className="comment-count">[{p.comments.filter(c=>c.status==='APPROVED').length}]</span>}</Link><div className={boardStyles.mobileMeta}>{p.author} · <time dateTime={p.date}>{dateTime(p.date)}</time> · 조회 {p.views}</div></td><td className={boardStyles.authorCell}>{p.author}</td><td className={boardStyles.dateCell}><time dateTime={p.date} title={'작성 '+dateTime(p.date)+(p.updatedAt?' · 수정 '+dateTime(p.updatedAt):'')}>{dateTime(p.date)}</time></td><td className={boardStyles.views}>{p.views}</td><td className={boardStyles.likes}>{p.hearts?.count??0}</td></tr>)}{!posts.length&&<tr><td colSpan={showNumber?6:5}><EmptyState title="게시글이 없어요" description="다른 게시판이나 말머리를 선택해 보세요."/></td></tr>}</tbody></table></div>;
}
export function BoardScreen({board='all',search=false,home=false,popular=false}:{board?:string;search?:boolean;home?:boolean;popular?:boolean}){
 const {state,member}=useDemo();const params=useSearchParams();
 const [query,setQuery]=useState(params.get('q')??'');const [applied,setApplied]=useState(params.get('q')??'');
 const [sort,setSort]=useState('latest');const [page,setPage]=useState(1);const [prefixFilter,setPrefixFilter]=useState('all');
 const boardPosts=useMemo(()=>state.posts.filter(p=>p.status==='APPROVED'&&(board==='all'||p.board===board)),[state.posts,board]);
 const prefixes=[...new Set(boardPosts.filter(p=>p.board!=='music').map(p=>p.prefix).filter((p):p is string=>!!p))].sort((a,b)=>a.localeCompare(b,'ko'));
 const posts=useMemo(()=>{const filtered=boardPosts.filter(p=>(prefixFilter==='all'||(prefixFilter==='none'?!p.prefix:p.prefix===prefixFilter.slice(6)))&&[p.title,p.prefix??'',p.content,p.author].join(' ').toLowerCase().includes(applied.toLowerCase()));return popular?getPopularPosts(filtered):filtered.sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned)||(sort==='views'?b.views-a.views:+new Date(b.date)-+new Date(a.date)));},[boardPosts,prefixFilter,applied,sort,popular]);
 const pages=Math.max(1,Math.ceil(posts.length/10)),current=Math.min(page,pages);
 return <>
  <PageHeading eyebrow={search?'통합 검색':'진주 문산중학교 · 회원 전용 게시판'} title={home?'소통해용.':popular?'인기글':search?'통합 검색':boardLabel(board)} description={popular?'공개된 글을 누적 조회수 순으로 보여 줍니다. 조회수가 같으면 최근 작성한 글이 먼저 나옵니다.':board==='music'?'노래 제목·가수를 소개하고 추천 이유를 나눠 주세요. 외부 링크와 이름 등은 기존 검토 기준을 따릅니다.':'게시판과 말머리로 소식을 찾아보세요. 작성·수정한 글은 검사 후 공개되며, 의심 내용은 운영진이 확인합니다.'} action={<Button asChild><Link href={'/posts/write?board='+(board==='all'?'free':board)}><PenLine size={16}/>글쓰기</Link></Button>}/>
  <nav className={boardStyles.navigation} aria-label="게시판 선택">{BOARDS.map(b=><Link key={b.id} href={b.id==='all'?'/boards':'/boards/'+b.id} aria-current={!popular&&!search&&board===b.id?'page':undefined}>{b.label}<small>{state.posts.filter(p=>p.status==='APPROVED'&&(b.id==='all'||p.board===b.id)).length}</small></Link>)}<Link href="/popular" aria-current={popular?'page':undefined}>인기글</Link></nav>
  {home&&<section className={`panel ${boardStyles.popularPreview}`} aria-label="인기글 미리보기"><PanelHeading title="인기글 TOP 5" href="/popular" text="전체 보기"/><p>누적 조회수 기준 · 공개된 글만 표시합니다.</p><PostTable posts={getPopularPosts(state.posts).slice(0,5)} showNumber ranked/></section>}
  <section className="panel board-panel">
   <div className="board-toolbar"><div className={boardStyles.filters}><span>전체 <strong>{posts.length}</strong>개</span><div>
    {board!=='music'&&<select aria-label="말머리 필터" value={prefixFilter} onChange={e=>{setPrefixFilter(e.target.value);setPage(1);}}><option value="all">전체 말머리</option><option value="none">말머리 없음</option>{prefixes.map(p=><option key={p} value={'value:'+p}>{p}</option>)}</select>}
    {!popular&&<select aria-label="게시글 정렬" value={sort} onChange={e=>{setSort(e.target.value);setPage(1);}}><option value="latest">최신순</option><option value="views">조회순</option></select>}
   </div></div></div>
   <PostTable posts={posts.slice((current-1)*10,current*10)} showNumber ranked={popular} offset={(current-1)*10}/>
   <div className="pagination"><Button size="icon" variant="ghost" aria-label="이전 페이지" disabled={current<=1} onClick={()=>setPage(current-1)}><ChevronLeft size={16}/></Button>{Array.from({length:pages},(_,i)=><button key={i} aria-label={(i+1)+' 페이지'} aria-current={current===i+1?'page':undefined} className={cn(current===i+1&&'active')} onClick={()=>setPage(i+1)}>{i+1}</button>)}<Button size="icon" variant="ghost" aria-label="다음 페이지" disabled={current>=pages} onClick={()=>setPage(current+1)}><ChevronRight size={16}/></Button></div>
   <form className="board-search" onSubmit={e=>{e.preventDefault();setApplied(query);setPage(1);}}><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="제목·내용·말머리·작성자 검색" aria-label="게시글 검색어"/><Button size="sm">검색</Button></form>
  </section>
  {home&&<section className={boardStyles.sectionLinks}><h2>학교 소식 · 참여 게시판</h2>{[
   ['/events','학교 행사','행사 안내와 참가 신청'],['/pledges','공약 이행 현황','학생회 공약과 세부 추진 내용'],['/suggestions','전자 건의함','공개 질문과 비공개 문의'],['/surveys','설문조사','학생 의견 모으기'],['/mentoring','학교생활 멘토링','동성 1:1 학교생활 도움'],['/class-tasks','학급 제출 현황','제출자와 수정 시각 확인'],
  ].map(([href,title,description])=><Link key={href} href={href}><strong>{title}</strong><span>{description}</span><ChevronRight size={15}/></Link>)}</section>}
 </>;
}
export function PostScreen({id}:{id:string}){
 const {state,member,commit,notify,recordPostView}=useDemo();const router=useRouter();const [reporting,setReporting]=useState(false);const [report,setReport]=useState('');const recorded=useRef('');
 const post=state.posts.find(p=>p.id===id);
 useEffect(()=>{
  if(post?.status!=='APPROVED'||!level(member)||post.authorId===member?.id)return;
  const key=member!.id+':'+id;if(recorded.current===key)return;recorded.current=key;
  void recordPostView(id).catch(error=>notify(error.message));
 },[id,member?.id,member?.status,member?.mustChangeCredentials,post?.status,post?.authorId,recordPostView,notify]);
 if(!post||(post.status!=='APPROVED'&&post.authorId!==member?.id&&level(member)<3))return <EmptyState title="게시글을 찾을 수 없어요" href="/boards"/>;
 return <><PageHeading eyebrow={boardLabel(post.board)} title="게시글"/><article className="panel article"><div className="article-category">{boardLabel(post.board)} {post.board!=='music'&&post.prefix&&<span className={boardStyles.prefix}>[{post.prefix}]</span>}<StatusBadge status={post.status}/></div><h1>{post.title}</h1><div className="article-meta"><strong>{post.author}</strong><time dateTime={post.date}>작성 {dateTime(post.date)}</time>{post.updatedAt&&+new Date(post.updatedAt)>+new Date(post.date)+1000&&<time dateTime={post.updatedAt}>수정 {dateTime(post.updatedAt)}</time>}<span>조회 {post.views}</span></div>{post.status==='PENDING'&&<div className="info-box warning" role="status"><div><strong>아직 공개되지 않은 글입니다.</strong><p>작성자와 검토 운영진만 볼 수 있습니다. 승인 전에는 전체 게시판과 다른 회원의 검색 결과에 표시되지 않습니다.</p>{!!post.moderationReasons?.length&&<p>{post.moderationReasons.join(' · ')}</p>}</div></div>}{post.status==='REJECTED'&&post.reason&&<div className="info-box warning">반려 사유: {post.reason}</div>}<div className="article-body">{post.content}</div><div className="article-actions"><Button asChild variant="outline"><Link href={'/boards/'+post.board}>목록으로</Link></Button><HeartButton kind="post" id={post.id} hearts={post.hearts} disabled={post.status!=='APPROVED'}/>{post.authorId===member?.id&&post.status!=='HIDDEN'&&<Button asChild><Link href={'/posts/write?edit='+post.id}>{post.board==='music'?'글 수정':'글·말머리 수정'}</Link></Button>}<DeleteContentButton kind="post" id={post.id} authorId={post.authorId} onDeleted={()=>router.push('/boards/'+post.board)}/><Button variant="ghost" onClick={()=>setReporting(v=>!v)}>신고하기</Button></div>{reporting&&<form className="inline-form" onSubmit={e=>{e.preventDefault();void runAction(async()=>{if(report.trim().length<5)throw new Error('신고 사유를 5자 이상 입력하세요.');await commit((s,m)=>({...s,reports:[...s.reports,{id:crypto.randomUUID(),postId:id,by:m.id,reason:report.trim()}]}));setReporting(false);notify('신고를 접수했습니다.');},notify);}}><label>신고 사유<input value={report} onChange={e=>setReport(e.target.value)} required minLength={5} maxLength={500}/></label><Button size="sm">신고 접수</Button></form>}<PostComments post={post}/></article></>;
}
export function WriteScreen() {
  const { member, state, createPost, notify } = useDemo(); const router = useRouter(); const params = useSearchParams(); const editId = params.get('edit'); const old = state.posts.find(p => p.id === editId);
  const form = useForm<z.input<typeof postSchema>,unknown,z.output<typeof postSchema>>({ resolver: zodResolver(postSchema), defaultValues: { board: old?.board ?? params.get('board') ?? 'free', prefix:old?.prefix??'', title: old?.title ?? '', content: old?.content ?? '' } });
  const activeBoard=form.watch('board')??'free';
  useEffect(()=>{const choices=BOARD_PREFIXES[activeBoard]??[];if(!choices.includes(form.getValues('prefix')??''))form.setValue('prefix',choices[0]??'');},[activeBoard,form]);
  useEffect(()=>{if(old)form.reset({board:old.board,prefix:old.prefix??'',title:old.title,content:old.content});},[editId,old?.id,form]);
  if(editId&&(!old||old.authorId!==member?.id||old.status==='HIDDEN'))return <AccessDenied description="본인 글만 수정할 수 있습니다. 숨김 처리된 글은 운영진에게 문의하세요."/>;
  if (!level(member)) return <AccessDenied description="교사 승인된 회원이 게시글을 작성할 수 있습니다. 체험 계정을 선택해 주세요."/>;
  const submit = (draft: boolean) => form.handleSubmit(data => runAction(async () => { const id = await createPost(data, draft, editId ?? undefined); router.push(`/posts/${id}`); }, notify))();
  return <><PageHeading eyebrow="학생 커뮤니티" title={editId ? '게시글 수정' : '글쓰기'} description="친구들과 나누고 싶은 소식을 적어 주세요. 수정한 글도 다시 검사합니다. 검사에 걸리지 않으면 바로 공개됩니다."/><section className="panel form-panel"><div className="info-box"><ShieldCheck size={20}/><div><strong>규칙 검사를 통과하면 자동 공개됩니다.</strong><p>욕설·혐오·성적 표현, 교사 호칭(쌤·썜·선생님·선생·교사), 정치 관련 표현·인물 이름, 회원 이름·지정 은어, 외부 링크·전화번호 등이 있으면 승인 대기로 저장합니다.</p></div></div><form onSubmit={e => { e.preventDefault(); void submit(false); }}><label>게시판<select {...form.register('board')}>{BOARDS.filter(b => ['free', 'question', 'info','lost','music'].includes(b.id) || (level(member) >= 4 && ['notice', 'council', 'report'].includes(b.id))).map(b => <option key={b.id} value={b.id}>{b.label}</option>)}</select></label>{activeBoard!=='music'&&<label>말머리<select {...form.register('prefix')}>{(BOARD_PREFIXES[activeBoard]??[]).map(p=><option key={p} value={p}>{p}</option>)}</select></label>}{form.formState.errors.prefix&&<p className="field-error">{form.formState.errors.prefix.message}</p>}<label>제목<input {...form.register('title')} maxLength={100} placeholder="제목을 입력해 주세요"/></label>{form.formState.errors.title && <p className="field-error">{form.formState.errors.title.message}</p>}<label>내용<textarea {...form.register('content')} rows={13} maxLength={10000} placeholder="내용을 10자 이상 입력해 주세요."/></label>{form.formState.errors.content && <p className="field-error">{form.formState.errors.content.message}</p>}<p className="muted attachment-note"><Paperclip size={14}/>이미지·파일 첨부는 Supabase Storage 연동 후 제공됩니다.</p><div className="form-actions"><Button type="button" variant="outline" disabled={form.formState.isSubmitting} onClick={() => void submit(true)}>임시 저장</Button><Button type="submit" disabled={form.formState.isSubmitting}><Send size={15}/>{editId?'수정 내용 저장':'게시글 등록'}</Button></div></form></section></>;
}
