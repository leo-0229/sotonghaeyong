'use client';
import {useState} from 'react';
import Link from './navigation';
import {useDemo,runAction} from './demo-provider';
import {PageHeading,EmptyState} from './shared';
import {Button} from './ui/button';
import {dateTime} from '@/lib/utils';
export function EventsScreen({id}:{id?:string}){
 const {state,member,applyEvent,notify}=useDemo();const [mine,setMine]=useState(false);
 const events=state.events.filter(e=>(!id||e.id===id)&&(!mine||e.applications.includes(member?.id??''))).sort((a,b)=>+new Date(b.date)-+new Date(a.date));
 const event=id?events[0]:undefined;
 return <><PageHeading eyebrow="학교 소식" title={event?.title??'학교 행사'} description="행사 일정·신청 마감을 확인하세요. 신청 안내와 문의는 학생회 채널로 연결됩니다."/>
  {event?<article className="panel article"><p className="article-body">{event.description}</p><dl className="task-facts"><div><span>행사 일시</span><strong>{dateTime(event.date)}</strong></div><div><span>신청 마감</span><strong>{dateTime(event.deadline)}</strong></div><div><span>장소</span><strong>{event.place}</strong></div></dl><div className="form-actions">{event.method==='individual'?<Button disabled={Date.now()>+new Date(event.deadline)} onClick={()=>void runAction(()=>applyEvent(event.id),notify)}>{event.applications.includes(member?.id??'')?'신청 취소':'행사 참가 신청'}</Button>:event.method==='class'?<Button asChild><Link href={'/class-tasks/'+event.taskId}>학급별 업무 확인</Link></Button>:<span>별도 신청이 없는 행사입니다.</span>}<Button asChild variant="outline"><Link href={'/council-channel?message='+encodeURIComponent('행사 ['+event.title+']에 문의합니다. ')}>학생회에 문의</Link></Button><Button asChild variant="ghost"><Link href="/events">목록으로</Link></Button></div></article>:<><div className="filter-tabs"><button onClick={()=>setMine(false)} aria-pressed={!mine}>전체 행사</button><button onClick={()=>setMine(true)} aria-pressed={mine}>내가 신청한 행사</button></div><section className="panel"><div className="table-scroll"><table><thead><tr><th>행사명</th><th>행사 일시</th><th>신청 마감</th><th>신청 상태</th></tr></thead><tbody>{events.map(e=><tr key={e.id}><td><Link href={'/events/'+e.id}>{e.title}</Link></td><td>{dateTime(e.date)}</td><td>{dateTime(e.deadline)}</td><td>{e.applications.includes(member?.id??'')?'내 신청 완료':Date.now()>+new Date(e.deadline)?'마감':'신청 가능'}</td></tr>)}</tbody></table></div>{!events.length&&<EmptyState title="표시할 행사가 없습니다."/>}</section></>}
 </>;
}
