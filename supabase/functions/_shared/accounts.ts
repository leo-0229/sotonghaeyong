export const LOGIN_DOMAIN='accounts.mpms.invalid';
export function normalizeLoginId(value:string){return value.trim().toLowerCase();}
export function authEmail(value:string){return `${normalizeLoginId(value)}@${LOGIN_DOMAIN}`;}
export function parseStudentId(value:string){
 const match=/^([1-3])(0[1-9]|[12]\d|30)(0[1-9]|[1-9]\d)$/.exec(value.trim());
 if(!match)throw new Error('학번은 21421처럼 학년 1자리·반 2자리·번호 2자리로 입력해 주세요.');
 return {studentId:value.trim(),classId:`${match[1]}-${Number(match[2])}`,grade:Number(match[1]),room:Number(match[2]),number:Number(match[3])};
}
export function validateCredentials(oldId:string,newId:string,currentPassword:string,newPassword:string){
 const id=normalizeLoginId(newId);
 if(!/^[a-z][a-z0-9_]{3,23}$/.test(id)||id.startsWith('tmp_'))throw new Error('새 아이디는 영문 소문자로 시작하는 4~24자 영문·숫자·밑줄로 입력하세요. tmp_는 임시 계정 전용입니다.');
 if(id===normalizeLoginId(oldId))throw new Error('임시 아이디와 다른 새 아이디를 입력해 주세요.');
 if(!currentPassword)throw new Error('현재 비밀번호를 입력해 주세요.');
 if(newPassword.length<8||newPassword.length>128)throw new Error('새 비밀번호는 8~128자로 입력해 주세요.');
 if(newPassword===currentPassword)throw new Error('기존 비밀번호와 다른 비밀번호를 사용해 주세요.');
 return id;
}
export function temporaryCredentials(){
 const bytes=crypto.getRandomValues(new Uint8Array(20));const hex=Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');
 const alphabet='abcdefghjkmnpqrstuvwxyz23456789';
 let password='';
 while(password.length<10){const values=crypto.getRandomValues(new Uint8Array(16));for(const value of values){if(value<alphabet.length*8&&password.length<10)password+=alphabet[value%alphabet.length];}}
 return {loginId:`tmp_${hex.slice(0,16)}`,password};
}
