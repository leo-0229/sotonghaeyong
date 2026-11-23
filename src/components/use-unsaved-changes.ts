'use client';
import {useEffect} from 'react';

export function useUnsavedChanges(dirty:boolean){
  useEffect(()=>{
    if(!dirty)return;
    const confirm=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
    window.addEventListener('beforeunload',confirm);
    return ()=>window.removeEventListener('beforeunload',confirm);
  },[dirty]);
}
