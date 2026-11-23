'use client';

import type {ReactNode} from 'react';
import Link from './navigation';
import {useDemo} from './demo-provider';
import {EmptyState,PageHeading,PanelHeading,StatusBadge} from './shared';
import {level,type Post} from '@/lib/domain';
import {getPopularPosts} from '@/lib/post-views';
import {shortDate} from '@/lib/utils';
import styles from './home-overview.module.css';

export function HomeOverview({renderPosts}:{renderPosts:(posts:Post[])=>ReactNode}){
  const {state,member}=useDemo();
  const published=state.posts.filter(p=>p.status==='APPROVED').sort((a,b)=>+new Date(b.date)-+new Date(a.date));
  const notices=published.filter(p=>p.board==='notice'||p.pinned).slice(0,3);
  const news=published.filter(p=>['report','council'].includes(p.board)).slice(0,3);
  const pledges=state.pledges.filter(p=>p.status!=='완료').slice(0,3);
  const events=state.events.filter(event=>+new Date(event.deadline)>=Date.now()).sort((a,b)=>+new Date(a.deadline)-+new Date(b.deadline)).slice(0,3);
  const roleLink=level(member)>=3?['/admin','운영진 업무','검토 대기와 담당 업무']:level(member)===2?['/class-tasks/my-submissions','우리 반 업무','제출 내용 확인·수정']:['/mypage','내 활동','작성한 글과 처리 상태'];
  const links=[roleLink,['/suggestions','전자 건의함','학생회에 의견 전달'],['/boards/lost','분실물','분실·습득 소식 확인'],['/council-channel','학생회 채널','학생회와 개별 연락']];
  return <>
    <PageHeading eyebrow="진주 문산중학교 · 학생 자치 커뮤니티" title="소통해용." description={`${member?.name} 님, 오늘의 학교 소식과 필요한 메뉴를 확인해 보세요.`}/>
    <section className={styles.welcome} aria-label="자주 사용하는 서비스"><div><span>함께 나누는 학교생활</span><h2>작은 의견도, 새로운 소식도 여기서.</h2><p>공지 확인부터 학생회와의 소통까지 한곳에서 시작해요.</p></div><nav>{links.map(([href,title,description])=><Link key={href} href={href}><strong>{title}<span aria-hidden>↗</span></strong><span>{description}</span></Link>)}</nav></section>
    <div className={styles.grid}>
      <section className="panel"><PanelHeading title="주요 공지" href="/announcements"/>{notices.length?<div className={styles.rows}>{notices.map(p=><Link key={p.id} href={'/posts/'+p.id}><strong>{p.title}</strong><time dateTime={p.date}>{shortDate(p.date)}</time></Link>)}</div>:<EmptyState title="새로운 공지를 기다리고 있어요"/>}</section>
      <section className="panel"><PanelHeading title="학생회 소식" href="/boards/report"/>{news.length?<div className={styles.rows}>{news.map(p=><Link key={p.id} href={'/posts/'+p.id}><strong>{p.title}</strong><time dateTime={p.date}>{shortDate(p.date)}</time></Link>)}</div>:<EmptyState title="등록된 학생회 소식이 없어요"/>}</section>
    </div>
    <section className="panel"><PanelHeading title="최근 게시글" href="/boards" text="전체 게시판"/>{renderPosts(published.slice(0,5))}</section>
    <div className={styles.grid}>
      <section className="panel"><PanelHeading title="진행 중인 공약" href="/pledges"/>{pledges.length?<div className={styles.rows}>{pledges.map(p=><Link key={p.id} href="/pledges"><div><strong>{p.title}</strong><p>{p.description}</p></div><StatusBadge status={p.status??'추진 중'}/></Link>)}</div>:<EmptyState title="진행 중인 공약이 없어요"/>}</section>
      <section className="panel"><PanelHeading title="참여할 수 있는 행사" href="/events"/>{events.length?<div className={styles.rows}>{events.map(event=><Link key={event.id} href={'/events/'+event.id}><strong>{event.title}</strong><span>신청 마감 {shortDate(event.deadline)}</span></Link>)}</div>:<EmptyState title="현재 신청 가능한 행사가 없어요"/>}</section>
    </div>
    <section className="panel" aria-label="인기글 미리보기"><PanelHeading title="인기글 TOP 5" href="/popular" text="전체 보기"/>{renderPosts(getPopularPosts(published).slice(0,5))}</section>
  </>;
}
