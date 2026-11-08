import { describe, expect, it } from 'vitest';
import { canManageTask, canReadSuggestion, level, ROLE_INFO, submitForClass, taskStats, validateAnswers } from '@/lib/domain';
import { createSeed } from '@/lib/seed';
const now = '2026-11-08T12:00:00+09:00';
const answers = { name: '우리 반 놀이터', plan: '퀴즈와 보드게임 부스', count: '12' };
describe('five permission levels', () => {
  it('maps PR and the executive to the same fourth level', () => {
    expect(new Set(Object.values(ROLE_INFO).map(r => r.level)).size).toBe(5);
    expect(ROLE_INFO.PR_DIRECTOR.level).toBe(4);
  });
  it('does not activate a pending student', () => { const s = createSeed(); expect(level(s.members.find(m => m.id === 'pending-student'))).toBe(0); });
});
describe('class submissions', () => {
  it('rejects an ordinary student and an executive', () => { const s = createSeed(); for (const id of ['student', 'executive']) expect(() => submitForClass(s, s.members.find(m => m.id === id)!, 'festival', answers, 0, false, now)).toThrow('학급 대표'); });
  it('derives the class from the account', () => { const s = createSeed(); const m = s.members.find(m => m.id === 'president')!; expect(submitForClass(s, m, 'festival', { ...answers, classId: '3-6' }, 0, false, now).classId).toBe('2-3'); });
  it('rejects a representative outside the targeted classes', () => { const s = createSeed(); s.tasks[0] = { ...s.tasks[0], targets: ['1-1'] }; expect(() => submitForClass(s, s.members.find(m => m.id === 'president')!, 'festival', answers, 0, false, now)).toThrow('본인 학급'); });
  it('shares one submission between the president and vice president and records both actors', () => { const s = createSeed(); const first = submitForClass(s, s.members.find(m => m.id === 'president')!, 'festival', answers, 0, false, now); s.submissions.push(first); const next = submitForClass(s, s.members.find(m => m.id === 'vice')!, 'festival', { ...answers, count: '15' }, 1, false, now); expect(next.classId).toBe(first.classId); expect(next.submittedBy).toBe('president'); expect(next.updatedBy).toBe('vice'); expect(next.version).toBe(2); expect(next.history).toHaveLength(2); });
  it('detects stale versions', () => { const s = createSeed(); s.submissions.push(submitForClass(s, s.members[1], 'festival', answers, 0, false, now)); expect(() => submitForClass(s, s.members[2], 'festival', answers, 0, false, now)).toThrow('다른 대표'); });
  it('allows incomplete drafts but validates final submissions', () => { const s = createSeed(); expect(submitForClass(s, s.members[1], 'festival', {}, 0, true, now).status).toBe('DRAFT'); expect(() => submitForClass(s, s.members[1], 'festival', {}, 0, false, now)).toThrow('입력'); });
  it('transitions a revision request to resubmitted', () => { const s = createSeed(); s.submissions.push({ ...submitForClass(s, s.members[1], 'festival', answers, 0, false, now), status: 'REVISION_REQUESTED' }); expect(submitForClass(s, s.members[2], 'festival', answers, 1, false, now).status).toBe('SUBMITTED'); });
  it('preserves resubmission status after saving a revision as a draft', () => { const s = createSeed(); s.submissions.push({ ...submitForClass(s, s.members[1], 'festival', answers, 0, false, now), status: 'REVISION_REQUESTED', feedback: '운영 시간 보완 요청' }); const draft = submitForClass(s, s.members[2], 'festival', answers, 1, true, now); s.submissions = [draft]; expect(submitForClass(s, s.members[1], 'festival', answers, 2, false, now).status).toBe('SUBMITTED'); });
  it('blocks accepted submissions and expired tasks, with time zone offsets', () => { const s = createSeed(); s.submissions.push({ ...submitForClass(s, s.members[1], 'festival', answers, 0, false, now), status: 'ACCEPTED' }); expect(submitForClass(s, s.members[1], 'festival', answers, 1, false, now).version).toBe(2); s.submissions = []; expect(() => submitForClass(s, s.members[1], 'festival', answers, 0, false, '2026-11-13T15:00:00Z')).toThrow('기간'); });
  it('calculates a zero-target rate without dividing by zero', () => { const s = createSeed(); expect(taskStats({ ...s.tasks[0], targets: [] }, s.submissions).rate).toBe(0); expect(taskStats(s.tasks[0], s.submissions)).toEqual({ total: 18, complete: 14, revision: 0, missing: 4, rate: 78 }); });
  it('validates numbers and allowed choices', () => { const s = createSeed(); expect(() => validateAnswers(s.tasks[0], { ...answers, count: '-1' })).toThrow(); expect(() => validateAnswers(s.tasks[0], { ...answers, count: '1.5' })).toThrow(); expect(() => validateAnswers(s.tasks[2], { sports: '없는 종목' })).toThrow(); });
});
describe('private assignments', () => {
  it('limits private suggestions to the owner and operating council or teacher', () => { const s = createSeed(); const item = s.suggestions[0]; expect(canReadSuggestion(s.members.find(m => m.id === 'executive'), item)).toBe(true); expect(canReadSuggestion(s.members.find(m => m.id === 'officer'), item)).toBe(true); expect(canReadSuggestion(s.members.find(m => m.id === 'student'), item)).toBe(true); expect(canReadSuggestion(s.members.find(m => m.id === 'teacher'), item)).toBe(true);expect(canReadSuggestion(s.members.find(m=>m.id==='president'),item)).toBe(false); });
  it('limits level 3 to assigned tasks', () => { const s = createSeed(); const officer = s.members.find(m => m.id === 'officer'); expect(canManageTask(officer, s.tasks[0])).toBe(true); expect(canManageTask(officer, s.tasks[2])).toBe(false); });
});
