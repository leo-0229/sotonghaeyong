'use client';
import {useEffect,useState} from 'react';
import {useDemo} from './demo-provider';
import {supabase} from '@/lib/supabase/browser';
import {dateTime} from '@/lib/utils';
import type {Pledge} from '@/lib/domain';
import {Button} from './ui/button';

export function PledgeHistory({pledge}:{pledge:Pledge}){
  const {mode}=useDemo();const [open,setOpen]=useState(false),[rows,setRows]=useState<Pledge['history']>(),[error,setError]=useState(false),[revision,setRevision]=useState(0);
  useEffect(()=>{
    if(!open)return;
    if(mode!=='supabase'){setRows(pledge.history??[]);return;}
    let active=true;setError(false);setRows(undefined);
    void supabase!.rpc('pledge_history',{p_pledge:pledge.id}).then(({data,error})=>{if(active){setError(!!error);if(!error)setRows(data??[]);}});
    return ()=>{active=false;};
  },[open,mode,pledge.id,pledge.updated,pledge.history,revision]);
  return <details className="pledge-details" onToggle={e=>setOpen(e.currentTarget.open)}><summary>진행 상황 업데이트 이력</summary>{open&&(error?<div><p>이력을 불러오지 못했습니다. 서버 기능 설정과 연결을 확인해 주세요.</p><Button type="button" variant="outline" size="sm" onClick={()=>setRevision(n=>n+1)}>이력 다시 불러오기</Button></div>:rows===undefined?<p role="status">이력을 불러오는 중…</p>:rows.length?<ol className="pledge-history">{rows.map(row=><li key={row.id}><strong>{row.change.title}</strong><p>{({PLANNED:'추진 예정',ONGOING:'추진 중',COMPLETED:'완료',ON_HOLD:'보류'} as Record<string,string>)[row.change.status]??row.change.status} · 담당자 입력 진행률 {row.change.progress}%</p><time dateTime={row.date}>{dateTime(row.date)}</time> · {row.actor}<p>{row.change.description}</p><p>{row.change.details}</p></li>)}</ol>:<p>기능 적용 후 기록된 변경 이력이 없습니다.</p>)}</details>;
}
