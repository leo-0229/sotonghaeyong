'use client';
import {useEffect,useState} from 'react';
import {useDemo} from './demo-provider';
import {supabase} from '@/lib/supabase/browser';
import {dateTime} from '@/lib/utils';
import {classLabel} from '@/lib/domain';
import {StatusBadge} from './shared';
type Entry={classId:string;status:string;submittedBy:string|null;updatedBy:string|null;updatedAt:string|null};
export function TaskPublicStatus({taskId}:{taskId:string}){
 const {state,mode,notify}=useDemo();const [rows,setRows]=useState<Entry[]>([]);
 useEffect(()=>{if(mode!=='supabase')return;let active=true;void supabase!.rpc('class_submission_directory',{p_task:taskId}).then(({data,error})=>{if(!active)return;if(error)notify('공개 제출 현황을 불러오지 못했습니다.');else setRows(data??[]);});return ()=>{active=false;};},[mode,taskId,state.submissions,notify]);
 const entries=mode==='supabase'?rows:(state.tasks.find(t=>t.id===taskId)?.targets??[]).map(classId=>{const record=state.submissions.find(s=>s.taskId===taskId&&s.classId===classId&&s.status!=='DRAFT');return {classId,status:record?.status??'NOT_SUBMITTED',submittedBy:record?state.members.find(m=>m.id===record.submittedBy)?.name??'탈퇴 회원':null,updatedBy:record?state.members.find(m=>m.id===record.updatedBy)?.name??'탈퇴 회원':null,updatedAt:record?.updatedAt??null};});
 return <section className="panel"><div className="panel-heading"><h2>학급별 공개 제출 현황</h2></div><p className="panel-padding muted">제출자·수정자·시각은 모든 회원이 볼 수 있습니다. 답변 내용은 공개하지 않습니다.</p><div className="table-scroll"><table><thead><tr><th>학급</th><th>제출 상태</th><th>최초 제출자</th><th>최근 수정자</th><th>최근 수정 시각</th></tr></thead><tbody>{entries.map(row=><tr key={row.classId}><td>{classLabel(row.classId)}</td><td><StatusBadge status={row.status}/></td><td>{row.submittedBy??'—'}</td><td>{row.updatedBy??'—'}</td><td>{row.updatedAt?dateTime(row.updatedAt):'—'}</td></tr>)}</tbody></table></div></section>;
}
