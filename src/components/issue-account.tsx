'use client';
import {useEffect,useState} from 'react';
import {Copy,KeyRound,UserPlus} from 'lucide-react';
import {useDemo,runAction} from './demo-provider';
import {isTeacher,ROLE_INFO,type Role} from '@/lib/domain';
import {supabase} from '@/lib/supabase/browser';
import {AccessDenied,PageHeading} from './shared';
import {Button} from './ui/button';

type TemporaryAccount={id?:string;loginId:string;password:string;studentId:string|null;name:string;role?:Role};

export function IssueAccountScreen(){
 const {member,issueAccount,notify,busy,mode}=useDemo();
 const [role,setRole]=useState<Role>('STUDENT');
 const [issuing,setIssuing]=useState(false);
 const [revision,setRevision]=useState(0);
 const [issued,setIssued]=useState<TemporaryAccount|null>(null);
 if(!isTeacher(member))return <AccessDenied/>;
 return <>
  <PageHeading eyebrow="L5 관리자" title="임시 계정 발급" description="등급별 인원 제한 없이 발급합니다. 계정 발급과 임시 로그인 정보 확인은 L5만 가능합니다."/>
  <section className="panel form-panel">
   <div className="info-box"><KeyRound size={20}/><div><strong>첫 로그인 후 아이디와 비밀번호를 변경합니다.</strong><p>최초 설정 전에는 L5가 임시 로그인 정보를 다시 확인할 수 있습니다. 설정을 마치면 보관된 임시 비밀번호가 삭제됩니다.</p></div></div>
   {mode==='demo'&&<p className="muted">로컬 체험에서는 이번 화면에서 발급한 정보만 표시합니다. 실제 학생 정보를 입력하지 마세요.</p>}
   <form onSubmit={e=>{
    e.preventDefault();if(issuing)return;const form=e.currentTarget;const data=new FormData(form);
    setIssuing(true);setIssued(null);
    void runAction(async()=>{try{
     const result=await issueAccount({studentId:String(data.get('studentId')??''),name:String(data.get('name')),gender:String(data.get('gender')??'') as 'MALE'|'FEMALE',role,position:role==='CLASS_OFFICER'?String(data.get('position')):undefined});
     if(mode==='demo')setIssued(result);
     setRevision(v=>v+1);form.reset();notify('계정을 발급했습니다. 임시 로그인 정보를 해당 회원에게 개별 전달하세요.');
    }finally{setIssuing(false);}},notify);
   }}>
    <div className="form-grid">
     {role!=='SUPERVISING_TEACHER'&&<label>학번<input name="studentId" required inputMode="numeric" maxLength={5} minLength={5} pattern="[1-3][0-9]{4}" placeholder="예: 20315" autoComplete="off"/></label>}
     <label>이름<input name="name" required minLength={2} maxLength={30} autoComplete="off"/></label>
     {role!=='SUPERVISING_TEACHER'&&<label>성별<select name="gender" required><option value="">학교 확인 정보 선택</option><option value="MALE">남학생</option><option value="FEMALE">여학생</option></select></label>}
     <label>회원 등급<select value={role} onChange={e=>setRole(e.target.value as Role)}>{Object.entries(ROLE_INFO).map(([code,r])=><option key={code} value={code}>L{r.level} {r.label}</option>)}</select></label>
     {role==='CLASS_OFFICER'&&<label>학급 직책<select name="position"><option value="CLASS_PRESIDENT">반장</option><option value="CLASS_VICE_PRESIDENT">부반장</option></select></label>}
    </div>
    <div className="form-actions"><Button disabled={busy||issuing}><UserPlus size={15}/>{issuing?'발급 중…':'임시 계정 발급'}</Button></div>
   </form>
  </section>
  {mode==='supabase'?<TemporaryDirectory key={member!.id} revision={revision}/>:issued&&<CredentialCard account={issued}/>}
 </>;
}

function CredentialCard({account}:{account:TemporaryAccount}){
 const {notify}=useDemo();
 return <section className="panel form-panel issued-credentials">
  <h2>{account.name} 회원의 임시 로그인 정보</h2>
  <p>{account.studentId?'학번 '+account.studentId+' · ':''}최초 설정을 마치면 이 목록에서 사라집니다.</p>
  <dl className="verified-identity"><div><dt>임시 아이디</dt><dd><code>{account.loginId}</code></dd></div><div><dt>임시 비밀번호</dt><dd><code>{account.password}</code></dd></div></dl>
  <Button variant="outline" onClick={()=>void runAction(async()=>{
   await navigator.clipboard.writeText(['소통해용','이름: '+account.name,'학번: '+(account.studentId??'해당 없음'),'임시 아이디: '+account.loginId,'임시 비밀번호: '+account.password,'첫 로그인 후 아이디와 비밀번호를 변경해 주세요.'].join('\n'));
   notify('임시 로그인 정보를 복사했습니다. 해당 회원에게만 전달하세요.');
  },notify)}><Copy size={14}/>개별 전달용 복사</Button>
 </section>;
}

function TemporaryDirectory({revision}:{revision:number}){
 const {member,notify}=useDemo();
 const [visible,setVisible]=useState(false);
 const [accounts,setAccounts]=useState<TemporaryAccount[]>([]);
 const [loading,setLoading]=useState(false);
 const [reload,setReload]=useState(0);
 useEffect(()=>{
  if(!visible||!isTeacher(member)){setAccounts([]);return;}
  let active=true;let inFlight=false;
  async function load(){
   if(inFlight||document.hidden)return;inFlight=true;setLoading(true);
   try{
    const {data,error}=await supabase!.functions.invoke('account-access',{body:{operation:'temporary-list'}});
    if(error)throw new Error('임시 로그인 정보를 확인하지 못했습니다. L5 권한과 연결 상태를 확인하세요.');
    if(active)setAccounts(data.accounts??[]);
   }catch(error){if(active){setAccounts([]);notify(error instanceof Error?error.message:'조회 실패');}}
   finally{inFlight=false;if(active)setLoading(false);}
  }
  void load();const timer=setInterval(()=>void load(),15000);
  const hide=()=>{if(document.hidden){setVisible(false);setAccounts([]);}};
  document.addEventListener('visibilitychange',hide);
  return ()=>{active=false;clearInterval(timer);document.removeEventListener('visibilitychange',hide);};
 },[visible,member,revision,reload,notify]);
 if(!isTeacher(member))return null;
 return <>
  <section className="panel form-panel"><h2>최초 설정 대기 계정</h2><p>임시 비밀번호는 L5만 조회할 수 있습니다. 최초 설정 완료 계정은 표시하지 않습니다.</p>
   <div className="form-actions"><Button variant="outline" onClick={()=>{setAccounts([]);setVisible(v=>!v);}}>{visible?'임시 로그인 정보 숨기기':'임시 로그인 정보 확인'}</Button>{visible&&<Button variant="ghost" disabled={loading} onClick={()=>{setAccounts([]);setReload(v=>v+1);}}>새로고침</Button>}</div>
   {visible&&<p>{loading?'확인 중…':accounts.length?accounts.length+'개 계정 · 15초마다 갱신':'최초 설정 대기 계정이 없습니다.'}</p>}
  </section>
  {visible&&accounts.map(account=><CredentialCard key={account.id} account={account}/>)}
 </>;
}
