'use client';
import {useEffect,useState} from 'react';
import {useDemo,runAction} from './demo-provider';
import {supabase} from '@/lib/supabase/browser';
import {Button} from './ui/button';
type ContactState={ownShared:boolean;partnerShared:boolean;ownPhone:string|null;partnerPhone:string|null};
const format=(phone:string)=>phone.length===11?phone.slice(0,3)+'-'+phone.slice(3,7)+'-'+phone.slice(7):phone;
export function MentoringContact({partnerName}:{partnerName:string}){
 const {mode,notify}=useDemo();const [state,setState]=useState<ContactState|null>(null);const [working,setWorking]=useState(false);
 useEffect(()=>{if(mode!=='supabase')return;let active=true;async function load(){if(document.hidden)return;const {data,error}=await supabase!.functions.invoke('account-access',{body:{operation:'mentor-contact'}});if(active){if(error)setState(null);else setState(data);}}void load();const timer=setInterval(()=>void load(),15000);const hide=()=>{if(document.hidden)setState(null);else void load();};document.addEventListener('visibilitychange',hide);return ()=>{active=false;clearInterval(timer);document.removeEventListener('visibilitychange',hide);};},[mode]);
 if(mode!=='supabase')return <p className="muted">실제 연락처 교환은 운영 서버에서만 가능합니다. 체험 화면에는 전화번호를 입력하지 마세요.</p>;
 async function request(body:Record<string,unknown>){const {data,error}=await supabase!.functions.invoke('account-access',{body});if(error)throw Error('연락처 공유 요청을 처리하지 못했습니다. 매칭 상태와 번호를 확인하세요.');setState(data);}
 return <section><h3>{partnerName}님과 연락처 교환</h3><p>매칭된 두 사람이 각각 동의하면 서로의 번호만 볼 수 있습니다. 학생회나 다른 회원에게는 번호가 표시되지 않습니다.</p>{state?.partnerPhone?<div className="info-box"><div><strong>상대 전화번호</strong><p><a href={'tel:'+state.partnerPhone}>{format(state.partnerPhone)}</a></p></div></div>:<p className="muted">{state?.partnerShared?'상대가 공유에 동의했습니다. 나도 동의하면 번호가 표시됩니다.':'상대의 공유 동의를 기다리고 있습니다.'}</p>}
  {state?.ownShared?<div><p>내 번호: {state.ownPhone?format(state.ownPhone):'공유 중'}</p><Button type="button" variant="outline" size="sm" disabled={working} onClick={()=>{setWorking(true);setState(null);void runAction(async()=>{try{await request({operation:'mentor-contact-revoke'});notify('연락처 공유를 취소했습니다.');}finally{setWorking(false);}},notify);}}>내 연락처 공유 취소</Button></div>:<form onSubmit={e=>{e.preventDefault();if(working)return;const form=e.currentTarget,data=new FormData(form);setWorking(true);void runAction(async()=>{try{await request({operation:'mentor-contact-share',phone:String(data.get('phone')),consent:data.has('consent')});form.reset();notify('매칭 상대에게 연락처 공유에 동의했습니다.');}finally{setWorking(false);}},notify);}}><label>내 휴대전화 번호<input type="tel" name="phone" autoComplete="off" required inputMode="tel" maxLength={16} placeholder="010-0000-0000"/></label><label className="checkbox-label"><input type="checkbox" name="consent" required/>매칭된 상대에게 내 전화번호를 공유하는 데 동의합니다.</label><Button disabled={working}>연락처 공유 동의</Button></form>}
 </section>;
}
