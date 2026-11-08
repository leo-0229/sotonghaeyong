# 소통해용

진주 문산중학교 학생 자치 커뮤니티입니다. **GitHub Pages 정적 사이트 + Supabase Auth/PostgreSQL/Edge Function** 구성을 사용합니다.

처음 배포한다면 [쉬운 시작 안내](docs/BEGINNER_SETUP.md)부터 읽어 주세요.

저작권 표시: **© 2026 leo-0229. All rights reserved.** 자유 이용을 허용하는 오픈소스 라이선스는 부여하지 않았습니다. 외부 라이브러리는 각자의 라이선스를 따릅니다. 자세한 범위는 [LICENSE](LICENSE)를 확인하세요.

## 로컬에서 열기

이미 실행 중인 개발 서버가 있다면 해당 터미널에서 `Ctrl+C`로 종료하고 다시 실행하세요.

```powershell
cd C:\Users\user\Desktop\mpms
npm.cmd run dev
```

**http://127.0.0.1:3000** 접속 → 체험 계정 선택. 의존성이 없으면 먼저 `npm.cmd ci`를 실행합니다. 가상 계정 선택은 개발 모드의 localhost에만 제공하며 초기 상태는 로그아웃입니다.

## 변경한 정책

| 요청 | 반영 내용 |
| --- | --- |
| GitHub Pages 로그인 | 학번·이름·성별을 등록해 임시 계정 개별 발급 → 최초 로그인에서 아이디·비밀번호 변경. 운영 환경에서 가상 역할 전환·공개 가입을 제공하지 않음 |
| 비로그인 제한 | 로그인·승인 전 메뉴·검색·모든 학교 콘텐츠 차단. 서버 ACTIVE 검사 및 RLS 적용 |
| 학급 제출 | 학급당 한 건을 반장·부반장이 공유하며 마감/업무 종료 전 수정. 최종 제출·접수 확정·보완 승인 절차 제거. 추가 수정은 개인 연락 안내 |
| 게시글 승인 | 모든 글·댓글은 운영진 승인 후 공개. 규칙·AI는 참고 정보만 제공. 공지·교사 글도 동일하며 자기 글 승인 불가 |
| 멘토·멘티 | 과목 구분 없는 동성 1:1 학교생활 도움. 서버에서 성별·중복 매칭 확인. 전화번호는 사이트에 저장하지 않고 두 사람이 별도 교환 |
| UI | 카페 상단 메뉴, 프로필·게시판 사이드바, 조밀한 글 목록. 공식 상징 모과나무·개나리에서 초록·노랑 반영. 사용 색상 코드는 공식 CI 코드가 아닌 UI용 값 |
| 공약 | LEVEL 4~5가 제목·부서·요약·세부 추진 내용·상태·진행률 편집 |

`ㅋㅋㅋ ㅎㅎㅎ ㄷㄷㄷ ㅠㅠㅠ ㅜㅜㅜ` 같은 반복 표현은 허용합니다. 의미 판단에는 AI의 누락·오탐 가능성이 있어 운영진 검토와 신고도 유지합니다. 자신의 글을 스스로 승인할 수 없습니다.

## 현재 상태

**계정 발급 및 최초 로그인 변경 절차는 [계정 안내](docs/ACCOUNTS.md)를 참고하세요.** 교사 화면의 임시 계정 발급과 별도 운영자 CLI를 제공합니다. 기존 설정에는 SQL 003·004와 `account-access`/`moderate-post` 함수 배포를 추가해야 합니다. 임시 운영은 L1~L5 각 1개(총 5개)만 발급합니다.

- **로컬 체험**은 가상 회원·일정과 localStorage로 동작합니다. 실제 개인정보를 입력하지 마세요. 이전 v1 데이터와 새 v2 데이터를 분리했습니다.
- **운영 코드**는 Supabase가 설정되면 실제 계정 인증 후 RLS가 적용된 `community_snapshot`으로 읽고 검증된 RPC로 저장합니다. 운영 데이터 전체를 localStorage에 저장하지 않습니다. Auth 세션은 Supabase 클라이언트가 관리합니다.
- **외부 서비스는 아직 연결하지 않았습니다.** 사용자가 Supabase 프로젝트·AI 키·아이톡톡 승인·GitHub 저장소가 없다고 답했으므로 실제 프로젝트 생성, 계정 발급, AI 원격 호출, 배포는 실행하지 않았습니다.
- 운영 빌드에 설정이 없으면 로그인 설정 안내만 표시됩니다. 공개 호스트에서는 체험 계정을 선택할 수 없습니다. AI 미연결 상태를 자동 승인으로 처리하지 않습니다.

