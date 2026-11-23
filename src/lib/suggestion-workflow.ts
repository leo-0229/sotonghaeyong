export const HANDLING_STATUS={RECEIVED:'접수 완료',REVIEWING:'검토 중',ASSIGNED:'담당자 전달',RESOLVED:'처리 완료',REJECTED:'반려'} as const;
export type HandlingStatus=keyof typeof HANDLING_STATUS;
export interface SuggestionWorkflowData{
  status:HandlingStatus;version:string|null;handlerId?:string|null;handler?:string|null;dueOn?:string|null;
  history:{id:number|string;status:HandlingStatus;actor:string;note?:string|null;date:string}[];
}
export function handlingCode(status:string):HandlingStatus{
  return (Object.entries(HANDLING_STATUS).find(([,label])=>label===status)?.[0]??'RECEIVED') as HandlingStatus;
}
