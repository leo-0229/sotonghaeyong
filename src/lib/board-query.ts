import {BOARDS} from './domain';

export function readBoardQuery(params:URLSearchParams){
  const rawPage=Number(params.get('page'));
  return {
    q:(params.get('q')??'').slice(0,200),
    sort:params.get('sort')==='views'?'views':'latest',
    prefix:params.get('prefix')??'all',
    board:BOARDS.some(board=>board.id===params.get('board'))?params.get('board')!:'all',
    page:Number.isSafeInteger(rawPage)&&rawPage>0?rawPage:1,
  };
}

export function boardQuery(value:ReturnType<typeof readBoardQuery>){
  const params=new URLSearchParams();
  if(value.q.trim())params.set('q',value.q.trim().slice(0,200));
  if(value.sort==='views')params.set('sort','views');
  if(value.prefix!=='all')params.set('prefix',value.prefix);
  if(value.board!=='all')params.set('board',value.board);
  if(value.page>1)params.set('page',String(value.page));
  return params.size?'?'+params.toString():'';
}

export function pageWindow(current:number,pages:number){
  const first=Math.max(1,Math.min(current-2,pages-4));
  return Array.from({length:Math.min(5,pages)},(_,index)=>first+index);
}
