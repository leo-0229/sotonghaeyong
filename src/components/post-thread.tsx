'use client';
import {useState} from 'react';
import {DeleteContentButton} from './content-deletion';
import {CommentReportButton} from './comment-reports';
import {Heart,MessageCircle} from 'lucide-react';
import {useDemo,runAction} from './demo-provider';
import {Button} from './ui/button';
import {StatusBadge} from './shared';
import {dateTime} from '@/lib/utils';
import {level,type Post,type PostComment,type HeartSummary} from '@/lib/domain';
import styles from './board-layout.module.css';
export function HeartButton({kind,id,hearts,disabled=false}:{kind:'post'|'comment';id:string;hearts?:HeartSummary;disabled?:boolean}){
 const {toggleHeart,notify}=useDemo();const [working,setWorking]=useState(false);
 return <Button type="button" size="sm" variant="outline" disabled={disabled||working} aria-label={hearts?.liked?'하트 취소':'하트 누르기'} aria-pressed={!!hearts?.liked} onClick={()=>{if(working)return;setWorking(true);void runAction(async()=>{try{await toggleHeart(kind,id);}finally{setWorking(false);}},notify);}}><Heart size={15} fill={hearts?.liked?'currentColor':'none'}/>{hearts?.count??0}</Button>;
}
export function PostComments({post}:{post:Post}){
 const {member,createComment,notify}=useDemo();const [content,setContent]=useState('');const [reply,setReply]=useState<PostComment|null>(null);const [working,setWorking]=useState(false);
 const comments=post.comments.filter(c=>c.status==='APPROVED'||c.authorId===member?.id||level(member)>=3);
 const render=(comment:PostComment,child=false)=><div className={child?styles.childComment:'comment'} key={comment.id}><div className={styles.commentMeta}><strong>{child?'↳ ':''}{comment.author}</strong><time dateTime={comment.date}>{dateTime(comment.date)}</time>{comment.status==='PENDING'&&<StatusBadge status="PENDING"/>}</div><p className={styles.commentBody}>{comment.content}</p>{comment.status==='PENDING'&&<p className="muted">공개되지 않은 댓글입니다. 작성자와 검토 운영진만 볼 수 있습니다.</p>}<div className={styles.commentActions}>{comment.status==='APPROVED'&&<><HeartButton kind="comment" id={comment.id} hearts={comment.hearts}/>{!child&&<Button type="button" size="sm" variant="ghost" onClick={()=>setReply(comment)}>답글</Button>}<CommentReportButton id={comment.id} authorId={comment.authorId}/></>}<DeleteContentButton kind="comment" id={comment.id} authorId={comment.authorId} onDeleted={()=>{if(reply?.id===comment.id)setReply(null);}}/></div></div>;
 return <section className="comments"><h2><MessageCircle size={17}/>댓글 {post.comments.filter(c=>c.status==='APPROVED').length}</h2>{comments.filter(c=>!c.parentId).map(c=><div key={c.id}>{render(c)}{comments.filter(child=>child.parentId===c.id).map(child=>render(child,true))}</div>)}
  {post.status==='APPROVED'?<form onSubmit={e=>{e.preventDefault();if(working)return;setWorking(true);void runAction(async()=>{try{await createComment(post.id,content,reply?.id);setContent('');setReply(null);}finally{setWorking(false);}},notify);}}>{reply&&<div className="info-box">{reply.author}님에게 답글 작성 <Button type="button" size="sm" variant="ghost" onClick={()=>setReply(null)}>취소</Button></div>}<label htmlFor="comment">{reply?'답글 내용':'댓글 내용'}</label><textarea id="comment" required minLength={2} maxLength={2000} value={content} onChange={e=>setContent(e.target.value)} placeholder="서로를 존중하는 댓글을 남겨 주세요."/><div className="comment-bottom"><span>규칙 검사를 통과한 댓글은 바로 공개하고, 의심 내용은 운영진이 검토합니다.</span><Button type="submit" size="sm" disabled={working}>{working?'등록 중…':reply?'답글 등록':'댓글 등록'}</Button></div></form>:<p>글이 공개되면 댓글을 작성할 수 있습니다.</p>}
 </section>;
}
