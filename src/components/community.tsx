'use client';
import Link from '@/components/navigation';
import { useRouter, useSearchParams } from '@/components/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {getPopularPosts} from '@/lib/post-views';
import {boardQuery,readBoardQuery,pageWindow} from '@/lib/board-query';
import {HomeOverview} from './home-overview';
import {useUnsavedChanges} from './use-unsaved-changes';
import {usePendingAction} from './use-pending-action';
import boardStyles from './board-layout.module.css';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {ChevronLeft,ChevronRight,Paperclip,PenLine,Search,Send,ShieldCheck} from 'lucide-react';
import { z } from 'zod';
import { Button } from './ui/button';
import {DeleteContentButton} from './content-deletion';
import {PostRejection} from './post-rejection';
import {HeartButton,PostComments} from './post-thread';
import { useDemo } from './demo-provider';
import { AccessDenied, EmptyState, PageHeading,StatusBadge } from './shared';
import { BOARDS,boardLabel,level,postSchema,type Post,BOARD_PREFIXES } from '@/lib/domain';
import { cn,dateTime } from '@/lib/utils';

export function HomeScreen(){return <HomeOverview renderPosts={posts=><PostTable posts={posts}/>}/>;}
export function PostTable({posts,showNumber=false,ranked=false,offset=0,totalCount=posts.length}:{posts:Post[];showNumber?:boolean;ranked?:boolean;offset?:number;totalCount?:number}){
 return <div className="table-scroll"><table className={boardStyles.table}><thead><tr>{showNumber&&<th className={boardStyles.number}>{ranked?'순위':'번호'}</th>}<th>제목</th><th className={boardStyles.authorCell}>작성자</th><th className={boardStyles.dateCell}>작성 시각</th><th className={boardStyles.views}>조회</th><th className={boardStyles.likes}>♥</th></tr></thead><tbody>{posts.map((p,i)=><tr className={cn('post-row',boardStyles.row)} key={p.id}>{showNumber&&<td className={boardStyles.number}>{ranked?offset+i+1:p.pinned?'공지':totalCount-offset-i}</td>}<td className={boardStyles.titleCell}><Link href={'/posts/'+p.id}><span className="post-category">{boardLabel(p.board)}</span>{p.board!=='music'&&p.prefix&&<span className={boardStyles.prefix}>[{p.prefix}]</span>}<span className={boardStyles.titleText}>{p.title}</span>{p.comments.some(c=>c.status==='APPROVED')&&<span className="comment-count">[{p.comments.filter(c=>c.status==='APPROVED').length}]</span>}</Link><div className={boardStyles.mobileMeta}>{p.author} · <time dateTime={p.date}>{dateTime(p.date)}</time> · 조회 {p.views}</div></td><td className={boardStyles.authorCell}>{p.author}</td><td className={boardStyles.dateCell}><time dateTime={p.date} title={'작성 '+dateTime(p.date)+(p.updatedAt?' · 수정 '+dateTime(p.updatedAt):'')}>{dateTime(p.date)}</time></td><td className={boardStyles.views}>{p.views}</td><td className={boardStyles.likes}>{p.hearts?.count??0}</td></tr>)}{!posts.length&&<tr><td colSpan={showNumber?6:5}><EmptyState title="게시글이 없어요" description="다른 게시판이나 말머리를 선택해 보세요."/></td></tr>}</tbody></table></div>;
}
export function BoardScreen({board='all',search=false,popular=false}:{board?:string;search?:boolean;popular?:boolean}){
 const {state}=useDemo();const params=useSearchParams(),router=useRouter();
 const filters=readBoardQuery(params);const {q:applied,sort,page,prefix:prefixFilter}=filters;
 const [query,setQuery]=useState(applied);
 useEffect(()=>setQuery(applied),[applied]);
 const update=(changes:Partial<typeof filters>)=>router.replace((search?'/search':popular?'/popular':board==='all'?'/boards':'/boards/'+board)+boardQuery({...filters,page:1,...changes}));
 const category=board==='all'?filters.board:board;
 const boardPosts=useMemo(()=>state.posts.filter(p=>p.status==='APPROVED'&&(category==='all'||p.board===category)),[state.posts,category]);
 const prefixes=[...new Set(boardPosts.filter(p=>p.board!=='music').map(p=>p.prefix).filter((p):p is string=>!!p))].sort((a,b)=>a.localeCompare(b,'ko'));
 const posts=useMemo(()=>{const filtered=boardPosts.filter(p=>(prefixFilter==='all'||(prefixFilter==='none'?!p.prefix:p.prefix===prefixFilter.slice(6)))&&[p.title,p.prefix??'',p.content,p.author].join(' ').toLowerCase().includes(applied.toLowerCase()));return popular?getPopularPosts(filtered):filtered.sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned)||(sort==='views'?b.views-a.views:+new Date(b.date)-+new Date(a.date)));},[boardPosts,prefixFilter,applied,sort,popular]);
 const pages=Math.max(1,Math.ceil(posts.length/10)),current=Math.min(page,pages);
 return <>
  <PageHeading eyebrow={search?'통합 검색':'진주 문산중학교 · 회원 전용 게시판'} title={popular?'인기글':search?'통합 검색':boardLabel(board)} description={popular?'공개된 글을 누적 조회수 순으로 보여 줍니다. 조회수가 같으면 최근 작성한 글이 먼저 나옵니다.':board==='music'?'노래 제목·가수를 소개하고 추천 이유를 나눠 주세요. 외부 링크와 이름 등은 기존 검토 기준을 따릅니다.':'게시판과 말머리로 소식을 찾아보세요. 작성·수정한 글은 검사 후 공개되며, 의심 내용은 운영진이 확인합니다.'} action={<Button asChild><Link href={'/posts/write?board='+(board==='all'?'free':board)}><PenLine size={16}/>글쓰기</Link></Button>}/>
  <nav className={boardStyles.navigation} aria-label="게시판 선택">{BOARDS.map(b=><Link key={b.id} href={b.id==='all'?'/boards':'/boards/'+b.id} aria-current={!popular&&!search&&board===b.id?'page':undefined}>{b.label}<small>{state.posts.filter(p=>p.status==='APPROVED'&&(b.id==='all'||p.board===b.id)).length}</small></Link>)}<Link href="/popular" aria-current={popular?'page':undefined}>인기글</Link></nav>
  <section className="panel board-panel">
   <div className="board-toolbar"><div className={boardStyles.filters}><span>전체 <strong>{posts.length}</strong>개</span><div>
    {board==='all'&&<select aria-label="게시판 필터" value={category} onChange={e=>update({board:e.target.value,prefix:'all'})}>{BOARDS.map(b=><option key={b.id} value={b.id}>{b.label}</option>)}</select>}
    {category!=='music'&&<select aria-label="말머리 필터" value={prefixFilter} onChange={e=>update({prefix:e.target.value})}><option value="all">전체 말머리</option><option value="none">말머리 없음</option>{prefixes.map(p=><option key={p} value={'value:'+p}>{p}</option>)}</select>}
    {!popular&&<select aria-label="게시글 정렬" value={sort} onChange={e=>update({sort:e.target.value})}><option value="latest">최신순</option><option value="views">조회순</option></select>}
   </div></div></div>
   <PostTable posts={posts.slice((current-1)*10,current*10)} showNumber ranked={popular} offset={(current-1)*10} totalCount={posts.length}/>
   <nav className="pagination" aria-label="게시글 페이지"><Button size="icon" variant="ghost" aria-label="이전 페이지" disabled={current<=1} onClick={()=>update({page:current-1})}><ChevronLeft size={16}/></Button>{current>3&&pages>5&&<button aria-label="1 페이지" onClick={()=>update({page:1})}>1 …</button>}{pageWindow(current,pages).map(n=><button key={n} aria-label={n+' 페이지'} aria-current={current===n?'page':undefined} className={cn(current===n&&'active')} onClick={()=>update({page:n})}>{n}</button>)}{current<pages-2&&pages>5&&<button aria-label={pages+' 페이지'} onClick={()=>update({page:pages})}>… {pages}</button>}<Button size="icon" variant="ghost" aria-label="다음 페이지" disabled={current>=pages} onClick={()=>update({page:current+1})}><ChevronRight size={16}/></Button></nav>
   <form className="board-search" onSubmit={e=>{e.preventDefault();update({q:query});}}><Search size={16}/><input value={query} maxLength={200} onChange={e=>setQuery(e.target.value)} placeholder="제목·내용·말머리·작성자 검색" aria-label="게시글 검색어"/><Button size="sm">검색</Button>{(applied||prefixFilter!=='all'||category!==board)&&<Button type="button" size="sm" variant="ghost" onClick={()=>{setQuery('');update({q:'',prefix:'all',board:'all'});}}>검색 초기화</Button>}</form>
  </section>
 </>;
}
export function PostScreen({id}:{id:string}){
 const {state,member,commit,notify,recordPostView}=useDemo();const router=useRouter();const [reporting,setReporting]=useState(false);const [report,setReport]=useState('');const recorded=useRef('');
 const reportAction=usePendingAction();
 const post=state.posts.find(p=>p.id===id);
 useEffect(()=>{
  if(post?.status!=='APPROVED'||!level(member)||post.authorId===member?.id)return;
  const key=member!.id+':'+id;if(recorded.current===key)return;recorded.current=key;
  void recordPostView(id).catch(error=>notify(error.message));
 },[id,member?.id,member?.status,member?.mustChangeCredentials,post?.status,post?.authorId,recordPostView,notify]);
 if(!post||(post.status!=='APPROVED'&&post.authorId!==member?.id&&level(member)<3))return <EmptyState title="게시글을 찾을 수 없어요" href="/boards"/>;
 return <><PageHeading eyebrow={boardLabel(post.board)} title="게시글"/><article className="panel article"><div className="article-category">{boardLabel(post.board)} {post.board!=='music'&&post.prefix&&<span className={boardStyles.prefix}>[{post.prefix}]</span>}<StatusBadge status={post.status}/></div><h1>{post.title}</h1><div className="article-meta"><strong>{post.author}</strong><time dateTime={post.date}>작성 {dateTime(post.date)}</time>{post.updatedAt&&+new Date(post.updatedAt)>+new Date(post.date)+1000&&<time dateTime={post.updatedAt}>수정 {dateTime(post.updatedAt)}</time>}<span>조회 {post.views}</span></div>{post.status==='PENDING'&&<div className="info-box warning" role="status"><div><strong>아직 공개되지 않은 글입니다.</strong><p>작성자와 검토 운영진만 볼 수 있습니다. 승인 전에는 전체 게시판과 다른 회원의 검색 결과에 표시되지 않습니다.</p>{!!post.moderationReasons?.length&&<p>{post.moderationReasons.join(' · ')}</p>}</div></div>}<PostRejection post={post}/><div className="article-body">{post.content}</div><div className="article-actions"><Button asChild variant="outline"><Link href={'/boards/'+post.board}>목록으로</Link></Button><HeartButton kind="post" id={post.id} hearts={post.hearts} disabled={post.status!=='APPROVED'}/>{post.authorId===member?.id&&post.status!=='HIDDEN'&&<Button asChild><Link href={'/posts/write?edit='+post.id}>{post.board==='music'?'글 수정':'글·말머리 수정'}</Link></Button>}<DeleteContentButton kind="post" id={post.id} authorId={post.authorId} onDeleted={()=>router.push('/boards/'+post.board)}/><Button variant="ghost" onClick={()=>setReporting(v=>!v)}>신고하기</Button></div>{reporting&&<form className="inline-form" onSubmit={e=>{e.preventDefault();void reportAction.run(async()=>{if(report.trim().length<5)throw new Error('신고 사유를 5자 이상 입력하세요.');await commit((s,m)=>({...s,reports:[...s.reports,{id:crypto.randomUUID(),postId:id,by:m.id,reason:report.trim()}]}));setReporting(false);notify('신고를 접수했습니다.');});}}><label>신고 사유<input value={report} onChange={e=>setReport(e.target.value)} required minLength={5} maxLength={500}/></label><Button size="sm" disabled={reportAction.pending}>신고 접수</Button></form>}<PostComments post={post}/></article></>;
}
export function WriteScreen() {
  const { member,state,createPost } = useDemo(); const router = useRouter(); const params = useSearchParams(); const editId = params.get('edit'); const old = state.posts.find(p => p.id === editId);
  const form = useForm<z.input<typeof postSchema>,unknown,z.output<typeof postSchema>>({ resolver: zodResolver(postSchema), defaultValues: { board: old?.board ?? params.get('board') ?? 'free', prefix:old?.prefix??'', title: old?.title ?? '', content: old?.content ?? '' } });
  const activeBoard=form.watch('board')??'free';
  const save=usePendingAction();
  useUnsavedChanges(form.formState.isDirty);
  useEffect(()=>{const choices=BOARD_PREFIXES[activeBoard]??[];if(!choices.includes(form.getValues('prefix')??''))form.setValue('prefix',choices[0]??'');},[activeBoard,form]);
  useEffect(()=>{if(old)form.reset({board:old.board,prefix:old.prefix??'',title:old.title,content:old.content});},[editId,old?.id,form]);
  if(editId&&(!old||old.authorId!==member?.id||old.status==='HIDDEN'))return <AccessDenied description="본인 글만 수정할 수 있습니다. 숨김 처리된 글은 운영진에게 문의하세요."/>;
  if (!level(member)) return <AccessDenied description="교사 승인된 회원이 게시글을 작성할 수 있습니다. 체험 계정을 선택해 주세요."/>;
  const submit = (draft: boolean) => form.handleSubmit(data => save.run(async () => { const id = await createPost(data, draft, editId ?? undefined); form.reset(data);router.push(`/posts/${id}`); }))();
  return <><PageHeading eyebrow="학생 커뮤니티" title={editId ? '게시글 수정' : '글쓰기'} description="친구들과 나누고 싶은 소식을 적어 주세요. 수정한 글도 다시 검사합니다. 검사에 걸리지 않으면 바로 공개됩니다."/><section className="panel form-panel"><div className="info-box"><ShieldCheck size={20}/><div><strong>규칙 검사를 통과하면 자동 공개됩니다.</strong><p>욕설·혐오·성적 표현, 교사 호칭(쌤·썜·선생님·선생·교사), 정치 관련 표현·인물 이름, 회원 이름·지정 은어, 외부 링크·전화번호 등이 있으면 승인 대기로 저장합니다.</p></div></div><form onSubmit={e => { e.preventDefault(); void submit(false); }}><label>게시판<select {...form.register('board')}>{BOARDS.filter(b => ['free', 'question', 'info','lost','music'].includes(b.id) || (level(member) >= 4 && ['notice', 'council', 'report'].includes(b.id))).map(b => <option key={b.id} value={b.id}>{b.label}</option>)}</select></label>{activeBoard!=='music'&&<label>말머리<select {...form.register('prefix')}>{(BOARD_PREFIXES[activeBoard]??[]).map(p=><option key={p} value={p}>{p}</option>)}</select></label>}{form.formState.errors.prefix&&<p className="field-error">{form.formState.errors.prefix.message}</p>}<label>제목<input {...form.register('title')} maxLength={100} placeholder="제목을 입력해 주세요"/></label>{form.formState.errors.title && <p className="field-error">{form.formState.errors.title.message}</p>}<label>내용<textarea {...form.register('content')} rows={13} maxLength={10000} placeholder="내용을 10자 이상 입력해 주세요."/></label>{form.formState.errors.content && <p className="field-error">{form.formState.errors.content.message}</p>}<p className="muted attachment-note"><Paperclip size={14}/>이미지·파일 첨부는 Supabase Storage 연동 후 제공됩니다.</p><div className="form-actions"><Button type="button" variant="outline" disabled={save.pending||form.formState.isSubmitting} onClick={() => void submit(true)}>임시 저장</Button><Button type="submit" disabled={save.pending||form.formState.isSubmitting}><Send size={15}/>{editId?'수정 내용 저장':'게시글 등록'}</Button></div></form></section></>;
}
