import {localModeration,publicationStatus} from './moderation.ts';

// Run on the trusted server before storage. No external AI request or API key.
export function reviewContent(title:string,content:string){
 const reasons=localModeration(title,content);
 const status=publicationStatus(reasons);
 return {status,reasons,rulesVerified:status==='APPROVED'};
}
