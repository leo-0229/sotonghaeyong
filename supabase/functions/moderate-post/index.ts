import {createClient} from 'npm:@supabase/supabase-js@2.119.0';
import {reviewContent} from '../_shared/content-review.ts';
import {BOARD_PREFIXES} from '../_shared/boards.ts';
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin')??'';
 const allowed=(Deno.env.get('ALLOWED_ORIGINS')??'').split(',').map(s=>s.trim());
 if(!allowed.includes(origin))return new Response('Origin not allowed',{status:403});
 const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 try{
  const jwt=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');if(!jwt)return reply({error:'로그인이 필요합니다.'},401);
  const url=Deno.env.get('SUPABASE_URL')!;
  const caller=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:`Bearer ${jwt}`}},auth:{persistSession:false}});
  const {data:{user},error:authError}=await caller.auth.getUser(jwt);if(authError||!user)return reply({error:'로그인이 필요합니다.'},401);
  const {data:level,error:permissionError}=await caller.rpc('current_level');if(permissionError||!level)return reply({error:'로그인 정보 설정을 먼저 완료하세요.'},403);
  const raw=await req.text();if(new TextEncoder().encode(raw).length>40000)return reply({error:'요청이 너무 큽니다.'},413);
  const input=JSON.parse(raw);const kind=input.kind??'post';
  if(input.editId!=null&&(typeof input.editId!=='string'||(kind!=='post'&&(typeof input.expectedUpdatedAt!=='string'||!Number.isFinite(Date.parse(input.expectedUpdatedAt))))))return reply({error:'수정 대상과 수정 시각을 확인하세요.'},400);
  const title=kind==='comment'||kind==='suggestion-reply'?'':input.title;
  const content=input.content;
  const max=kind==='comment'?2000:kind==='suggestion-reply'?3000:kind==='suggestion'?5000:10000;
  const min=kind==='comment'?2:kind==='suggestion-reply'?5:10;
  if(!['post','comment','suggestion','suggestion-reply'].includes(kind)||typeof content!=='string'||content.trim().length<min||content.length>max||typeof title!=='string'||((kind==='post'||kind==='suggestion')&&(title.trim().length<2||title.length>100)))return reply({error:'제목과 내용을 확인하세요.'},400);
  if(kind==='suggestion-reply'&&!(level>=3&&level<=4))return reply({error:'학생회 임원만 건의에 답변할 수 있습니다.'},403);
  const board=input.board,prefix=kind==='post'&&board!=='music'?(input.prefix||BOARD_PREFIXES[board]?.[0]||''):'';
  if(kind==='post'&&(typeof board!=='string'||!BOARD_PREFIXES[board]||typeof prefix!=='string'||!BOARD_PREFIXES[board].includes(prefix)||(input.editId!=null&&typeof input.editId!=='string')||(input.draft!=null&&typeof input.draft!=='boolean')))return reply({error:'게시판과 말머리를 확인하세요.'},400);
  if(kind==='suggestion'&&(!['PUBLIC','PRIVATE'].includes(input.visibility)||typeof input.category!=='string'||input.category.length<1||input.category.length>50))return reply({error:'공개 범위와 건의 분야를 확인하세요.'},400);
  if(kind==='comment'&&(typeof input.postId!=='string'||(input.parentId!=null&&typeof input.parentId!=='string')))return reply({error:'댓글 대상을 확인하세요.'},400);
  if(kind==='suggestion-reply'&&typeof input.suggestionId!=='string')return reply({error:'답변 대상을 확인하세요.'},400);
  if(kind==='post'){
   if(['notice','council','report'].includes(board)&&level<4)return reply({error:'공식 게시판은 L4 이상만 작성할 수 있습니다.'},403);
   if(input.editId){const {data:old,error}=await caller.from('posts').select('id,status').eq('id',input.editId).eq('author_id',user.id).maybeSingle();if(error||!old||old.status==='HIDDEN')return reply({error:'본인 글만 수정할 수 있습니다.'},403);}
  }
  if(kind==='comment'){const {data:post,error}=await caller.from('posts').select('id').eq('id',input.postId).eq('status','APPROVED').maybeSingle();if(error||!post)return reply({error:'공개된 글에만 댓글을 작성할 수 있습니다.'},403);}
  const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  const {error:rate}=await admin.rpc('reserve_post_check',{p_user:user.id});if(rate)return reply({error:'요청이 많습니다. 잠시 후 다시 시도하세요.'},429);
  const draft=kind==='post'&&input.draft===true;
  const names=draft?{data:[],error:null}:await admin.rpc('moderation_member_names');
  const review=draft?{status:'DRAFT',reasons:[],rulesVerified:false}:names.error?{status:'PENDING',reasons:['회원 이름 확인 실패 · 운영진 확인 필요'],rulesVerified:false}:reviewContent([prefix,title].filter(Boolean).join(' '),content,names.data??[]);
  let result;
  if(input.editId&&kind!=='post')result=await admin.rpc('edit_moderated_content',{p_kind:kind,p_user:user.id,p_id:input.editId,p_content:content.trim(),p_status:review.status,p_reasons:review.reasons,p_rules_verified:review.rulesVerified,p_expected_updated_at:input.expectedUpdatedAt,p_title:kind==='suggestion'?title.trim():null,p_category:input.category??null,p_visibility:input.visibility??null});
  else if(kind==='post')result=await admin.rpc('store_moderated_post',{p_user:user.id,p_board:board,p_title:title.trim(),p_content:content.trim(),p_status:review.status,p_reasons:review.reasons,p_id:input.editId??null,p_prefix:prefix,p_rules_verified:review.rulesVerified});
  else if(kind==='comment')result=await admin.rpc('store_moderated_comment',{p_user:user.id,p_post:input.postId,p_content:content.trim(),p_parent:input.parentId??null,p_status:review.status,p_reasons:review.reasons,p_rules_verified:review.rulesVerified});
  else if(kind==='suggestion')result=await admin.rpc('store_moderated_suggestion',{p_user:user.id,p_title:title.trim(),p_category:input.category,p_content:content.trim(),p_visibility:input.visibility,p_status:review.status,p_reasons:review.reasons,p_rules_verified:review.rulesVerified});
  else result=await admin.rpc('store_moderated_suggestion_reply',{p_user:user.id,p_suggestion:input.suggestionId,p_content:content.trim(),p_status:review.status,p_reasons:review.reasons,p_rules_verified:review.rulesVerified});
  if(result.error)return reply({error:result.error.message.includes('EDIT_CONFLICT')?'다른 곳에서 내용이 바뀌었습니다. 새로고침 후 다시 수정하세요.':result.error.message.includes('PRIVATE_REPLIES_PROTECTED')?'답변이 달린 비공개 건의는 공개로 바꿀 수 없습니다. 새 공개 질문을 작성해 주세요.':'작성·수정 권한과 대상 글 상태를 확인하세요.'},400);
  return reply({id:result.data,status:review.status,reasons:review.reasons});
 }catch{return reply({error:'내용을 저장하지 못했습니다. 잠시 후 다시 시도하세요.'},500);}
});
