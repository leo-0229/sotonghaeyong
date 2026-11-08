import {readFile,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const examples=new Set(['.env.example','.env.admin.example','supabase/functions/.env.example']);
export function privatePath(file){
 const p=file.replaceAll('\\','/');
 return !examples.has(p)&&(/(^|\/)(?:\.env[^/]*|private|backups|exports|credentials|\.git|\.aws)(\/|$)/i.test(p)||/\.(?:dump|bak|log|csv|xlsx|pem|key)$/i.test(p));
}
export function containsSecret(text){
 if(/(?<![a-zA-Z0-9_])(?:sb_secret_|sk-(?:proj-|svcacct-)?)[a-zA-Z0-9_-]{20,}/.test(text))return true;
 if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----(?:\s|\\[nr])+(?:[a-zA-Z0-9+/=]|\\[nr]|\s){40,}-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text))return true;
 for(const token of text.matchAll(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g)){
  try{if(JSON.parse(Buffer.from(token[0].split('.')[1],'base64url').toString()).role==='service_role')return true;}catch{}
 }
 return false;
}
export function validatePublicConfig(env){
 const url=env.NEXT_PUBLIC_SUPABASE_URL;const key=env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url&&!key)return; // A locked, unconfigured static preview is safe.
 if(!url||!key||!/^https:\/\/[^/]+\/?$/.test(url))throw new Error('Set a valid public Supabase URL and publishable key together.');
 if(key.startsWith('sb_publishable_')&&key.length>25)return;
 try{if(JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role==='anon')return;}catch{}
 throw new Error('The browser key must be publishable/anon. Never use a secret/service_role key.');
}
async function walk(dir,skipLocal=false){
 const skip=new Set(['node_modules','.next','.local','out','test-results','playwright-report','.git','.npm-cache','.codex','.agents']);
 const files=[];
 for(const entry of await readdir(dir,{withFileTypes:true})){
  if(skipLocal&&(skip.has(entry.name)||privatePath(entry.name)))continue;
  const file=path.join(dir,entry.name);
  if(entry.isDirectory())files.push(...await walk(file,skipLocal));
  else if(entry.isFile())files.push(file.replaceAll('\\','/').replace(/^\.\//,''));
 }
 return files;
}
async function main(){
 const output=process.argv.includes('--out');let files;
 if(output){files=await walk('out');}
 else{
  try{files=execFileSync('git',['ls-files','--cached','-z'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).split('\0').filter(Boolean);}
  catch{files=await walk('.',true);console.log('No Git index: checked shareable workspace files. Repeat after git add.');}
 }
 const failures=[];
 for(const file of files){
  const relative=output?file.replace(/^out\//,''):file;
  if(privatePath(relative)||(output&&/\.map$/.test(relative))){failures.push(file);continue;}
  if(containsSecret(await readFile(file,'utf8')))failures.push(file);
 }
 validatePublicConfig(process.env);
 if(failures.length){for(const file of failures)console.error(`Blocked private file or secret: ${file}`);process.exitCode=1;return;}
 console.log(`Release audit passed: ${files.length} ${output?'static output':'source'} files. Review personal data separately; pattern scans cannot identify all personal information.`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)void main().catch(()=>{console.error('Release audit could not finish. Check file access and public backend configuration.');process.exitCode=1;});
