'use client';
import {useEffect,useState} from 'react';
import type {Post} from '@/lib/domain';
import {level} from '@/lib/domain';
import {dateTime} from '@/lib/utils';
import {supabase} from '@/lib/supabase/browser';
import {useDemo} from './demo-provider';
import {Button} from './ui/button';

export function PostRejection({post}:{post:Post}){
 const {mode,member,reviewRevision}=useDemo();const [reload,setReload]=useState(0);
 const [result,setResult]=useState<{postId:string;viewerId:string;data:Post['rejection']}|null>(null);
 const [failed,setFailed]=useState(false);const [loading,setLoading]=useState(false);
 const authorized=post.authorId===member?.id||level(member)>=3;
 useEffect(()=>{
  setResult(null);setFailed(false);setLoading(false);
  if(mode!=='supabase'||!authorized||post.status!=='REJECTED'||!member)return;
  let active=true;setLoading(true);
  void supabase!.rpc('post_rejection_info',{p_post:post.id}).then(({data,error})=>{
   if(!active)return;setLoading(false);if(error)setFailed(true);else setResult({postId:post.id,viewerId:member.id,data:data??undefined});
  });return ()=>{active=false;};
 },[mode,authorized,post.id,post.status,post.reason,member?.id,reviewRevision,reload]);
 if(post.status!=='REJECTED'||!authorized)return null;
 const info=mode==='demo'?post.rejection:result?.postId===post.id&&result.viewerId===member?.id?result.data:undefined;
 return <div className="info-box warning" role="note" aria-label="게시글 반려 안내"><div>
  <strong>반려된 게시글입니다.</strong>
  <p>반려한 운영진: {info?.reviewer??(loading?'확인 중…':failed?'조회하지 못했습니다.':'과거 기록의 처리자 정보가 없습니다.')}</p>
  {info?.date&&<p>처리 시각: <time dateTime={info.date}>{dateTime(info.date)}</time></p>}
  <p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>반려 사유: {info?.reason??post.reason??'등록된 사유가 없습니다.'}</p>
  <p>내용을 수정하거나 운영진에게 재검토를 요청할 수 있습니다. 다른 검토 운영진이 다시 판단해 공개할 수 있습니다.</p>
  {failed&&<Button type="button" size="sm" variant="outline" onClick={()=>setReload(n=>n+1)}>반려 정보 다시 확인</Button>}
 </div></div>;
}
