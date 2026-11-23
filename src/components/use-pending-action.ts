'use client';

import {useRef,useState} from 'react';
import {useDemo,runAction} from './demo-provider';

// The ref closes the gap before React renders the disabled button.
export function usePendingAction(){
  const {notify}=useDemo();
  const lock=useRef(false);
  const [pending,setPending]=useState(false);
  const run=async(action:()=>Promise<unknown>)=>{
    if(lock.current)return;
    lock.current=true;setPending(true);
    try{await runAction(action,notify);}finally{lock.current=false;setPending(false);}
  };
  return {pending,run};
}
