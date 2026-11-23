'use client';

import {useEffect,useState} from 'react';
import {useDemo} from './demo-provider';
import {usePendingAction} from './use-pending-action';
import {Button} from './ui/button';
import {isCouncil,level,type Suggestion} from '@/lib/domain';
import {HANDLING_STATUS,handlingCode,type HandlingStatus,type SuggestionWorkflowData} from '@/lib/suggestion-workflow';
import {supabase} from '@/lib/supabase/browser';
import {dateTime} from '@/lib/utils';
import styles from './suggestion-workflow.module.css';

export function SuggestionWorkflow({suggestion}:{suggestion:Suggestion}){
  const {mode,member,state,commit,refreshData,notify}=useDemo();
  const [data,setData]=useState<SuggestionWorkflowData|null>(null),[error,setError]=useState(''),[revision,setRevision]=useState(0);
  const [editing,setEditing]=useState(false),[status,setStatus]=useState<HandlingStatus>('RECEIVED'),[note,setNote]=useState(''),[handler,setHandler]=useState(''),[dueOn,setDueOn]=useState(''),[version,setVersion]=useState('');
  const action=usePendingAction();
  const mayInspect=suggestion.authorId===member?.id||level(member)>=3;
  useEffect(()=>{
    if(mode!=='supabase'){setData(suggestion.workflow??{status:handlingCode(suggestion.status),version:suggestion.updatedAt??suggestion.date,history:[]});return;}
    let active=true;setError('');
    void supabase!.rpc('suggestion_workflow',{p_suggestion:suggestion.id}).then(({data:result,error:failure})=>{
      if(!active)return;
      if(failure)setError('처리 이력을 불러오지 못했습니다. 담당자는 건의함 처리 기능 설정을 확인해 주세요.');
      else setData(result);
    });
    return ()=>{active=false;};
  },[mode,member?.id,suggestion.id,suggestion.status,suggestion.updatedAt,suggestion.workflow,revision]);
  const current=data?.status??handlingCode(suggestion.status);
  const stages:HandlingStatus[]=['RECEIVED','REVIEWING','ASSIGNED','RESOLVED'];
  return <section className={styles.workflow} aria-label="건의 처리 진행 상황">
    <h2>처리 진행 상황</h2><ol className={styles.stages}>{stages.map((stage,index)=><li key={stage} aria-current={current===stage?'step':undefined} data-complete={current!=='REJECTED'&&stages.indexOf(current)>index}>{stage==='ASSIGNED'?'처리 중':HANDLING_STATUS[stage]}</li>)}</ol>
    {current==='REJECTED'&&<p className="field-error">반려 또는 처리 불가 · 아래 처리 사유를 확인해 주세요.</p>}
    {error?<div role="status"><p>{error}</p><Button type="button" size="sm" variant="outline" onClick={()=>setRevision(n=>n+1)}>처리 이력 다시 불러오기</Button></div>:!data?<p role="status">처리 이력을 불러오는 중…</p>:<>
      {mayInspect&&<><p className="muted">담당자 {data.handler??'미지정'} · 처리 예정일 {data.dueOn??'미지정'}</p><p className="muted">담당자·예정일·처리 사유는 작성자와 운영진만 확인합니다. 답변은 학생회가 별도로 작성합니다.</p>
      <details><summary>처리 이력 {data.history.length}건</summary>{data.history.length?<ol className={styles.history}>{data.history.map(entry=><li key={entry.id}><strong>{HANDLING_STATUS[entry.status]}</strong> · {entry.actor}<time dateTime={entry.date}>{dateTime(entry.date)}</time>{entry.note&&<p>{entry.note}</p>}</li>)}</ol>:<p>기능 적용 후 기록된 처리 이력이 없습니다.</p>}</details></>}
      {isCouncil(member)&&!editing&&<Button type="button" variant="outline" onClick={()=>{setStatus(data.status);setHandler(data.handlerId??'');setDueOn(data.dueOn??'');setVersion(data.version??'');setNote('');setEditing(true);}}>처리 상태·담당자 변경</Button>}
    </>}
    {editing&&<form onSubmit={e=>{e.preventDefault();void action.run(async()=>{
      if(mode==='supabase'){
        const {error:failure}=await supabase!.rpc('update_suggestion_workflow',{p_suggestion:suggestion.id,p_status:status,p_note:note,p_handler:handler||null,p_due_on:dueOn||null,p_expected_updated_at:version});
        if(failure)throw new Error(failure.message.includes('EDIT_CONFLICT')?'다른 사람이 건의를 수정했습니다. 처리를 취소하고 최신 이력을 확인한 뒤 다시 시도해 주세요.':'처리하지 못했습니다. 권한·사유·서버 설정을 확인해 주세요.');
        await refreshData();
      }else{
        await commit((previous,actor)=>{
          if(!isCouncil(actor))throw new Error('학생회만 처리 상태를 변경할 수 있습니다.');
          const item=previous.suggestions.find(s=>s.id===suggestion.id);
          if(!item||(item.updatedAt??item.date)!==version)throw new Error('다른 사람이 건의를 수정했습니다. 최신 내용을 확인해 주세요.');
          const now=new Date(Math.max(Date.now(),+new Date(version)+1)).toISOString();
          const workflow:SuggestionWorkflowData={status,version:now,handlerId:handler||null,handler:previous.members.find(m=>m.id===handler)?.name,dueOn:dueOn||null,history:[{id:crypto.randomUUID(),status,actor:actor.name,note:note.trim(),date:now},...(item.workflow?.history??[])]};
          return {...previous,suggestions:previous.suggestions.map(s=>s.id===item.id?{...s,status:HANDLING_STATUS[status],updatedAt:now,workflow}:s)};
        });
      }
      setEditing(false);setRevision(n=>n+1);notify('건의 처리 상태와 사유를 저장했습니다.');
    });}}>
      <label>새 처리 상태<select value={status} onChange={e=>setStatus(e.target.value as HandlingStatus)}>{Object.entries(HANDLING_STATUS).map(([code,label])=><option key={code} value={code}>{code==='ASSIGNED'?'처리 중 · 담당자 전달':label}</option>)}</select></label>
      <div className="form-grid"><label>건의 담당자<select value={handler} onChange={e=>setHandler(e.target.value)}><option value="">미지정</option>{state.members.filter(isCouncil).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label>처리 예정일<input type="date" value={dueOn} onChange={e=>setDueOn(e.target.value)}/></label></div>
      <label>처리 사유·결과 안내<textarea required minLength={5} maxLength={1000} value={note} onChange={e=>setNote(e.target.value)} placeholder="작성자가 확인할 진행 상황·처리 결과·반려 사유를 5자 이상 적어 주세요. 개인정보는 쓰지 마세요."/></label>
      <div className="form-actions"><Button type="button" variant="outline" disabled={action.pending} onClick={()=>{setEditing(false);setRevision(n=>n+1);}}>처리 취소</Button><Button disabled={action.pending}>처리 내용 저장</Button></div>
    </form>}
  </section>;
}
