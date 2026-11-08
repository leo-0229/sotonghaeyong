// Shared by local preview and server. A rule pass is never an AI approval.
export interface ModerationDecision { safe: boolean; reasons: string[]; uncertain: boolean }
export function localModeration(title: string, content: string, teacherNames: string[] = []): string[] {
  const text = `${title}\n${content}`.normalize('NFC').replace(/[\u200b-\u200f\ufeff]/g, '');
  const compact = text.replace(/[\s._*-]/g, '');
  const reasons: string[] = [];
  if (/(?:씨\s*발|시\s*발|병\s*신|개\s*새\s*끼|좆|지\s*랄|fuck|shit|bitch)/iu.test(text) || /(?:시발|씨발|병신|개새끼|ㅅㅂ|ㅂㅅ)/u.test(compact)) reasons.push('욕설 의심 표현');
  if (/(?:https?\s*:|www\s*\.|(?:[a-z\d가-힣-]+\s*[.。]\s*)+[a-z]{2,63}(?:\b|\/))/iu.test(text)) reasons.push('외부 사이트 링크');
  if (teacherNames.some(name => name.trim().length >= 2 && compact.includes(name.replace(/\s/g, ''))) || /[가-힣]{2,4}\s*(?:선생님|쌤|선생)/u.test(text)) reasons.push('교사 성함 또는 교사 지칭 확인 필요');
  const runs = text.match(/[ㄱ-ㅎㅏ-ㅣ\u1100-\u11ff]+/gu) ?? [];
  if (runs.some(run => !/^(?:ㅋ+|ㅎ+|ㄷ{2,}|ㅠ+|ㅜ+|[ㅋㅎㅠㅜ]{2,})$/u.test(run))) reasons.push('허용 목록에 없는 초성·자모 표현');
  if (/(?:죽어|꺼져|못생겼|멍청|왕따|쓰레기\s*(?:같|새끼)|한심|혐오)/u.test(text)) reasons.push('타인 비방 의심 표현');
  return [...new Set(reasons)];
}
export function publicationStatus(_ruleReasons: string[], _ai: ModerationDecision | null): 'PENDING' {
  // Pilot policy: only an independent human reviewer can make a post public.
  return 'PENDING';
}
