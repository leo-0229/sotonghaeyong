'use client';
import Link from '@/components/navigation';
import { ArrowRight, ChevronRight, Inbox, LockKeyhole } from 'lucide-react';
import { Button } from './ui/button';
import { STATUS_LABELS } from '@/lib/domain';
import { cn } from '@/lib/utils';
export function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) { return <div className="page-heading"><div><div className="breadcrumb"><Link href="/">홈</Link><ChevronRight size={12}/><span>{eyebrow ?? title}</span></div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>; }
export function PanelHeading({ title, href, text = '더보기', count }: { title: string; href?: string; text?: string; count?: number }) { return <div className="panel-heading"><h2>{title}{count !== undefined && <span>{count}</span>}</h2>{href && <Link href={href}>{text}<ChevronRight size={14}/></Link>}</div>; }
export function StatusBadge({ status }: { status: string }) { return <span className={cn('badge', { 'badge-blue': ['SUBMITTED', 'RESUBMITTED', 'APPROVED', 'ACTIVE'].includes(status), 'badge-orange': ['PENDING', 'REVISION_REQUESTED', '검토 중', '접수 완료'].includes(status), 'badge-green': ['ACCEPTED', '처리 완료'].includes(status), 'badge-red': ['REJECTED', '반려'].includes(status) })}>{STATUS_LABELS[status] ?? status}</span>; }
export function EmptyState({ title = '아직 등록된 내용이 없어요', description = '새로운 소식이 올라오면 여기에 표시됩니다.', href, action }: { title?: string; description?: string; href?: string; action?: string }) { return <div className="empty-state"><Inbox size={32}/><h3>{title}</h3><p>{description}</p>{href && <Button asChild variant="outline"><Link href={href}>{action ?? '돌아가기'}<ArrowRight size={14}/></Link></Button>}</div>; }
export function AccessDenied({ description = '이 페이지를 이용할 수 있는 체험 계정으로 전환해 주세요.' }: { description?: string }) { return <section className="panel access-denied"><LockKeyhole size={36}/><h1>접근 권한을 확인해 주세요</h1><p>{description}</p><Button asChild><Link href="/login">체험 계정 선택</Link></Button></section>; }
