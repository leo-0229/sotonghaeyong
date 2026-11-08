'use client';
import {useEffect,useRef,useState} from 'react';
import {useDemo,runAction} from './demo-provider';
import {level} from '@/lib/domain';
import {Button} from './ui/button';
import styles from './content-deletion.module.css';

export function DeleteContentButton({kind,id,authorId,onDeleted}:{kind:'post'|'comment';id:string;authorId:string;onDeleted?:()=>void}){
 const {member,deleteContent,notify}=useDemo();const [open,setOpen]=useState(false),[reason,setReason]=useState(''),[confirmed,setConfirmed]=useState(false),[working,setWorking]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null);const forced=authorId!==member?.id;
 const label=(kind==='post'?'게시글':'댓글')+(forced?' 강제 삭제':' 삭제');
 useEffect(()=>{if(open&&!dialog.current?.open)dialog.current?.showModal();},[open]);
 if(!level(member)||(forced&&level(member)<4))return null;
 function close(){if(working)return;setOpen(false);setReason('');setConfirmed(false);}
 return <><Button type="button" size="sm" variant="destructive" disabled={working} onClick={()=>setOpen(true)}>{label}</Button>
 {open&&<dialog ref={dialog} className={styles.dialog} aria-label={label+' 확인'} onCancel={e=>{e.preventDefault();close();}}><form onSubmit={e=>{
  e.preventDefault();if(working||!confirmed||(forced&&reason.trim().length<5))return;setWorking(true);
  void runAction(async()=>{try{await deleteContent(kind,id,reason);setOpen(false);setReason('');setConfirmed(false);onDeleted?.();}finally{setWorking(false);}},notify);
 }}><h2>{label}</h2><p>{kind==='post'?'게시글 본문·수정 이력·댓글·하트가 함께 삭제되며 복구할 수 없습니다.':'댓글 본문과 하트를 삭제하며 복구할 수 없습니다. 연결된 답글은 일반 댓글로 남습니다.'}</p>
 {forced&&<label>강제 삭제 사유<textarea required minLength={5} maxLength={500} autoFocus value={reason} onChange={e=>setReason(e.target.value)}/></label>}
 <label className="checkbox-label"><input type="checkbox" required autoFocus={!forced} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>삭제 대상과 복구 불가 내용을 확인했습니다.</label>
 <p className="muted">삭제한 내용 대신 처리자·시각·대상 ID와 강제 삭제 사유만 운영 기록에 남깁니다.</p>
 <div className="form-actions"><Button type="button" variant="outline" disabled={working} onClick={close}>취소</Button><Button type="submit" variant="destructive" disabled={working||!confirmed||(forced&&reason.trim().length<5)}>{working?'삭제 중…':'삭제 확정'}</Button></div></form></dialog>}
 </>;
}
