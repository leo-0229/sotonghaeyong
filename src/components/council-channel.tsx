'use client';
import {useEffect,useState} from 'react';
import {supabase} from '@/lib/supabase/browser';
import {isCouncil} from '@/lib/domain';
import {useDemo,runAction} from './demo-provider';
import {useSearchParams} from './navigation';
import {PageHeading,EmptyState} from './shared';
import {Button} from './ui/button';
import {dateTime} from '@/lib/utils';
import styles from './communication.module.css';
type Thread={id:string;memberId:string;name:string;classId:string;updatedAt:string;lastMessage:string|null};
type Message={id:string;senderId:string|null;senderName:string;content:string;system:boolean;date:string};
export function CouncilChannel(){
 const {member,mode,notify}=useDemo();const params=useSearchParams();
 const [threads,setThreads]=useState<Thread[]>([]),[threadId,setThreadId]=useState(''),[messages,setMessages]=useState<Message[]>([]);
 const [content,setContent]=useState(params.get('message')??''),[working,setWorking]=useState(false),[revision,setRevision]=useState(0);
 const [older,setOlder]=useState(false);
 const [historyExhausted,setHistoryExhausted]=useState(false);
 const requestedThread=params.get('thread');
 useEffect(()=>{if(requestedThread){setThreadId(requestedThread);setMessages([]);setHistoryExhausted(false);}},[requestedThread]);
 useEffect(()=>{
  if(mode!=='supabase')return;let active=true;
  async function load(){
   try{
    if(!isCouncil(member)){const opened=await supabase!.rpc('open_council_thread');if(opened.error)throw Error('대화방을 열지 못했습니다.');if(active)setThreadId(opened.data);}
    const {data,error}=await supabase!.rpc('council_thread_list');if(error)throw Error('학생회 채널을 불러오지 못했습니다.');if(active)setThreads(data??[]);
   }catch(error){if(active)notify(error instanceof Error?error.message:'연결 오류');}
  }
  void load();const timer=setInterval(()=>void load(),15000);return ()=>{active=false;clearInterval(timer);};
 },[mode,member,revision,notify]);
 useEffect(()=>{
  if(!threadId||mode!=='supabase')return;let active=true;
  async function load(){const {data,error}=await supabase!.rpc('council_message_list',{p_thread:threadId});if(!active)return;if(error){setMessages([]);notify('대화 내용을 불러오지 못했습니다.');}else {setMessages(previous=>{const map=new Map(previous.map(m=>[m.id,m]));for(const message of data??[])map.set(message.id,message);return [...map.values()].sort((a,b)=>+new Date(a.date)-+new Date(b.date));});if(!historyExhausted)setOlder((data?.length??0)>=100);}}
  void load();const timer=setInterval(()=>void load(),5000);return ()=>{active=false;clearInterval(timer);};
 },[threadId,mode,revision,notify,historyExhausted]);
 const thread=threads.find(t=>t.id===threadId);
 return <><PageHeading eyebrow="학생 참여" title="학생회 채널" description="본인과 학생회 임원만 확인하는 개인 문의 채널입니다. 행사·멘토링 신청 안내도 이곳으로 도착합니다."/>
  {mode==='demo'&&<div className="info-box">로컬 체험에서는 메시지를 화면에만 표시합니다. 실제 개인정보는 입력하지 마세요.</div>}
  <div className={styles.channel}>
   {isCouncil(member)&&<section className="panel"><h2 className={styles.heading}>개인 문의 목록</h2>{threads.map(t=><button className={styles.thread} key={t.id} aria-pressed={threadId===t.id} onClick={()=>{setMessages([]);setHistoryExhausted(false);setThreadId(t.id);}}><strong>{t.name} {t.classId&&'· '+t.classId}</strong><span>{t.lastMessage??'새 대화'}</span><time>{dateTime(t.updatedAt)}</time></button>)}{!threads.length&&<EmptyState title="접수된 개인 문의가 없습니다."/>}</section>}
   <section className="panel form-panel"><h2>{isCouncil(member)?thread?.name??'대화방을 선택하세요':'학생회와의 개인 대화'}</h2>
    {older&&<Button type="button" variant="outline" size="sm" onClick={()=>void runAction(async()=>{if(!messages.length)return;const {data,error}=await supabase!.rpc('council_message_list',{p_thread:threadId,p_before:messages[0].date});if(error)throw Error('이전 메시지를 불러오지 못했습니다.');setMessages(old=>[...(data??[]),...old]);setOlder((data?.length??0)>=100);if((data?.length??0)<100)setHistoryExhausted(true);},notify)}>이전 대화 보기</Button>}
    <div className={styles.messages} aria-live="polite">{messages.map(message=><article key={message.id} className={message.system?styles.system:message.senderId===member?.id?styles.mine:styles.message}><div><strong>{message.system?'신청·매칭 안내':message.senderName}</strong><time dateTime={message.date}>{dateTime(message.date)}</time></div><p>{message.content}</p></article>)}{!messages.length&&<p className="muted">문의할 내용을 남겨 주세요.</p>}</div>
    <form onSubmit={e=>{e.preventDefault();if(working)return;setWorking(true);void runAction(async()=>{try{if(mode==='supabase'){const {error}=await supabase!.rpc('send_council_message',{p_thread:threadId,p_content:content});if(error)throw Error('메시지를 보내지 못했습니다. 잠시 후 다시 시도하세요.');setRevision(v=>v+1);}else setMessages(old=>[...old,{id:crypto.randomUUID(),senderId:member!.id,senderName:member!.name,content,system:false,date:new Date().toISOString()}]);setContent('');}finally{setWorking(false);}},notify);}}>
     <label>학생회에 보낼 메시지<textarea required maxLength={2000} rows={4} value={content} onChange={e=>setContent(e.target.value)} disabled={mode==='supabase'&&!threadId}/></label><Button disabled={working||(mode==='supabase'&&!threadId)}>{working?'보내는 중…':'메시지 보내기'}</Button>
    </form>
   </section>
  </div>
 </>;
}
