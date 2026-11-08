'use client';
import {useEffect,useRef,useState} from 'react';
import Link from './navigation';
import {useDemo,runAction} from './demo-provider';
import {supabase} from '@/lib/supabase/browser';
import {level} from '@/lib/domain';
import {Button} from './ui/button';
import {DeleteContentButton} from './content-deletion';
import {dateTime} from '@/lib/utils';
import styles from './content-deletion.module.css';

export function CommentReportButton({id,authorId}:{id:string;authorId:string}){
 const {member,reportComment,notify}=useDemo();const [open,setOpen]=useState(false),[reason,setReason]=useState(''),[working,setWorking]=useState(false);const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(open&&!dialog.current?.open)dialog.current?.showModal();},[open]);
 if(!level(member)||authorId===member?.id)return null;
 return <><Button type="button" size="sm" variant="ghost" onClick={()=>setOpen(true)}>댓글 신고</Button>{open&&<dialog ref={dialog} className={styles.dialog} aria-label="댓글 신고" onCancel={e=>{if(working)e.preventDefault();else setOpen(false);}}><form onSubmit={e=>{
  e.preventDefault();if(working||reason.trim().length<5)return;setWorking(true);void runAction(async()=>{try{await reportComment(id,reason);setOpen(false);setReason('');}finally{setWorking(false);}},notify);
 }}><h2>댓글 신고</h2><p>욕설·비방·개인정보 노출 등 신고 사유를 적어 주세요. 신고 내용은 신고한 회원과 검토 운영진만 확인합니다.</p><label>댓글 신고 사유<textarea autoFocus required minLength={5} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label><div className="form-actions"><Button type="button" variant="outline" disabled={working} onClick={()=>setOpen(false)}>취소</Button><Button type="submit" disabled={working||reason.trim().length<5}>{working?'접수 중…':'댓글 신고 접수'}</Button></div></form></dialog>}</>;
}

type Entry={id:string;commentId:string;postId:string;reason:string;date:string;content:string;authorId:string;author:string;title:string;reporter:string};
export function CommentReports(){
 const {state,member,mode,notify,reviewCommentReport}=useDemo();const [rows,setRows]=useState<Entry[]>([]),[revision,setRevision]=useState(0);
 useEffect(()=>{if(mode!=='supabase'||level(member)<3)return;let active=true;void supabase!.rpc('comment_report_queue').then(({data,error})=>{if(!active)return;if(error)notify('댓글 신고 목록을 불러오지 못했습니다.');else setRows(data??[]);});return()=>{active=false;};},[mode,member,state.posts,revision,notify]);
 if(level(member)<3)return null;
 const entries:Entry[]=mode==='supabase'?rows:(state.commentReports??[]).filter(r=>r.status==='OPEN').flatMap(r=>{const post=state.posts.find(p=>p.id===r.postId);const comment=post?.comments.find(c=>c.id===r.commentId);return post&&comment?[{...r,content:comment.content,authorId:comment.authorId,author:comment.author,title:post.title,reporter:state.members.find(m=>m.id===r.reporterId)?.name??'탈퇴 회원'}]:[];});
 return <section className="panel form-panel"><h2>댓글 신고 접수 · {entries.length}건</h2><Button type="button" size="sm" variant="outline" onClick={()=>setRevision(v=>v+1)}>댓글 신고 새로고침</Button>{entries.map(row=><article className="comment-report" key={row.id}><h3><Link href={'/posts/'+row.postId}>{row.title}</Link></h3><p className="muted">댓글 작성자 {row.author} · 신고자 {row.reporter} · {dateTime(row.date)}</p><p className="article-body">{row.content}</p><div className="info-box warning">신고 사유: {row.reason}</div><div className="form-actions"><Button type="button" size="sm" variant="outline" onClick={()=>void runAction(async()=>{await reviewCommentReport(row.id,'DISMISSED');setRevision(v=>v+1);},notify)}>신고 기각</Button><Button type="button" size="sm" onClick={()=>void runAction(async()=>{await reviewCommentReport(row.id,'REVIEWED');setRevision(v=>v+1);},notify)}>확인 완료</Button><DeleteContentButton kind="comment" id={row.commentId} authorId={row.authorId} onDeleted={()=>setRevision(v=>v+1)}/></div></article>)}{!entries.length&&<p className="muted">미처리 댓글 신고가 없습니다.</p>}</section>;
}
