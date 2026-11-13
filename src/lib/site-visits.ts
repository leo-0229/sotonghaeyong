export interface SiteVisitStats {date:string;today:number;peak:number;total:number}
export interface SiteVisitLedger {receipts:Record<string,string>;days:Record<string,number>}

export function recordDemoSiteVisit(ledger:SiteVisitLedger|undefined,memberId:string,date:string):SiteVisitLedger {
 const current=ledger??{receipts:{},days:{}};
 if(current.receipts[memberId]&&current.receipts[memberId]>=date)return current;
 return {receipts:{...current.receipts,[memberId]:date},days:{...current.days,[date]:(current.days[date]??0)+1}};
}

export function summarizeSiteVisits(ledger:SiteVisitLedger|undefined,date:string):SiteVisitStats {
 const counts=Object.values(ledger?.days??{});
 return {date,today:ledger?.days[date]??0,peak:Math.max(0,...counts),total:counts.reduce((total,value)=>total+value,0)};
}
