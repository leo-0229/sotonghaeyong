'use client';
import {useState} from 'react';
import {useDemo,runAction} from './demo-provider';
import {isTeacher,level,type Member} from '@/lib/domain';
import {Button} from './ui/button';
import Link from './navigation';

export function AccountActions({target}:{target:Member}){
 const {member,manageAccount,notify}=useDemo();
 const [action,setAction]=useState<'reissue'|'delete'|null>(null);
 const [name,setName]=useState('');
 const [confirmed,setConfirmed]=useState(false);
 const [working,setWorking]=useState(false);
 if(level(member)<4||target.id===member?.id)return null;
 function close(){setAction(null);setName('');setConfirmed(false);}
 return <div>
  <div className="table-buttons">
   {isTeacher(member)&&target.status==='ACTIVE'&&<Button size="sm" variant="outline" disabled={working} onClick={()=>{close();setAction('reissue');}}>로그인 정보 재발급</Button>}
   <Button size="sm" variant="ghost" disabled={working} onClick={()=>{close();setAction('delete');}}>계정 삭제</Button>
  </div>
  {action&&<form className="confirm-box" role="dialog" aria-label={`${target.name} ${action==='delete'?'계정 삭제':'로그인 정보 재발급'} 확인`} onSubmit={e=>{
   e.preventDefault();if(working||name!==target.name||!confirmed)return;
   setWorking(true);
   void runAction(async()=>{try{
    await manageAccount(target.id,action,name);close();
    notify(action==='delete'?'계정을 삭제했습니다.':'새 임시 로그인 정보를 발급했습니다. 계정 발급 화면에서 확인하세요.');
   }finally{setWorking(false);}},notify);
  }}>
   <strong>{target.name} · {action==='delete'?'계정 삭제':'로그인 정보 재발급'}</strong>
   <p>{action==='delete'?'로그인 계정과 개인정보·개인 신청 내역을 삭제합니다. 게시글·댓글과 학급 제출 기록은 작성자 연결을 지우고 남습니다. 삭제한 계정은 복구할 수 없습니다.':'기존 로그인 정보와 로그인 세션을 무효화합니다. 글·학번·등급·활동 기록은 유지하고 최초 설정을 다시 진행합니다.'}</p>
   <label>확인할 회원 이름<input autoComplete="off" required value={name} onChange={e=>setName(e.target.value)} placeholder={target.name}/></label>
   <label className="checkbox-label"><input type="checkbox" required checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>{action==='delete'?'삭제 대상과 복구 불가 내용을 확인했습니다.':'학교에서 본인 요청임을 확인했습니다.'}</label>
   <div className="form-actions"><Button type="button" size="sm" variant="outline" disabled={working} onClick={close}>취소</Button><Button type="submit" size="sm" variant={action==='delete'?'destructive':'default'} disabled={working||name!==target.name||!confirmed}>{working?'처리 중…':action==='delete'?'삭제 확정':'재발급 확정'}</Button></div>
   {action==='reissue'&&<Link href="/admin/accounts">임시 로그인 정보 확인 화면</Link>}
  </form>}
 </div>;
}
