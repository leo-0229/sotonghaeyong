// The encryption key lives only in server secrets. Auth stores normal password hashes.
async function keyFromHex(secret:string){
 if(!/^[a-f0-9]{64}$/i.test(secret))throw new Error('Temporary credential encryption is not configured');
 return crypto.subtle.importKey('raw',Uint8Array.from(secret.match(/../g)!,v=>parseInt(v,16)),{name:'AES-GCM'},false,['encrypt','decrypt']);
}
export async function sealTemporaryPassword(secret:string,userId:string,password:string){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(userId)},await keyFromHex(secret),new TextEncoder().encode(password));
 return JSON.stringify({v:1,iv:Array.from(iv),data:Array.from(new Uint8Array(data))});
}
export async function openTemporaryPassword(secret:string,userId:string,sealed:string){
 const envelope=JSON.parse(sealed);
 if(envelope.v!==1)throw new Error('Unsupported temporary credential version');
 const data=await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(envelope.iv),additionalData:new TextEncoder().encode(userId)},await keyFromHex(secret),new Uint8Array(envelope.data));
 return new TextDecoder().decode(data);
}
