'use client';
import Link from '@/components/navigation';
import { useRouter } from '@/components/navigation';
import { useState } from 'react';
import { BookOpen, CalendarDays, CheckCircle2, ChevronRight, GraduationCap, HeartHandshake, LockKeyhole, MapPin, MessageSquareText, Plus, Send, ShieldCheck, Sparkles, Users, Vote } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useDemo, runAction } from './demo-provider';
import { AccessDenied, EmptyState, PageHeading, StatusBadge } from './shared';
import { Button } from './ui/button';
import { canManage, canReadSuggestion, isTeacher, level, suggestionSchema } from '@/lib/domain';
import { cn, dateTime, shortDate } from '@/lib/utils';

export {EventsScreen} from './events-board';
export {SuggestionsScreen} from './suggestions-board';
export { PledgesScreen } from './pledges-screen';
export function SurveysScreen() {
  const { state, member, commit, notify } = useDemo(); const [choices, setChoices] = useState<Record<string, string>>({});
  return <><PageHeading eyebrow="학생 참여" title="설문조사" description="여러분의 선택이 학생회 활동에 반영됩니다."/>{state.surveys.map(survey => { const response = survey.responses[member?.id ?? '']; const count = Object.keys(survey.responses).length; const closed = +new Date() > +new Date(survey.deadline); return <section className="panel survey-card" key={survey.id}><span className="badge badge-blue">{closed ? '설문 종료' : '참여 중'}</span><h2>{survey.title}</h2><p>{survey.description}</p><div className="survey-meta"><span><CalendarDays size={14}/>{shortDate(survey.deadline)} 마감</span><span><Users size={14}/>{count}명 참여</span></div><form onSubmit={e => { e.preventDefault(); runAction(async () => { const choice = choices[survey.id]; if (!choice) throw new Error('한 가지 항목을 선택해 주세요.'); await commit((s, m) => { const current = s.surveys.find(v => v.id === survey.id); if (!current || !current.options.includes(choice) || +new Date() > +new Date(current.deadline)) throw new Error('설문에 응답할 수 없습니다.'); if (current.responses[m.id]) throw new Error('이미 응답한 설문입니다.'); return { ...s, surveys: s.surveys.map(v => v.id === survey.id ? { ...v, responses: { ...v.responses, [m.id]: choice } } : v) }; }); notify('설문에 참여해 주셔서 감사합니다.'); }, notify); }}><fieldset disabled={!!response || closed}>{survey.options.map(option => { const votes = Object.values(survey.responses).filter(v => v === option).length; return <label className={cn('survey-option', response === option && 'chosen')} key={option}><input type="radio" name={survey.id} value={option} checked={(response ?? choices[survey.id]) === option} onChange={() => setChoices(v => ({ ...v, [survey.id]: option }))}/><span>{option}</span>{response && <strong>{count ? Math.round(votes / count * 100) : 0}%</strong>}</label>; })}</fieldset><div className="form-actions">{response ? <span className="success-message"><CheckCircle2 size={16}/>참여 완료 · 내 선택: {response}</span> : <Button type="submit" disabled={closed}><Vote size={15}/>설문 참여</Button>}</div></form></section>; })}</>;
}
export { MentoringScreen } from './mentoring';
