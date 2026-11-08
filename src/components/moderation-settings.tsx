'use client';
import { useState } from 'react';
import { isTeacher } from '@/lib/domain';
import { supabase } from '@/lib/supabase/browser';
import { AccessDenied, PageHeading } from './shared';
import { Button } from './ui/button';
import { useDemo, runAction } from './demo-provider';
export function ModerationSettings(){
 const {member,notify,mode}=useDemo();const [names,setNames]=useState('');
 if(!isTeacher(member))return <AccessDenied/>;
 return <><PageHeading eyebrow="교사 관리" title="게시글 검토 보조 설정" description="교사명 검사 명단은 일반 회원에게 공개하지 않습니다."/><section className="panel form-panel"><div className="info-box"><div><strong>모든 글은 운영진 승인 후 공개됩니다.</strong><p>규칙·AI 검사는 승인 담당자의 판단을 돕습니다. 안전 판정을 받아도 자동 공개되지 않습니다.</p></div></div><form onSubmit={e=>{e.preventDefault();void runAction(async()=>{if(!supabase)throw new Error('이 설정은 Supabase 운영 환경에서만 저장합니다.');const teacherNames=names.split(/[\n,]/).map(s=>s.trim()).filter(Boolean);if(!teacherNames.length||teacherNames.some(n=>n.length<2||n.length>30))throw new Error('교사 성함을 한 줄에 하나씩 입력해 주세요.');const {error}=await supabase.rpc('community_mutate',{p_operation:'moderation_settings',p_payload:{teacherNames}});if(error)throw new Error(error.message);setNames('');notify('교사명 검사 명단을 저장했습니다.');},notify);}}><label>검사할 교사 성함 명단<textarea rows={9} value={names} onChange={e=>setNames(e.target.value)} placeholder="실제 명단은 운영 서버 설정 후 입력해 주세요." required/></label><p className="muted">이 명단은 AI 요청에 포함하지 않으며 서버 규칙 검사에서만 사용합니다. AI 키와 모델은 Supabase Edge Function 비밀 설정에 등록합니다.</p><div className="form-actions"><Button disabled={mode!=='supabase'}>명단 교체 저장</Button></div></form></section></>;
}
