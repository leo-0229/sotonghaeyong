'use client';
import Link from '@/components/navigation';
import { useDemo } from './demo-provider';
import { BoardScreen, HomeScreen, PostScreen, WriteScreen } from './community';
import { LoginScreen, MyPageScreen, NotificationsScreen, RegisterScreen } from './account';
import { TaskCreateScreen, TaskDetailScreen, TaskListScreen, TaskSubmissionsScreen } from './class-tasks';
import { EventsScreen, MentoringScreen, PledgesScreen, SuggestionsScreen, SurveysScreen } from './participation';
import { AdminHomeScreen, AdminMentoringScreen, LogsScreen, MembersScreen, ReviewPostsScreen } from './admin';
import { AccessDenied, EmptyState, PageHeading } from './shared';
import { level } from '@/lib/domain';
import { Button } from './ui/button';
import { ModerationSettings } from './moderation-settings';
import { CredentialSetup } from './credential-setup';
import {CouncilChannel} from './council-channel';
import { IssueAccountScreen } from './issue-account';
import { GuideScreen } from './guide';

export function RouteScreen({ segments }: { segments: string[] }) {
  const { ready, member } = useDemo();
  const route = segments.join('/'); const [area, id, action, detail] = segments;
  if (!ready) return <div className="loading" role="status"><span className="loading-dot"/>소통해용을 불러오는 중입니다…</div>;
  if (member?.status==='ACTIVE' && member.mustChangeCredentials) return <CredentialSetup/>;
  if (!level(member)) return <LoginScreen/>;
  if (route === 'guide' || route === 'about') return <GuideScreen/>;
  if (!route || route === 'home') return <HomeScreen/>;
  if (route === 'login') return <LoginScreen/>;
  if (area === 'register') return <RegisterScreen status={id === 'status'}/>;
  if (route === 'search') return <BoardScreen search/>;
  if (route === 'popular') return <BoardScreen popular/>;
  if (area === 'boards') return <BoardScreen key={id} board={id ?? 'all'}/>;
  if (route === 'announcements') return <BoardScreen board="notice"/>;
  if (area === 'posts') return id === 'write' ? <WriteScreen/> : <PostScreen id={id}/>;
  if (area === 'events') return <EventsScreen id={id}/>;
  if (route === 'pledges') return <PledgesScreen/>;
  if (area === 'class-tasks') {
    if (!id || id === 'my-submissions' || id === 'deadlines') return <TaskListScreen mode={id === 'my-submissions' ? 'mine' : id === 'deadlines' ? 'deadlines' : 'list'}/>;
    return <TaskDetailScreen key={`${id}-${action}`} id={id} submit={action === 'submit'}/>;
  }
  if (area === 'suggestions') return <SuggestionsScreen create={id === 'new'}/>;
  if(route==='council-channel')return <CouncilChannel/>;
  if (route === 'mentoring') return <MentoringScreen/>;
  if (route === 'surveys') return <SurveysScreen/>;
  if (route === 'mypage') return <MyPageScreen/>;
  if (route === 'notifications') return <NotificationsScreen/>;
  if (area === 'admin') {
    if (level(member) < 3) return <AccessDenied/>;
    if (!id) return <AdminHomeScreen/>;
    if (id==='accounts') return <IssueAccountScreen/>;
    if (id === 'posts') return <ReviewPostsScreen/>;
    if (id === 'members' || id === 'registrations' || id === 'roles') return <MembersScreen roles={id === 'roles'}/>;
    if (id === 'class-tasks') { if (action === 'new') return <TaskCreateScreen/>; if (action && detail === 'submissions') return <TaskSubmissionsScreen id={action}/>; return <TaskListScreen admin/>; }
    if (id === 'suggestions') return <SuggestionsScreen admin/>;
    if (id === 'mentoring') return <AdminMentoringScreen/>;
    if (id === 'pledges') return <PledgesScreen/>;
    if (id === 'events') return <EventsScreen/>;
    if (id === 'announcements') return <BoardScreen board="council"/>;
    if (id === 'logs') return <LogsScreen/>;
    if (id === 'settings') return <ModerationSettings/>;
  }
  if (['privacy', 'terms', 'about'].includes(route)) return <DocumentScreen kind={route}/>;
  return <EmptyState title="페이지를 찾을 수 없어요" description="주소를 확인하거나 커뮤니티 홈으로 돌아가 주세요." href="/" action="홈으로"/>;
}
function DocumentScreen({ kind }: { kind: string }) {
  const {mode}=useDemo();
  const data: Record<string, { title: string; intro: string; sections: [string, string][] }> = {
    about: { title: '소통해용 초안 안내', intro: '문산중학교 학생 자치 커뮤니티의 로컬 개발용 프로토타입입니다.', sections: [
      ['현재 체험할 수 있는 기능', '역할별 화면, 가상 회원의 가입·교사 승인, 게시글 작성·승인·반려, 댓글 검토, 통합 검색, 학급 대표 제출·임시 저장·수정, 업무 생성, 행사 신청, 비공개 건의 화면, 설문, 멘토·멘티 매칭, 공약 현황, 내부 알림을 체험할 수 있습니다.'],
      ['데이터 저장', '체험 데이터는 현재 브라우저의 localStorage에 저장합니다. 같은 브라우저의 다른 체험 계정과 데이터를 공유합니다. 실제 인증, 서버 저장, 개인정보 보호의 보안 경계로 사용할 수 없습니다. 실제 학생 정보는 입력하지 마세요.'],
      ['운영 전 필요한 작업', 'Supabase Auth·DB·Storage 연동, 서버 API와 UI 연결, 학교가 승인한 본인 확인 절차, 실제 RLS 통합 테스트, 파일 업로드 검증, 요청 빈도 제한, 개인정보 보유·삭제 절차, 학교 운영 승인이 필요합니다. SQL과 서버 클라이언트는 후속 연동을 위한 기반입니다.'],
      ['참고한 구성', '과구리의 학교 정보와 학생 커뮤니티를 모은 구성을 참고했습니다. 소통해용은 요청한 게시판 중심 레이아웃과 교표의 남색·노랑·흰색을 참고한 카페형 디자인을 적용하고, 학급별 채팅 대신 대표 업무 시스템을 제공합니다.'],
    ] },
    privacy: { title: '개인정보 처리방침 준비 안내', intro: '학교 검토 전 개발 초안이며, 정식 개인정보 처리방침이 아닙니다.', sections: [
      ['현재 초안의 저장 범위', '가상의 이름, 학급, 게시글, 신청 내용과 체험 로그를 이 브라우저에 저장합니다. 서버로 전송하거나 실제 학생 인증에 사용하지 않습니다. 비밀번호나 학교 계정 비밀번호를 입력받지 않습니다.'],
      ['체험 데이터 삭제', '체험 계정 선택 화면의 초기화 버튼으로 이 앱의 로컬 데이터를 초기 상태로 되돌릴 수 있습니다. 브라우저의 사이트 데이터 삭제 기능으로도 제거할 수 있습니다.'],
      ['정식 운영 시 확정할 항목', '운영 주체, 처리 목적과 항목, 보유 기간, 법적 근거, 미성년자 관련 절차, 위탁·국외 이전 사항, 정보주체 권리 행사 창구와 파기 절차를 학교 담당자가 검토하고 확정해야 합니다.'],
    ] },
    terms: { title: '커뮤니티 이용 규칙', intro: '소통해용 개발 초안의 기본 이용 규칙입니다.', sections: [
      ['서로를 존중해 주세요', '친구를 비방하거나 차별하는 말, 허위 정보, 다른 사람의 개인정보가 담긴 글을 작성하지 마세요.'],
      ['게시글과 댓글 검토', '게시글·댓글은 서버 규칙 검사에 걸리지 않으면 자동 공개됩니다. 욕설·혐오·성적 표현, 교사 호칭·정치 관련 표현·회원 이름·지정 은어, 외부 링크·연락처 등 의심 내용은 운영진 검토를 거칩니다. 수정 시에도 재검사하며 본인이 직접 수동 승인할 수 없습니다.'],
      ['학급 대표 제출', '반장과 부반장은 자신의 학급을 대표하여 하나의 제출 건을 함께 관리합니다. 제출·수정 이력을 남기며 마감 전까지 수정할 수 있습니다. 최종 확정 절차는 없고 추가 수정 요청은 대표에게 개인적으로 연락합니다.'],
      ['정식 운영', '실제 운영 약관과 처리 기준은 학교 담당자의 검토 및 운영 승인 이후 확정합니다.'],
    ] },
    settings: { title: '운영 설정 준비 안내', intro: '초안은 브라우저 체험 모드로 실행됩니다.', sections: [['후속 연동', '실제 보안 정책, 학교 본인 확인, 가입 승인 기준, 개인정보 보유 기간, 파일 업로드와 댓글 정책은 서버 및 데이터베이스 연동 후 설정할 수 있도록 확장할 예정입니다. 현재 화면에서는 운영 보안 설정을 변경하지 않습니다.']] },
  };
  if(mode==='supabase'){data.about.intro='진주 문산중학교 승인 회원 전용 학생 자치 커뮤니티입니다.';data.about.sections[1][1]='학교 데이터는 Supabase에 저장하고 로그인한 회원의 역할·학급·업무 배정에 따라 접근합니다. 로그인 세션은 브라우저에서 관리합니다.';data.privacy.sections[0][1]='운영 환경에서는 이름·학급·역할·멘토링 매칭용 성별, 작성 글과 신청 내용을 Supabase에서 처리합니다. 비밀번호는 Supabase Auth가 관리하며 학교 계정 비밀번호를 수집하지 않습니다. 정식 보유·파기 기준과 운영 주체는 학교가 별도로 확정해야 합니다.';data.privacy.sections[1][1]='내 활동의 회원 탈퇴 기능으로 본인이 작성한 글·건의·신청을 삭제하고 이용을 중지합니다. 학급 공동 제출과 운영 이력, Auth 계정의 보유·파기는 학교의 확정된 정책에 따라 담당자가 처리합니다.';}
  const doc = data[kind];
  return <><PageHeading title={doc.title} description={doc.intro}/><article className="panel document">{doc.sections.map(([title, text]) => <section key={title}><h2>{title}</h2><p>{text}</p></section>)}{kind === 'about' && <p><a href="https://www.jshsus.kr/" target="_blank" rel="noreferrer">참고: 과구리 공식 사이트 ↗</a></p>}<Button asChild variant="outline"><Link href="/">홈으로 돌아가기</Link></Button></article></>;
}
