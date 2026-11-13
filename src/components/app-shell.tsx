'use client';
import sidebarStyles from './sidebar-groups.module.css';
import {SiteVisits} from './site-visits';

import Link from '@/components/navigation';
import { usePathname, useRouter } from '@/components/navigation';
import { useState } from 'react';
import { ArrowUpRight, KeyRound, Bell, BookOpen, CalendarDays, ChartNoAxesCombined, CheckCheck, ChevronDown, ChevronRight, ClipboardCheck, ClipboardList, FileText, GraduationCap, Home, LayoutDashboard, List, LogOut, Mail, Menu, MessageCircle, MessagesSquare, Megaphone, PenLine, Search, ShieldCheck, Users, Vote, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDemo, runAction } from './demo-provider';
import { canManageTask, classLabel, level, ROLE_INFO } from '@/lib/domain';
import { cn } from '@/lib/utils';

const groups: {title:string;min?:number;items:[string,string,LucideIcon,string?][]}[]=[
 {title:'학교 소식',items:[['전체 공지','/announcements',Megaphone],['학교 행사','/events',CalendarDays],['학생회 활동 보고','/boards/report',ClipboardCheck]]},
 {title:'게시판',items:[['전체 게시글','/boards',List],['인기글','/popular',ChartNoAxesCombined],['자유게시판','/boards/free',MessagesSquare],['질문게시판','/boards/question',MessageCircle],['정보공유','/boards/info',BookOpen],['분실물 게시판','/boards/lost',Search],['노래 추천','/boards/music',BookOpen]]},
 {title:'학생 참여',items:[['전자 건의함','/suggestions',Mail],['학생회 채널','/council-channel',MessagesSquare],['멘토·멘티','/mentoring',Users],['설문조사','/surveys',Vote],['공약 이행 현황','/pledges',ChartNoAxesCombined]]},
 {title:'학급 제출',items:[['업무·제출 현황','/class-tasks',ClipboardList],['내 학급 제출','/class-tasks/my-submissions',CheckCheck]]},
 {title:'내 활동',items:[['내가 쓴 글','/mypage',PenLine],['알림','/notifications',Bell]]},
 {title:'운영진 관리',min:3,items:[['관리자 대시보드','/admin',LayoutDashboard],['게시글·댓글 검토','/admin/posts',ShieldCheck],['학급별 제출 관리','/admin/class-tasks',ClipboardList],['멘토·멘티 매칭','/admin/mentoring',Users]]},
 {title:'회원 관리',min:4,items:[['회원 · 계정 관리','/admin/members',Users],['임시 계정 발급','/admin/accounts',KeyRound]]},
 {title:'교사 관리',min:5,items:[['등급 관리','/admin/roles',ShieldCheck],['관리자 활동 기록','/admin/logs',FileText],['검토 보조 안내','/admin/settings',ShieldCheck]]},
];
export function AppShell({ children }: { children: React.ReactNode }) {
  const { state, member, switchMember, toast,ready,mode,busy,notify } = useDemo();
  const pathname = usePathname(); const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false); const [query, setQuery] = useState('');
  const activeLevel = level(member);
  const unread = state.notifications.filter(n => n.recipientId === member?.id && !n.read).length;
  const authPage = pathname === '/login' || pathname.startsWith('/register');
  if(!ready || !activeLevel) return <><header className="login-header"><span className="brand"><span className="brand-mark"><GraduationCap size={24}/></span>소통해용</span><span>진주 문산중학교 학생 자치 커뮤니티</span></header><main id="main" className="login-main">{children}</main>{toast && <div role="status" className="toast">{toast}</div>}</>;
  return <>
    <a href="#main" className="skip-link">본문으로 바로가기</a>
    <header className="topbar"><div className="topbar-inner">
      <Button variant="ghost" size="icon" className="mobile-menu" aria-label="게시판 메뉴 열기" onClick={() => setMobileOpen(true)}><Menu size={22}/></Button>
      <Link href="/" className="brand"><span className="brand-mark"><GraduationCap size={24} strokeWidth={2}/></span><span>소통해용<span className="brand-school">문산중학교</span></span></Link>
      <form className="global-search" action="/search" onSubmit={e => { e.preventDefault(); router.push(`/search?q=${encodeURIComponent(query)}`); }}><Search size={18}/><input aria-label="통합 검색" name="q" value={query} onChange={e => setQuery(e.target.value)} placeholder="어떤 소식을 찾고 있나요?"/><kbd>검색</kbd></form>
      <div className="topbar-actions"><span className="school-label">문산중학교 학생 자치 커뮤니티</span><Link href="/notifications" className="notification-button" aria-label={`알림 ${unread}개`}><Bell size={20}/>{unread > 0 && <span/>}</Link><span className="topbar-divider"/><Link href="/mypage" className="top-profile"><span className="avatar avatar-small">{member?.name.slice(0, 1) ?? '?'}</span><span>{member?.name ?? '방문자'}</span><ChevronDown size={14}/></Link></div>
    </div></header>
    <div className="demo-strip"><div><span className="demo-dot"/><strong>{mode==='demo'?'로컬 체험':'회원 전용'}</strong><span>{mode==='demo'?'가상 데이터 · 운영 환경의 계정 전환은 제공하지 않습니다.':'승인된 문산중학교 회원만 이용할 수 있습니다.'}</span><Link href="/login">{mode==='demo'?'체험 계정 바꾸기':'내 계정'} <ChevronRight size={12}/></Link></div></div>
    <nav className="cafe-tabs" aria-label="학교 소식 탭"><Link href="/">게시판 홈</Link><Link href="/announcements">전체 공지</Link><Link href="/events">학교 행사</Link><Link href="/boards/report">학생회 활동 보고</Link></nav>
    <div className={cn('workspace', authPage && 'workspace-auth')}>
      {mobileOpen && <button className="sidebar-backdrop" aria-label="메뉴 닫기" onClick={() => setMobileOpen(false)}/>}
      <aside className={cn('sidebar', mobileOpen && 'sidebar-open')} aria-label="주 메뉴">
        <div className="sidebar-mobile-title">게시판 메뉴<Button size="icon" variant="ghost" aria-label="메뉴 닫기" onClick={() => setMobileOpen(false)}><X size={20}/></Button></div>
        <section className="profile-card"><div className="profile-line"><span className="avatar">{member?.name.slice(0, 1) ?? '?'}</span><div><strong>{member?.name ?? '방문자'}{member && <span className="member-suffix"> 님</span>}</strong><p>{member?.classId ? classLabel(member.classId) : '문산중학교'}{member?.position ? ` · ${member.position === 'CLASS_PRESIDENT' ? '반장' : '부반장'}` : ''}</p></div></div><div className="profile-meta"><span className="level-label">LEVEL {activeLevel}</span><span>{member ? ROLE_INFO[member.role].label : '로그인 필요'}</span><ShieldCheck size={14}/></div><div className="profile-links"><Link href="/mypage">내 활동</Link><span/><button onClick={() => void runAction(() => switchMember(null),notify)}>{member ? '로그아웃' : '체험 로그인'}<LogOut size={12}/></button></div><Button asChild className="write-button"><Link href="/posts/write"><PenLine size={16}/>글쓰기</Link></Button></section>
        <Link href="/" onClick={() => setMobileOpen(false)} className={cn('home-link', (pathname === '/' || pathname === '/home') && 'nav-active')}><Home size={17}/>커뮤니티 홈</Link>
        <nav>{groups.filter(g=>!g.min||activeLevel>=g.min).map(group=><details className={sidebarStyles.group} key={group.title} open={group.title==='학교 소식'||group.items.some(([,href])=>pathname===href)}><summary>{group.title}</summary>{group.items.map(([label,href,Icon])=><Link key={href} href={href} onClick={()=>setMobileOpen(false)} className={cn('nav-link',pathname===href&&'nav-active')}><Icon size={16}/><span>{label}</span></Link>)}</details>)}</nav>
        <div className="sidebar-help"><ShieldCheck size={18}/><div><strong>함께 지키는 커뮤니티</strong><p>서로를 존중하며 소통해요.</p><Link href="/guide" onClick={() => setMobileOpen(false)}>레벨별 이용 가이드 <ArrowUpRight size={12}/></Link></div></div>
      </aside>
      <main id="main" className="main-content">{children}<SiteVisits/><footer className="footer"><div><strong>소통해용</strong><span>문산중학교 학생 자치 커뮤니티</span></div><nav><Link href="/terms">이용약관</Link><Link href="/privacy">개인정보 처리방침</Link><Link href="/guide">이용 가이드</Link></nav><p>{mode==='demo'?'© 2026 소통해용. 현재 표시된 회원·학교 일정은 모두 예시입니다.':'© 2026 소통해용. 승인된 문산중학교 회원 전용 커뮤니티입니다.'}</p></footer></main>
    </div>
    <Button asChild className="mobile-write" aria-label="글쓰기"><Link href="/posts/write"><PenLine size={20}/></Link></Button>
    {toast && <div role="status" className="toast"><CheckCheck size={18}/>{toast}</div>}
    {busy && <div className="saving-indicator" role="status">서버에 저장 중…</div>}
  </>;
}
