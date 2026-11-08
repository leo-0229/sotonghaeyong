'use client';
import {useState} from 'react';
import {useDemo,runAction} from './demo-provider';
import {Button} from './ui/button';
import styles from './edit-text.module.css';

export function EditTextButton({kind,id,content,updatedAt}:{kind:'comment'|'suggestion-reply';id:string;content:string;updatedAt:string}){
 const {editContent,notify}=useDemo();const [open,setOpen]=useState(false);const [text,setText]=useState(content);const [version,setVersion]=useState(updatedAt);const [working,setWorking]=useState(false);
 if(!open)return <Button type="button" variant="ghost" size="sm" onClick={()=>{setText(content);setVersion(updatedAt);setOpen(true);}}>수정</Button>;
 return <form className={styles.form} onSubmit={e=>{e.preventDefault();if(working)return;setWorking(true);void runAction(async()=>{try{await editContent(kind,id,text,version);setOpen(false);}finally{setWorking(false);}},notify);}}>
  <label>수정 내용<textarea required minLength={kind==='comment'?2:5} maxLength={kind==='comment'?2000:3000} value={text} onChange={e=>setText(e.target.value)} rows={4}/></label>
  <p className="muted">수정한 내용도 다시 검사하며, 검사에 걸리면 승인 전까지 공개되지 않습니다.</p>
  <div className="form-actions"><Button type="button" variant="outline" disabled={working} onClick={()=>setOpen(false)}>수정 취소</Button><Button disabled={working}>수정 저장</Button></div>
 </form>;
}
