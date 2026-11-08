import {ABUSIVE_TERMS,SEXUAL_TERMS,ABUSIVE_INITIALS} from './content-rules.ts';

export interface ModerationDecision { safe: boolean; reasons: string[]; uncertain: boolean }
const CHO='ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const JUNG='ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const JONG=['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const KEYS:Record<string,string>={r:'ㄱ',R:'ㄲ',s:'ㄴ',e:'ㄷ',E:'ㄸ',f:'ㄹ',a:'ㅁ',q:'ㅂ',Q:'ㅃ',t:'ㅅ',T:'ㅆ',d:'ㅇ',w:'ㅈ',W:'ㅉ',c:'ㅊ',z:'ㅋ',x:'ㅌ',v:'ㅍ',g:'ㅎ',k:'ㅏ',o:'ㅐ',i:'ㅑ',O:'ㅒ',j:'ㅓ',p:'ㅔ',u:'ㅕ',P:'ㅖ',h:'ㅗ',y:'ㅛ',n:'ㅜ',b:'ㅠ',m:'ㅡ',l:'ㅣ'};
const SPLIT:Record<string,string>={'ㄳ':'ㄱㅅ','ㄵ':'ㄴㅈ','ㄶ':'ㄴㅎ','ㄺ':'ㄹㄱ','ㄻ':'ㄹㅁ','ㄼ':'ㄹㅂ','ㄽ':'ㄹㅅ','ㄾ':'ㄹㅌ','ㄿ':'ㄹㅍ','ㅀ':'ㄹㅎ','ㅄ':'ㅂㅅ','ㅘ':'ㅗㅏ','ㅙ':'ㅗㅐ','ㅚ':'ㅗㅣ','ㅝ':'ㅜㅓ','ㅞ':'ㅜㅔ','ㅟ':'ㅜㅣ','ㅢ':'ㅡㅣ'};

function jamo(value:string,keyboard=false){
 let out='';
 for(const character of [...value].map(c=>SPLIT[c]??c).join('').normalize('NFKC')){
  const n=character.codePointAt(0)!;
  if(n>=0xac00&&n<=0xd7a3){const index=n-0xac00;out+=CHO[Math.floor(index/588)]+JUNG[Math.floor(index/28)%21]+JONG[index%28];}
  else if(n>=0x1100&&n<=0x1112)out+=CHO[n-0x1100];
  else if(n>=0x1161&&n<=0x1175)out+=JUNG[n-0x1161];
  else if(n>=0x11a8&&n<=0x11c2)out+=JONG[n-0x11a7];
  else if(/[ㄱ-ㅎㅏ-ㅣ]/u.test(character))out+=character;
  else if(keyboard)out+=KEYS[character]??KEYS[character.toLowerCase()]??'';
 }
 return [...out].map(c=>SPLIT[c]??c).join('').replace(/(.)\1{2,}/gu,'$1');
}
const profanity=ABUSIVE_TERMS.map(term=>jamo(term)).filter(Boolean);
const sexual=SEXUAL_TERMS.map(term=>jamo(term)).filter(Boolean);
const initials=ABUSIVE_INITIALS.map(term=>jamo(term)).filter(Boolean);
const allowedInitials=new Set(['ㄱㅅ','ㄱㄱ','ㄴㄴ','ㅇㅇ','ㅇㅋ','ㅇㅈ','ㅊㅋ','ㅊㅊ','ㅈㅅ','ㄹㅇ','ㅎㅇ','ㅂㅂ','ㅂㅇ'].map(term=>jamo(term)));

export function localModeration(title:string,content:string,_teacherNames:string[]=[]):string[]{
 // Do not concatenate title and body: syllables across separate fields are not a word.
 const fields=[title,content].map(field=>field.normalize('NFKC').replace(/[\p{Cf}\uFE00-\uFE0F]/gu,''));
 const reasons:string[]=[];
 const normalized=fields.map(field=>field
  .replace(/시발점/gu,'출발점')
  .replace(/(?:잠)?자지(?=\s*(?:않|못|마))/gu,'쉬지')
  .replace(/보지(?=\s*(?:않|못|마))/gu,'살피지')
  .replace(/정자(?=동|역|\s*(?:에서|에)\s*(?:쉬|앉))/gu,'쉼터'));
 const versions=normalized.flatMap(field=>[jamo(field),jamo(field,true)]);
 const text=fields.join('\n');
 const rawRuns=(title+'\n'+content).normalize('NFC').match(/[ㄱ-ㅎㅏ-ㅣ\u1100-\u11ff]+/gu)??[];
 if(versions.some(value=>profanity.some(term=>value.includes(term)))||rawRuns.some(run=>initials.some(term=>jamo(run).includes(term)))||/(?:^|[^a-z])(?:f[\W\d_]*u[\W\d_]*c[\W\d_]*k(?:ing|er|you)?|s[\W\d_]*h[\W\d_]*i[\W\d_]*t|bitch|asshole|motherfucker|cunt|slut|whore|retard(?:ed)?|nigg(?:er|a)|faggot)(?=$|[^a-z])/iu.test(text))reasons.push('욕설·혐오 의심 표현');
 if(versions.some(value=>sexual.some(term=>value.includes(term)))||/(?:^|[^a-z])(?:s[\W\d_]*e[\W\d_]*x|p[\W\d_]*o[\W\d_]*r[\W\d_]*n(?:ography)?|hentai|penis|vagina|masturbat\w*|blowjob|pussy|dick|nudes?)(?=$|[^a-z])/iu.test(text))reasons.push('성적·성 관련 민감 표현');
 if(/(?:https?\s*:|www\s*\.|(?:[a-z\d가-힣-]+\s*[.。]\s*)+[a-z]{2,63}(?:\b|\/))/iu.test(text))reasons.push('외부 사이트 링크');
 if(/01[016789][\s-]?\d{3,4}[\s-]?\d{4}/u.test(text))reasons.push('연락처 등 개인정보 확인 필요');
 // Common short abbreviations and laughter/crying/emphasis are allowed.
 const runs=rawRuns;
 if(runs.some(run=>{const value=jamo(run);return value.length>=5&&!/^[ㅋㅎㄷㅠㅜ]+$/u.test(value)&&!allowedInitials.has(value)&&new Set(value).size>=3;}))reasons.push('긴 초성 표현 확인 필요');
 if(/(?:너(?:는|희)?|너네|니네|쟤|걔|이|저)\s*(?:새끼|놈|년|돼지|고아)|(?:죽어|못생겼|멍청|왕따\s*시키|쓰레기\s*(?:같|새끼)|한심)/u.test(text))reasons.push('타인 비방 의심 표현');
 return [...new Set(reasons)];
}
export function publicationStatus(ruleReasons:string[],ai:ModerationDecision|null):'PENDING'|'APPROVED'{
 return ruleReasons.length===0&&ai?.safe===true&&ai.uncertain===false&&ai.reasons.length===0?'APPROVED':'PENDING';
}