## GitHub Pages

```powershell
npm.cmd run build
npm.cmd start
```

산출물은 `out/`이며 `start`는 정적 파일 확인 서버입니다. 운영 설정 없는 프로덕션 빌드는 잠긴 로그인 안내가 정상입니다. **실제 연결 및 계정 발급은 [배포 가이드](docs/DEPLOYMENT.md)를 참고하세요.**

Pages에는 Node.js 서버가 없으므로 주소는 `/#/boards`, `/#/posts/<id>` 형식입니다. 새 글과 업무가 생겨도 새로고침 시 404가 발생하지 않습니다. 프로젝트 기본 경로는 `NEXT_PUBLIC_BASE_PATH`로 처리합니다. GitHub Actions 배포 파일은 `.github/workflows/pages.yml`이며 수동 실행만 허용합니다. [임시 배포 설계와 데이터 보호](docs/PILOT_RELEASE.md)를 먼저 확인하세요.

## 검사

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd exec playwright install chromium
npm.cmd run test:e2e
npm.cmd run build
```

PGlite로 초기 마이그레이션 회귀 검사와 현재 v2 정책 검사를 분리합니다. Playwright는 **3100번 포트와 별도 빌드 캐시**에서 실행해 사용자의 개발 서버와 분리합니다. 브라우저 검사 날짜는 예시 일정에 맞춰 고정합니다.

2026-11-08 최종 검증: 단위·DB·공개 검사 **131개**, Chromium 브라우저 **15개** 통과. TypeScript 및 정적 빌드, 소스·산출물 공개 검사 통과. `/sotonghaeyong/` 운영 산출물의 자산 로딩·해시 경로 새로고침·로그인 잠금·가상 계정 차단도 별도 확인했습니다. 원격 Supabase·GitHub 통합은 아직 실행하지 않았습니다.

임시 계정 기능 추가 후 검증: 단위·DB **105개**, Chromium 브라우저 **13개** 통과. TypeScript 및 정적 빌드 통과. 최초 변경 전 접근 차단, 실제 Auth 필드 변경 감지, 이전 JWT 버전 차단, 임시 계정 발급→로그인 정보 변경 흐름을 포함합니다.

실제 Supabase Auth/PostgREST/Edge Function 및 AI 서비스 통합은 아직 검증하지 않았습니다. 운영 프로젝트에서 추가 검증이 필요합니다. UI 스크린샷은 `.local/screenshots/`에 있습니다.

## 주요 파일

```text
src/components/navigation.tsx             Pages 해시 경로
src/components/demo-provider.tsx          로컬/실제 인증·저장 분기
src/lib/backend.ts                        UI 변경을 서버 명령으로 변환
src/lib/supabase/browser.ts               실제 로그인 클라이언트
supabase/migrations/                      초기 및 현재 정책·RLS·RPC
supabase/functions/_shared/moderation.ts   규칙 검사·공개 판정
supabase/functions/moderate-post/index.ts  인증·빈도 제한·AI·저장
scripts/provision-account.mjs             운영자 개별 계정 발급
docs/DEPLOYMENT.md                        실제 연결 및 배포 순서
```

파일 첨부는 비활성화 상태입니다. 학교 운영 승인과 개인정보 처리·보유·삭제 기준, 미성년자 관련 절차, AI 외부 전송 검토는 운영 전에 학교가 확정해야 합니다.

참고: [문산중학교 공식 학교상징](https://munsan-m.gne.go.kr/munsan-m/cm/cntnts/cntntsView.do?cntntsId=19808&mi=105826), [과구리](https://www.jshsus.kr/), [GitHub Pages 공식 문서](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).
