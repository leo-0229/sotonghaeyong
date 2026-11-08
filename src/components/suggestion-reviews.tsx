'use client';
import {useEffect,useState} from 'react';
import {useDemo,runAction} from './demo-provider';
import {supabase} from '@/lib/supabase/browser';
import {level} from '@/lib/domain';
import {Button} from './ui/button';
import {dateTime} from '@/lib/utils';
type Review={kind:'suggestion'|'suggestion-reply';id:string;title:string;content:string;authorId:string;author:string;date:string;reasons?:string[]};
export function SuggestionReviews(){
 const {member,state,mode,reviewSuggestionContent,notify}=useDemo();const [rows,setRows]=useState<Review[]>([]);const [revision,setRevision]=useState(0);
 useEffect(()=>{if(mode!=='supabase'||level(member)<3)return;let active=true;void supabase!.rpc('pending_suggestion_reviews').then(({data,error})=>{if(!active)return;if(error)notify('건의함 검토 목록을 불러오지 못했습니다.');else setRows(data??[]);});return ()=>{active=false;};},[mode,member,revision,notify]);
 if(level(member)<3)return null;
 const reviews:Review[]=mode==='supabase'?rows:state.suggestions.flatMap(s=>[...(s.visibility==='PUBLIC'&&s.publicationStatus==='PENDING'?[{kind:'suggestion' as const,id:s.id,title:s.title,content:s.content,authorId:s.authorId,author:state.members.find(m=>m.id===s.authorId)?.name??'',date:s.date,reasons:s.moderationReasons}]:[]),...(s.replies??[]).filter(r=>r.status==='PENDING').map(r=>({...r,kind:'suggestion-reply' as const,title:s.title+' · 답변'}))]);
 return <section className="panel form-panel"><h2>건의함 · 답변 검토 대기</h2><Button size="sm" variant="outline" onClick={()=>setRevision(v=>v+1)}>목록 새로고침</Button>{reviews.map(row=><article className="post-review" key={row.id}><h3>{row.title}</h3><p className="muted">{row.author} · {dateTime(row.date)}</p><p className="article-body">{row.content}</p>{!!row.reasons?.length&&<p>{row.reasons.join(' · ')}</p>}<div className="form-actions"><Button size="sm" variant="outline" disabled={row.authorId===member?.id} onClick={()=>void runAction(async()=>{await reviewSuggestionContent(row.kind,row.id,false);setRevision(v=>v+1);},notify)}>반려</Button><Button size="sm" disabled={row.authorId===member?.id} onClick={()=>void runAction(async()=>{await reviewSuggestionContent(row.kind,row.id,true);setRevision(v=>v+1);},notify)}>승인</Button></div></article>)}{!reviews.length&&<p className="muted">검토 대기 중인 건의·답변이 없습니다.</p>}</section>;
}
