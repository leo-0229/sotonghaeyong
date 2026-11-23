'use client';

import {useEffect,useState} from 'react';
import {useDemo,runAction} from './demo-provider';
import {Button} from './ui/button';

export function ConnectionStatus(){
  const [offline,setOffline]=useState(false);
  useEffect(()=>{
    const update=()=>setOffline(!navigator.onLine);
    update();window.addEventListener('online',update);window.addEventListener('offline',update);
    return ()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update);};
  },[]);
  return offline?<div className="connection-notice" role="status">인터넷 연결이 끊겼습니다. 입력한 내용은 그대로 두고, 연결된 뒤 다시 저장해 주세요.</div>:null;
}

export function DataLoadError(){
  const {syncError,refreshData,switchMember,notify}=useDemo();
  const [retrying,setRetrying]=useState(false);
  return <section className="panel access-denied" role="alert"><h1>자료를 불러오지 못했어요</h1><p>{syncError}</p><div className="form-actions"><Button disabled={retrying} onClick={()=>{if(retrying)return;setRetrying(true);void runAction(async()=>{try{await refreshData();}finally{setRetrying(false);}},notify);}}>{retrying?'다시 연결 중…':'다시 불러오기'}</Button><Button variant="outline" disabled={retrying} onClick={()=>void runAction(()=>switchMember(null),notify)}>로그아웃</Button></div></section>;
}
