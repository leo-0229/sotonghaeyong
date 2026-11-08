export const LOGIN_DOMAIN='accounts.mpms.invalid';
export function normalizeLoginId(value:string){return value.trim().toLowerCase();}
export function authEmail(value:string){return `${normalizeLoginId(value)}@${LOGIN_DOMAIN}`;}
export function parseStudentId(value:string){
 const match=/^([1-3])0?([1-6])(\d{2})$/.exec(value.trim());
 if(!match||Number(match[3])<1)throw new Error('학번은 20315 또는 2315처럼 학년·반·두 자리 번호로 입력해 주세요.');
 return {studentId:`${match[1]}0${match[2]}${match[3]}`,classId:`${match[1]}-${match[2]}`,grade:Number(match[1]),room:Number(match[2]),number:Number(match[3])};
}
export function validateCredentials(oldId:string,newId:string,currentPassword:string,newPassword:string){
 const id=normalizeLoginId(newId);
 if(!/^[a-z][a-z0-9_]{3,23}$/.test(id)||id.startsWith('tmp_'))throw new Error('새 아이디는 영문 소문자로 시작하는 4~24자 영문·숫자·밑줄로 입력하세요. tmp_는 임시 계정 전용입니다.');
 if(id===normalizeLoginId(oldId))throw new Error('임시 아이디와 다른 새 아이디를 입력해 주세요.');
 if(!currentPassword)throw new Error('현재 비밀번호를 입력해 주세요.');
 if(newPassword.length<12||newPassword.length>128)throw new Error('새 비밀번호는 12~128자로 입력해 주세요.');
 if(newPassword===currentPassword)throw new Error('기존 비밀번호와 다른 비밀번호를 사용해 주세요.');
 return id;
}
export function temporaryCredentials(){
 const bytes=crypto.getRandomValues(new Uint8Array(20));const hex=Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');
 return {loginId:`tmp_${hex.slice(0,16)}`,password:`Aa1!${hex.slice(16)}`};
}
