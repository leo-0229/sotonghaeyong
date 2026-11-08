import {localModeration,publicationStatus} from './moderation.ts';

// Run on the trusted server before storage. No external AI request or API key.
export function reviewContent(title:string,content:string,memberNames:string[]=[]){
 const reasons=localModeration(title,content,memberNames);
 const status=publicationStatus(reasons);
 return {status,reasons,rulesVerified:status==='APPROVED'};
}
