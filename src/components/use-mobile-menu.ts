'use client';

import {useEffect,useRef} from 'react';

export function useMobileMenu(open:boolean,close:()=>void){
  const menu=useRef<HTMLElement>(null);
  const opener=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    if(!open||!menu.current)return;
    const panel=menu.current;
    const previousOverflow=document.body.style.overflow;
    const outside=[...document.querySelectorAll<HTMLElement>('.topbar,.demo-strip,.cafe-tabs,.main-content,.mobile-write')];
    const previousInert=outside.map(element=>element.inert);
    outside.forEach(element=>{element.inert=true;});
    document.body.style.overflow='hidden';
    const focusable=()=>[...panel.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),summary,input,select,textarea,[tabindex="0"]')].filter(element=>element.getClientRects().length>0);
    focusable()[0]?.focus();
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();close();return;}
      if(event.key!=='Tab')return;
      const elements=focusable(),first=elements[0],last=elements.at(-1);
      if(!first){event.preventDefault();return;}
      if(event.shiftKey&&(document.activeElement===first||!panel.contains(document.activeElement))){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&(document.activeElement===last||!panel.contains(document.activeElement))){event.preventDefault();first.focus();}
    };
    const onResize=()=>{if(window.innerWidth>760)close();};
    document.addEventListener('keydown',onKey);window.addEventListener('resize',onResize);
    return ()=>{
      document.removeEventListener('keydown',onKey);window.removeEventListener('resize',onResize);
      outside.forEach((element,index)=>{element.inert=previousInert[index];});
      document.body.style.overflow=previousOverflow;opener.current?.focus();
    };
  },[open,close]);
  return {menu,opener};
}
