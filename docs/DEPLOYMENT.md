# GitHub Pages + Supabase 연결 순서

2026-11-08 GitHub 저장소 공개와 [Pages 임시 배포](https://leo-0229.github.io/sotonghaeyong/)를 완료했습니다. Supabase 로그인은 연결되었습니다. AI API는 미연결 상태이며, 아래는 새 환경에서 같은 구성을 만드는 절차입니다. 최신 정책은 [게시판·소통 기능](COMMUNITY_UPDATE.md)을 따릅니다.

## 1. 데이터베이스

빈 개발용 Supabase 프로젝트에 다음 SQL을 순서대로 적용하세요. 기존에 적용한 SQL 다음 번호부터 추가합니다.

```text
supabase/migrations/202611080001_initial.sql
supabase/migrations/202611080002_pages_and_policy.sql
supabase/migrations/202611080003_temporary_accounts.sql
supabase/migrations/202611080004_pilot_release.sql
supabase/migrations/202611080005_five_digit_student_ids.sql
supabase/migrations/202611080006_two_pilot_administrators.sql
supabase/migrations/202611080007_reusable_temporary_accounts.sql
supabase/migrations/202611080008_account_recovery_and_deletion.sql
supabase/migrations/202611080009_l4_information_department.sql
supabase/migrations/202611080010_l4_account_management.sql
supabase/migrations/202611080011_board_prefixes_and_editing.sql
supabase/migrations/202611080012_reactions_and_replies.sql
supabase/migrations/202611080013_council_channel_and_mentor_contacts.sql
supabase/migrations/202611080014_public_suggestions_and_submission_directory.sql
supabase/migrations/202611080015_community_snapshot_and_workflows.sql
supabase/migrations/202611080016_channel_notification_links.sql
```

002는 기존 학급 제출의 보완·접수 확정 상태를 `SUBMITTED`로 바꿉니다. 이전 과목별 멘토링 테이블은 이력 기반으로 남지만 새 화면은 `school_life_mentoring`을 사용합니다. 운영 이력이 있다면 먼저 백업과 기존 매칭 검토가 필요합니다.

Authentication에서 **공개 신규 가입을 끄고** 개별 계정을 발급합니다. 외부 가입 API로 계정을 만들어도 프로필은 PENDING이며 앱 데이터 접근은 거부됩니다.

## 2. 앱 공개 설정

`.env.example`을 `.env.local`로 복사해 공개 값을 입력합니다.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR-PUBLIC-KEY
NEXT_PUBLIC_BASE_PATH=
NEXT_PUBLIC_ENABLE_DEMO=false
```

설정 후 개발 서버를 재시작하면 가상 계정 선택 대신 실제 아이디·비밀번호 로그인을 표시합니다. ACTIVE 회원도 임시 로그인 정보 변경을 마쳐야 콘텐츠를 읽습니다. 성별은 일반 회원에게 본인 값만 제공하며 운영진은 매칭 업무 범위에서 확인합니다.

## 3. 임시 계정 발급과 첫 로그인 변경

현재 계정 정책은 **[계정 안내](ACCOUNTS.md)** 를 따릅니다. 학교에서 학번·이름·성별을 등록하면 무작위 임시 아이디와 비밀번호를 발급하며, 첫 로그인에서 두 정보를 모두 변경해야 합니다. 실제 개인 이메일은 필요하지 않습니다.

최초 담당 교사는 운영자 CLI로 발급하고, 이후 계정은 L4·L5의 **임시 계정 발급**에서 만듭니다. L5 발급·복구 등 세부 권한은 계정 안내를 따릅니다. 계정 처리용 account-access Edge Function도 추가 배포하세요. 기존 이메일 방식의 계정은 전환 전까지 유지됩니다.

## 4. 검토 보조 Edge Function

[OpenAI 공식 Structured Outputs 문서](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)를 기준으로 Responses API를 호출합니다. API 프로젝트에서 사용 가능한 Structured Outputs 지원 모델을 선택해 `OPENAI_MODEL`에 지정하세요. 학교의 외부 AI 전송 검토와 API 비용 확인이 필요합니다.

`supabase/functions/.env.example`을 `.env.local`로 복사하고 Edge Function 비밀 설정을 등록한 뒤 배포합니다.

```powershell
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase secrets set --env-file supabase/functions/.env.local
supabase functions deploy moderate-post
supabase functions deploy account-access
```

서버 설정 (AI 관련 두 값은 선택 사항):

- `OPENAI_API_KEY`: 서버 전용 API 키.
- `OPENAI_MODEL`: 사용 가능한 Structured Outputs 지원 모델.
- `ALLOWED_ORIGINS`: `https://YOUR-NAME.github.io,http://127.0.0.1:3000`처럼 허용 출처를 쉼표로 구분. `/mpms/` 같은 경로는 포함하지 않습니다.

`supabase/config.toml`은 게이트웨이 구형 JWT 검증 대신 **함수 내부 `Auth.getUser(token)` 검증**을 사용합니다. 토큰 검증과 ACTIVE 확인을 생략하지 않습니다.

교사명 검사는 현재 사용하지 않습니다. AI에는 제목·본문만 전송하고 `store: false`를 요청합니다. 이는 외부 서비스의 모든 보유 정책을 대체하지 않습니다.

규칙 검사와 AI 결과가 모두 명확히 안전한 경우만 자동 승인합니다. AI 미연결·오류·의심 결과는 운영진 검토 대기입니다. 규칙에 걸린 글은 자동 공개하지 않습니다.

## 5. GitHub Pages 배포

GitHub 저장소의 **Settings → Pages → Source → GitHub Actions**를 선택합니다. Actions Variables에 다음 **공개 값 두 개**를 등록하고 수동 workflow를 `connected`로 실행하세요.

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

`.github/workflows/pages.yml`은 수동 실행만 가능하며 비공개 파일·비밀키 검사와 테스트·정적 빌드 후 `out/`만 배포합니다. `configure-pages`가 저장소 기본 경로를 전달하므로 `https://NAME.github.io/mpms/#/boards` 형태를 지원합니다. 새 게시글·업무 ID는 해시 경로로 처리합니다.

실제 학생 명단·교사명 명단·AI 키·service_role 키를 소스, Variables, 정적 산출물에 넣지 마세요. 정적 페이지의 화면 가림과 별개로 Supabase Auth/RLS/RPC가 실제 데이터 권한을 검증합니다.

## 6. 실제 연결 후 확인

로컬 테스트는 Auth 스키마를 대역으로 사용하므로 실제 Supabase 통합을 대체하지 않습니다. 실제 환경에서 비로그인/PENDING/정지 계정 차단, 다른 반 제출 차단, 두 대표의 동시 수정 충돌, 마감 차단, AI 오류 시 승인 대기, 동성 1:1 중복 차단, 비공개 건의 권한, 공약 저장, 모바일·Pages 하위 경로 새로고침을 확인하세요.

학교 운영 승인, 개인정보 처리·보유·파기 기준, 미성년자 관련 절차, AI 전송 정책은 학교가 확정해야 합니다. 파일 첨부는 비활성화 상태입니다. 실제 서비스 이용 요금과 약관은 배포 시점 공식 문서에서 확인하세요.

## 아이톡톡

[경상남도교육청 미래교육원](https://gnfe.gne.go.kr/gnfe/cm/cntnts/cntntsView.do?cntntsId=10178&mi=20349)은 외부 에듀테크 연계를 설명합니다. 다만 이번 조사에서 개인 개발자가 즉시 사용할 공개 OAuth 등록·개발 규격은 확인하지 못했습니다. 사용자가 선택한 별도 발급 계정 방식을 구현했습니다. 공식 연동 승인·개발 문서·클라이언트 등록이 준비되면 해당 규격으로 추가할 수 있습니다.

임시 비밀번호 재조회에는 `account-access` 서버 비밀 설정 `TEMP_CREDENTIAL_KEY`가 필요합니다. 32바이트 무작위 hex 키를 사용하고 브라우저 변수·저장소에 넣지 않습니다. 키와 운영자 CLI 설정은 [계정 안내](ACCOUNTS.md)를 따릅니다.
