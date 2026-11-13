'use client';
import {useEffect,useState} from 'react';
import {useDemo} from './demo-provider';
import {level} from '@/lib/domain';
import {viewDate} from '@/lib/post-views';
import {supabase} from '@/lib/supabase/browser';
import {recordDemoSiteVisit,summarizeSiteVisits,type SiteVisitStats} from '@/lib/site-visits';
import styles from './site-visits.module.css';

export function SiteVisits(){
 const {member,state,mode,commit}=useDemo();const activeLevel=level(member);
 const [remote,setRemote]=useState<{viewerId:string;stats:SiteVisitStats}|null>(null);
 const [failed,setFailed]=useState(false);const [loading,setLoading]=useState(false);const [reload,setReload]=useState(0);
 useEffect(()=>{
  if(!member||!activeLevel)return;
  let active=true,inFlight=false,lastSuccess=0,lastDate='';
  async function load(){
   if(!active||inFlight||document.hidden)return;
   const date=viewDate();if(date===lastDate&&Date.now()-lastSuccess<300000)return;
   inFlight=true;setLoading(true);setFailed(false);
   try{
    if(mode==='supabase'){
     const {data,error}=await supabase!.rpc('record_site_visit');if(error)throw error;
     if(active)setRemote({viewerId:member!.id,stats:data as SiteVisitStats});
    }else if(mode==='demo'){
     await commit((s,m)=>({...s,demoSiteVisits:recordDemoSiteVisit(s.demoSiteVisits,m.id,date)}));
    }
    lastDate=date;lastSuccess=Date.now();
   }catch{if(active)setFailed(true);}finally{inFlight=false;if(active)setLoading(false);}
  }
  void load();const timer=setInterval(()=>void load(),60000);
  const resume=()=>{if(!document.hidden)void load();};
  document.addEventListener('visibilitychange',resume);window.addEventListener('focus',resume);
  return ()=>{active=false;clearInterval(timer);document.removeEventListener('visibilitychange',resume);window.removeEventListener('focus',resume);};
 },[member?.id,activeLevel,mode,commit,reload]);
 if(!activeLevel)return null;
 const stats=mode==='demo'?summarizeSiteVisits(state.demoSiteVisits,viewDate()):remote&&remote.viewerId===member?.id?remote.stats:null;
 return <section className={`panel ${styles.panel}`} aria-label="사이트 방문 통계">
  <div className={styles.heading}><h2>방문 통계</h2><button type="button" disabled={loading} onClick={()=>setReload(n=>n+1)}>방문 통계 새로고침</button></div>
  <dl>{(['오늘 방문자 수','하루 최대 방문자 수','누적 방문 수'] as const).map((label,index)=><div key={label}><dt>{label}</dt><dd>{stats?[stats.today,stats.peak,stats.total][index].toLocaleString('ko-KR'):'—'}</dd></div>)}</dl>
  <p>한국 시간 기준 · 로그인 계정당 하루 1회 · 누적은 날짜별 방문자 수의 합계</p>
  {failed&&<p className="field-error">방문 통계를 불러오지 못했습니다. 새로고침을 눌러 다시 확인해 주세요.</p>}
 </section>;
}
