import {expect,test,type Page} from '@playwright/test';
const browserErrors=new WeakMap<Page,string[]>();
test.afterEach(async({page})=>{expect(browserErrors.get(page)??[]).toEqual([]);});
const go=(page:Page,path:string)=>page.goto(`/#${path}`);
async function choose(page:Page,text:string){await go(page,'/login');await page.locator('.demo-accounts button').filter({hasText:text}).click();await expect(page.locator('.login-main')).toHaveCount(0);}
test.beforeEach(async({page})=>{const errors:string[]=[];browserErrors.set(page,errors);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await page.clock.install({time:new Date('2026-11-08T12:00:00+09:00')});await go(page,'/');await page.getByRole('heading',{name:'체험 계정으로 둘러보기'}).waitFor();});
test('logged out visitors cannot read or use any community route',async({page})=>{for(const path of ['/','/boards','/posts/post-1','/search?q=공지','/events','/class-tasks','/admin','/mentoring','/pledges']){await go(page,path);await expect(page.getByRole('heading',{name:'체험 계정으로 둘러보기'})).toBeVisible();await expect(page.locator('.sidebar')).toHaveCount(0);await expect(page.locator('.post-row')).toHaveCount(0);await expect(page.getByRole('textbox',{name:'통합 검색'})).toHaveCount(0);}});
test('cafe layout works on desktop and mobile',async({page})=>{await choose(page,'학급 대표 · 반장');const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.runFor(5000);await page.setViewportSize({width:1440,height:1050});await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.getByRole('button',{name:'게시판 메뉴 열기'}).click();await page.locator('summary').filter({hasText:'학급 제출'}).click();await page.getByRole('link',{name:'업무·제출 현황'}).click();await expect(page.getByRole('heading',{name:'학급 대표 업무',exact:true})).toBeVisible();expect(errors).toEqual([]);});
test('suspicious and unverified posts remain pending until reviewed',async({page})=>{await choose(page,'일반 학생');await go(page,'/posts/write');await page.getByLabel('제목',{exact:true}).fill('게시글 자동 검사 확인');await page.getByLabel('내용',{exact:true}).fill('학교생활 정보를 https://example.com 에서 확인했어요.');await page.getByRole('button',{name:'게시글 등록',exact:true}).click();await expect(page.getByText('승인 대기',{exact:true}).first()).toBeVisible();await go(page,'/boards');await expect(page.getByRole('link',{name:/게시글 자동 검사 확인/})).toHaveCount(0);await choose(page,'학생회 임원');await go(page,'/admin/posts');await page.locator('.post-review').filter({hasText:'게시글 자동 검사 확인'}).getByRole('button',{name:'승인 후 공개'}).click();await go(page,'/boards');await expect(page.getByRole('link',{name:/게시글 자동 검사 확인/})).toBeVisible();});
test('class representatives edit one submission without final approval',async({page})=>{await choose(page,'학급 대표 · 반장');await go(page,'/class-tasks/festival/submit');await page.getByLabel('부스 이름').fill('우리 반 놀이터');await page.getByLabel('부스 운영 계획').fill('보드게임을 진행하는 부스입니다.');await page.getByLabel('운영 참여 인원').fill('15');await page.getByRole('button',{name:'학급 대표 제출',exact:true}).click();await expect(page).toHaveURL(/my-submissions/);await choose(page,'학급 대표 · 부반장');await go(page,'/class-tasks/festival/submit');await expect(page.getByLabel('부스 이름')).toHaveValue('우리 반 놀이터');await page.getByLabel('운영 참여 인원').fill('18');await page.getByRole('button',{name:'수정 내용 저장'}).click();await choose(page,'학생회 임원');await go(page,'/admin/class-tasks/festival/submissions');await page.getByRole('row').filter({hasText:'2학년 3반'}).getByRole('button',{name:'보기'}).click();await expect(page.locator('.review-detail')).toContainText('18');await expect(page.getByRole('button',{name:'접수 확정'})).toHaveCount(0);await expect(page.getByRole('button',{name:'보완 요청'})).toHaveCount(0);await expect(page.getByText(/추가 수정이 필요하면/)).toBeVisible();});
test('same-gender 1:1 mentoring omits time and only offers contact sharing after matching',async({page})=>{await choose(page,'학급 대표 · 반장');await go(page,'/mentoring');await expect(page.getByText('과목을 구분하지 않는 학교생활 도움 프로그램입니다.')).toBeVisible();await expect(page.locator('input[type=tel]')).toHaveCount(0);await page.getByLabel('신청 구분').selectOption('멘토');await page.getByLabel('도와줄 수 있는 학교생활').fill('학교 시설과 동아리를 안내할 수 있어요.');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'멘토링 신청',exact:true}).click();await choose(page,'일반 학생');await go(page,'/mentoring');await page.getByLabel('도움받고 싶은 학교생활').fill('새 학교에 적응하는 데 도움받고 싶어요.');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'멘토링 신청',exact:true}).click();await choose(page,'학생회 임원');await go(page,'/admin/mentoring');await page.getByRole('combobox',{name:'멘토',exact:true}).selectOption({index:1});await page.getByRole('combobox',{name:'동성 멘티',exact:true}).selectOption({index:1});await page.getByRole('button',{name:'1:1 매칭 확정'}).click();await expect(page.locator('.activity-row').filter({hasText:'매칭 완료'})).toHaveCount(2);});
test('executives can edit pledge text, details, status, department and progress',async({page})=>{await choose(page,'학생회 회장단');await go(page,'/pledges');await page.getByRole('button',{name:'공약 내용 수정'}).first().click();await page.getByLabel('공약 제목').fill('학교 공간 개선 계획');await page.getByLabel('담당 부서').fill('생활부');await page.getByLabel('진행 상태').selectOption('보류');await page.getByLabel('진행률 (%)').fill('35');await page.getByLabel('공약 요약').fill('우리 학교 공간 개선을 준비합니다.');await page.getByLabel('세부 추진 내용').fill('학생 의견 수렴 완료\n설치 일정 조정 중');await page.getByRole('button',{name:'공약 변경 저장'}).click();await page.reload();await expect(page.getByRole('heading',{name:'학교 공간 개선 계획'})).toBeVisible();await page.locator('.pledge-card').first().locator('summary').click();await expect(page.locator('.pledge-card').first()).toContainText('설치 일정 조정 중');});
test('ordinary students cannot access admin or submit class work',async({page})=>{await choose(page,'일반 학생');for(const path of ['/admin','/class-tasks/festival/submit']){await go(page,path);await expect(page.getByRole('heading',{name:'접근 권한을 확인해 주세요'})).toBeVisible();}});
test('search and personal event registration survive a reload',async({page})=>{await choose(page,'학급 대표 · 반장');await go(page,'/search?q=도서관');await expect(page.locator('.post-row')).not.toHaveCount(0);await go(page,'/events/event-book');await page.getByRole('button',{name:'행사 참가 신청',exact:true}).click();await page.reload();await expect(page.getByRole('button',{name:'신청 취소',exact:true})).toBeVisible();});
test('new class requests produce editable forms',async({page})=>{await choose(page,'학생회 회장단');await go(page,'/admin/class-tasks/new');await page.getByLabel('업무 제목').fill('학급 행사 인원 조사');await page.getByLabel('업무 설명').fill('행사에 참가할 인원을 알려 주세요.');await page.getByLabel('제출 시작일').fill('2026-11-08T09:00');await page.getByLabel('제출 마감일').fill('2026-11-25T23:59');await page.getByLabel('항목 이름').fill('행사 참여 계획');await page.getByRole('button',{name:'업무 요청 등록'}).click();await expect(page.getByRole('heading',{name:'학급 행사 인원 조사',exact:true})).toBeVisible();const path=new URL(page.url()).hash.slice(1).replace('/admin','').replace('/submissions','/submit');await choose(page,'학급 대표 · 반장');await go(page,path);await page.getByLabel('행사 참여 계획').fill('우리 반 15명이 참여해요.');await page.getByRole('button',{name:'학급 대표 제출',exact:true}).click();await expect(page).toHaveURL(/my-submissions/);});
test('all major pages fit narrow screens',async({page})=>{await choose(page,'학급 대표 · 반장');for(const width of [360,768]){await page.setViewportSize({width,height:900});for(const route of ['/boards','/posts/write','/events','/class-tasks/festival/submit','/suggestions/new','/surveys','/mentoring','/pledges']){await go(page,route);await expect(page.locator('.loading')).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${route} ${width}px`).toBe(true);}}});
test('an executive can register a pledge with detailed content',async({page})=>{await choose(page,'학생회 회장단');await go(page,'/pledges');await page.getByRole('button',{name:'공약 등록',exact:true}).click();await page.getByLabel('공약 제목').fill('새 학생 자치 공약');await page.getByLabel('공약 요약').fill('학교생활 개선을 위한 새로운 공약입니다.');await page.getByLabel('세부 추진 내용').fill('1단계 의견 수렴\n2단계 추진 일정 확정');await page.getByRole('button',{name:'공약 변경 저장'}).click();await expect(page.getByRole('heading',{name:'새 학생 자치 공약'})).toBeVisible();await page.reload();await expect(page.getByRole('heading',{name:'새 학생 자치 공약'})).toBeVisible();});
test('a teacher issues a temporary account and first login requires new credentials',async({page})=>{
 await choose(page,'담당 교사');await go(page,'/admin/accounts');await page.getByLabel('학번',{exact:true}).fill('20315');await page.getByLabel('이름',{exact:true}).fill('발급학생');await page.getByRole('combobox',{name:'성별',exact:true}).selectOption('FEMALE');await page.getByRole('button',{name:'임시 계정 발급',exact:true}).click();
 const card=page.locator('.issued-credentials');await expect(card).toContainText('20315');const tempId=await card.locator('code').nth(0).innerText();const tempPassword=await card.locator('code').nth(1).innerText();expect(tempId).toMatch(/^tmp_/);expect(tempPassword).toMatch(/^[a-hjkmnp-z2-9]{10}$/);
 await go(page,'/login');await page.locator('.demo-accounts button').filter({hasText:'발급학생'}).click();await expect(page.getByRole('heading',{name:'아이디와 비밀번호를 바꿔 주세요'})).toBeVisible();await expect(page.locator('.verified-identity')).toContainText('20315');await expect(page.locator('.verified-identity')).toContainText('발급학생');await expect(page.locator('.verified-identity')).toContainText('여학생');await expect(page.locator('.sidebar')).toHaveCount(0);
 await go(page,'/boards');await expect(page.getByRole('heading',{name:'아이디와 비밀번호를 바꿔 주세요'})).toBeVisible();await expect(page.locator('.post-row')).toHaveCount(0);
 await page.getByLabel('현재 임시 비밀번호').fill(tempPassword);await expect(page.getByLabel('현재 임시 비밀번호')).toHaveAttribute('type','password');await page.getByRole('button',{name:'비밀번호 보기',exact:true}).first().click();await expect(page.getByLabel('현재 임시 비밀번호')).toHaveAttribute('type','text');await page.getByRole('button',{name:'비밀번호 숨기기',exact:true}).click();await expect(page.getByLabel('현재 임시 비밀번호')).toHaveAttribute('type','password');await page.getByLabel('새 아이디',{exact:true}).fill('my_school_id');await page.getByLabel('새 비밀번호',{exact:true}).fill('Pass2026');await page.getByLabel('새 비밀번호 확인').fill('DifferentPass!2026');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'로그인 정보 변경 완료'}).click();await expect(page.getByRole('status')).toContainText('새 비밀번호 확인이 일치하지 않습니다.');await expect(page.getByRole('heading',{name:'아이디와 비밀번호를 바꿔 주세요'})).toBeVisible();await page.getByLabel('새 비밀번호 확인').fill('Pass2026');await page.getByRole('button',{name:'로그인 정보 변경 완료'}).click();await expect(page.getByRole('heading',{name:'소통해용.'})).toBeVisible();
 await page.reload();await expect(page.getByRole('heading',{name:'소통해용.'})).toBeVisible();const saved=await page.evaluate(()=>Object.values(localStorage).join(' '));expect(saved).not.toContain('Pass2026');expect(saved).not.toContain(tempPassword);expect(saved).toContain('my_school_id');
});
test('council officers cannot issue temporary accounts',async({page})=>{await choose(page,'학생회 임원');await go(page,'/admin/accounts');await expect(page.getByRole('heading',{name:'접근 권한을 확인해 주세요'})).toBeVisible();});

test('teacher references wait for another reviewer',async({page})=>{
 await choose(page,'담당 교사');await go(page,'/posts/write');await expect(page.getByText('규칙 검사를 통과하면 자동 공개됩니다.')).toBeVisible();await page.getByRole('combobox',{name:'게시판',exact:true}).selectOption('notice');await page.getByLabel('제목',{exact:true}).fill('선생님 관련 임시 운영 공지');await page.getByLabel('내용',{exact:true}).fill('소통해용에서 함께 학교생활 이야기를 나누어요. 서로의 의견을 존중해 주세요.');await page.getByRole('button',{name:'게시글 등록',exact:true}).click();await expect(page.getByText('승인 대기',{exact:true}).first()).toBeVisible();await go(page,'/boards');await expect(page.getByRole('link',{name:/선생님 관련 임시 운영 공지/})).toHaveCount(0);await choose(page,'학생회 임원');await go(page,'/admin/posts');await page.locator('.post-review').filter({hasText:'선생님 관련 임시 운영 공지'}).getByRole('button',{name:'승인 후 공개'}).click();await go(page,'/boards');await expect(page.getByRole('link',{name:/선생님 관련 임시 운영 공지/})).toBeVisible();
});

test('L5 can issue several accounts at the same level',async({page})=>{
 await choose(page,'담당 교사');await go(page,'/admin/accounts');
 for(const [sid,name]of [['20315','첫발급학생'],['20316','다음발급학생']]){
  await page.getByLabel('학번',{exact:true}).fill(sid);await page.getByLabel('이름',{exact:true}).fill(name);await page.getByRole('combobox',{name:'성별',exact:true}).selectOption('FEMALE');await page.getByRole('button',{name:'임시 계정 발급',exact:true}).click();
  await expect(page.locator('.issued-credentials')).toBeVisible();
 }
 await go(page,'/login');await expect(page.locator('.demo-accounts button').filter({hasText:'첫발급학생'})).toHaveCount(1);await expect(page.locator('.demo-accounts button').filter({hasText:'다음발급학생'})).toHaveCount(1);
});

test('L5 account actions require name confirmation and protect self',async({page})=>{
 await page.getByText('아이디·비밀번호를 잊었나요?',{exact:true}).click();
 await expect(page.getByText('학교의 L5 담당자에게 계정 분실을 알려 주세요. 기존 비밀번호를 보내지 마세요.',{exact:true})).toBeVisible();
 await choose(page,'담당 교사');await go(page,'/admin/members');
 await expect(page.getByRole('row').filter({hasText:'담당 선생님'}).getByRole('button',{name:'계정 삭제',exact:true})).toHaveCount(0);
 const row=page.getByRole('row').filter({hasText:'이서연'});
 await row.getByRole('button',{name:'비밀번호 초기화',exact:true}).click();
 let dialog=page.getByRole('dialog',{name:'이서연 비밀번호 초기화 확인'});
 await expect(dialog.getByRole('button',{name:'초기화 확정'})).toBeDisabled();
 await dialog.getByLabel('확인할 회원 이름').fill('다른이름');await dialog.getByRole('checkbox').check();
 await expect(dialog.getByRole('button',{name:'초기화 확정'})).toBeDisabled();
 await dialog.getByLabel('확인할 회원 이름').fill('이서연');await dialog.getByRole('button',{name:'초기화 확정'}).click();
 await expect(row).toContainText('첫 로그인 변경 대기');
 await expect(row.getByRole('link',{name:'새 임시 아이디·비밀번호 확인',exact:true})).toBeVisible();
 await row.getByRole('button',{name:'계정 삭제',exact:true}).click();
 dialog=page.getByRole('dialog',{name:'이서연 계정 삭제 확인'});
 await dialog.getByLabel('확인할 회원 이름').fill('이서연');await dialog.getByRole('checkbox').check();
 await dialog.getByRole('button',{name:'삭제 확정'}).click();await expect(row).toHaveCount(0);
});

test('L5 filters member lists by class and numeric level together',async({page})=>{
 await choose(page,'담당 교사');
 for(const route of ['/admin/members','/admin/roles']){
  await go(page,route);
  const classFilter=page.getByRole('combobox',{name:'학급별 보기',exact:true});
  const levelFilter=page.getByRole('combobox',{name:'등급별 보기',exact:true});
  await levelFilter.selectOption('4');
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await expect(page.locator('tbody')).toContainText('학생회 회장단');
  await expect(page.locator('tbody')).toContainText('정보통신부 부장');
  await classFilter.selectOption('2-3');
  await levelFilter.selectOption('1');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody')).toContainText('이서연');
  await levelFilter.selectOption('5');
  await expect(page.getByRole('heading',{name:'조건에 맞는 회원이 없습니다'})).toBeVisible();
  await classFilter.selectOption('none');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody')).toContainText('담당 선생님');
  await page.getByRole('button',{name:'필터 초기화'}).click();
  await expect(classFilter).toHaveValue('all');await expect(levelFilter).toHaveValue('all');
  await expect(page.locator('tbody tr')).toHaveCount(8);
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
});

test('L4 can register and delete members without L5 recovery access',async({page})=>{
 await choose(page,'학생회 회장단');await go(page,'/admin/accounts');
 await expect(page.getByRole('heading',{name:'임시 계정 발급',exact:true})).toBeVisible();
 await expect(page.getByRole('combobox',{name:'회원 등급'}).locator('option[value="SUPERVISING_TEACHER"]')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'임시 로그인 정보 확인',exact:true})).toHaveCount(0);
 await page.getByLabel('학번',{exact:true}).fill('20317');await page.getByLabel('이름',{exact:true}).fill('공통권한학생');
 await page.getByRole('combobox',{name:'성별',exact:true}).selectOption('MALE');
 await page.getByRole('button',{name:'임시 계정 발급',exact:true}).click();
 await expect(page.locator('.issued-credentials')).toContainText('공통권한학생');
 await go(page,'/admin/members');
 const row=page.getByRole('row').filter({hasText:'공통권한학생'});
 await expect(row.getByRole('button',{name:'비밀번호 초기화',exact:true})).toHaveCount(0);
 await row.getByRole('button',{name:'계정 삭제',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'공통권한학생 계정 삭제 확인'});
 await dialog.getByLabel('확인할 회원 이름').fill('공통권한학생');await dialog.getByRole('checkbox').check();
 await dialog.getByRole('button',{name:'삭제 확정'}).click();await expect(row).toHaveCount(0);
});

test('authors edit approved posts and board-specific prefixes then receive reapproval',async({page})=>{
 await choose(page,'일반 학생');await go(page,'/posts/write');
 await page.getByRole('combobox',{name:'게시판',exact:true}).selectOption('question');await expect(page.getByRole('combobox',{name:'말머리',exact:true})).toHaveValue('궁금해용');
 await page.getByLabel('제목',{exact:true}).fill('질문 게시글 편집 확인');await page.getByLabel('내용',{exact:true}).fill('학교 도서관을 이용하는 방법을 알고 싶습니다.');
 await page.getByRole('button',{name:'게시글 등록',exact:true}).click();await expect(page.getByText('승인 대기',{exact:true})).toHaveCount(0);
 const postPath=new URL(page.url()).hash.slice(1);
 await choose(page,'일반 학생');await go(page,postPath);await page.locator('.article-actions').getByRole('button',{name:'하트 누르기'}).click();await expect(page.locator('.article-actions').getByRole('button',{name:'하트 취소'})).toContainText('1');
 await page.getByRole('link',{name:'글·말머리 수정'}).click();await page.getByRole('combobox',{name:'말머리',exact:true}).selectOption('해결됐어용');await page.getByLabel('내용',{exact:true}).fill('선생님과 학교 도서관 이용 방법을 확인했고 해결했습니다.');
 await page.getByRole('button',{name:'수정 내용 저장',exact:true}).click();await expect(page.getByText('승인 대기',{exact:true}).first()).toBeVisible();await expect(page.locator('.article-category')).toContainText('해결됐어용');
 await choose(page,'학급 대표 · 반장');await go(page,'/boards/question');await expect(page.getByRole('link',{name:/질문 게시글 편집 확인/})).toHaveCount(0);
 await choose(page,'학생회 임원');await go(page,'/admin/posts');await page.locator('.post-review').filter({hasText:'질문 게시글 편집 확인'}).getByRole('button',{name:'승인 후 공개'}).click();
 await go(page,'/boards/question');await page.getByRole('combobox',{name:'말머리 필터'}).selectOption('value:해결됐어용');await expect(page.getByRole('link',{name:/질문 게시글 편집 확인/})).toBeVisible();
 await go(page,'/posts/write');await page.getByRole('combobox',{name:'게시판',exact:true}).selectOption('lost');await expect(page.getByRole('combobox',{name:'말머리',exact:true}).locator('option')).toHaveText(['찾아가용','찾아용','찾았어용']);
});

test('comments support hearts and one-level replies',async({page})=>{
 await choose(page,'일반 학생');await go(page,'/posts/post-4');await page.getByLabel('댓글 내용',{exact:true}).fill('댓글과 답글을 확인하는 내용입니다.');await page.getByRole('button',{name:'댓글 등록',exact:true}).click();
 await choose(page,'학급 대표 · 반장');await go(page,'/posts/post-4');const comment=page.locator('.comment').filter({hasText:'댓글과 답글을 확인하는 내용입니다.'});await comment.getByRole('button',{name:'하트 누르기'}).click();await expect(comment.getByRole('button',{name:'하트 취소'})).toContainText('1');await comment.getByRole('button',{name:'답글',exact:true}).click();await page.getByLabel('답글 내용',{exact:true}).fill('원래 댓글에 연결된 답글입니다.');await page.getByRole('button',{name:'답글 등록',exact:true}).click();await expect(page.getByText('원래 댓글에 연결된 답글입니다.',{exact:true})).toBeVisible();
});

test('clean public suggestions publish and private questions stay private',async({page})=>{
 await choose(page,'일반 학생');await go(page,'/suggestions/new');await page.getByLabel('공개 범위').selectOption('PUBLIC');await page.getByLabel('제목',{exact:true}).fill('공개 건의함 질문 검증');await page.getByLabel('건의 내용').fill('도서관의 이용 시간을 학생들에게 안내해 주세요.');await page.getByRole('button',{name:'건의·질문 등록'}).click();await expect(page.getByRole('link',{name:'공개 건의함 질문 검증'})).toBeVisible();
 await choose(page,'학급 대표 · 반장');await go(page,'/suggestions');await page.getByRole('link',{name:'공개 건의함 질문 검증'}).click();await expect(page.getByRole('heading',{name:'공개 건의함 질문 검증'})).toBeVisible();await expect(page.getByLabel('학생회 답변',{exact:true})).toHaveCount(0);
 await choose(page,'일반 학생');await go(page,'/suggestions/new');await page.getByLabel('공개 범위').selectOption('PRIVATE');await page.getByLabel('제목',{exact:true}).fill('비공개 건의함 질문 검증');await page.getByLabel('건의 내용').fill('학생회 담당자에게만 전달하는 비공개 문의입니다.');await page.getByRole('button',{name:'건의·질문 등록'}).click();await expect(page.getByRole('link',{name:'비공개 건의함 질문 검증'})).toBeVisible();
 await choose(page,'학급 대표 · 반장');await go(page,'/suggestions');await expect(page.getByRole('link',{name:'비공개 건의함 질문 검증'})).toHaveCount(0);
});

test('clean posts publish immediately and flagged edits return to review',async({page})=>{
 await choose(page,'일반 학생');await go(page,'/posts/write');await page.getByLabel('제목',{exact:true}).fill('자동 공개되는 학교 이야기');await page.getByLabel('내용',{exact:true}).fill('도서관에서 친구들과 함께 책을 읽었습니다.');await page.getByRole('button',{name:'게시글 등록',exact:true}).click();await expect(page.locator('.article h1')).toHaveText('자동 공개되는 학교 이야기');await expect(page.getByText('승인 대기',{exact:true})).toHaveCount(0);
 await go(page,'/boards');await expect(page.getByRole('link',{name:/자동 공개되는 학교 이야기/})).toBeVisible();await page.getByRole('link',{name:/자동 공개되는 학교 이야기/}).click();await page.getByRole('link',{name:'글·말머리 수정'}).click();await page.getByLabel('내용',{exact:true}).fill('쌤과 도서관에서 함께 책을 읽었습니다.');await page.getByRole('button',{name:'수정 내용 저장',exact:true}).click();await expect(page.getByText('승인 대기',{exact:true}).first()).toBeVisible();
 await choose(page,'학급 대표 · 반장');await go(page,'/boards');await expect(page.getByRole('link',{name:/자동 공개되는 학교 이야기/})).toHaveCount(0);
});

test('political names in posts and comments wait for moderation',async({page})=>{
 await choose(page,'일반 학생');await go(page,'/posts/write');await page.getByLabel('제목',{exact:true}).fill('김현지 관련 질문입니다');await page.getByLabel('내용',{exact:true}).fill('문서에서 읽은 이름에 관해 질문하는 게시글입니다.');await page.getByRole('button',{name:'게시글 등록',exact:true}).click();await expect(page.getByText('승인 대기',{exact:true}).first()).toBeVisible();await expect(page.getByText(/정치·이념·정치인 관련 표현 · 운영진 확인 필요/)).toBeVisible();
 await choose(page,'학급 대표 · 반장');await go(page,'/boards');await expect(page.getByRole('link',{name:/김현지 관련 질문입니다/})).toHaveCount(0);
 await go(page,'/posts/post-4');await page.getByLabel('댓글 내용',{exact:true}).fill('트럼프 관련 내용을 이야기합니다.');await page.getByRole('button',{name:'댓글 등록',exact:true}).click();
 await choose(page,'일반 학생');await go(page,'/posts/post-4');await expect(page.getByText('트럼프 관련 내용을 이야기합니다.',{exact:true})).toHaveCount(0);
 await choose(page,'학생회 임원');await go(page,'/admin/posts');await expect(page.locator('.post-review').filter({hasText:'김현지 관련 질문입니다'})).toBeVisible();await expect(page.locator('.comment-review').filter({hasText:'트럼프 관련 내용을 이야기합니다.'})).toBeVisible();
});

test('authors delete their posts with confirmation',async({page})=>{
 await choose(page,'일반 학생');await go(page,'/posts/write');await page.getByLabel('제목',{exact:true}).fill('본인 삭제 기능 확인');await page.getByLabel('내용',{exact:true}).fill('직접 작성하고 삭제하는 학교생활 게시글입니다.');await page.getByRole('button',{name:'게시글 등록',exact:true}).click();
 await page.getByRole('button',{name:'게시글 삭제',exact:true}).click();let dialog=page.getByRole('dialog',{name:'게시글 삭제 확인'});await expect(dialog.getByRole('button',{name:'삭제 확정'})).toBeDisabled();await dialog.getByRole('button',{name:'취소',exact:true}).click();await expect(page.getByRole('heading',{name:'본인 삭제 기능 확인'})).toBeVisible();
 await page.getByRole('button',{name:'게시글 삭제',exact:true}).click();dialog=page.getByRole('dialog',{name:'게시글 삭제 확인'});await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'삭제 확정'}).click();await expect(page).toHaveURL(/boards/);await expect(page.getByRole('link',{name:/본인 삭제 기능 확인/})).toHaveCount(0);
});
test('author comment deletion preserves another member reply',async({page})=>{
 await choose(page,'일반 학생');await go(page,'/posts/post-4');await page.getByLabel('댓글 내용',{exact:true}).fill('부모 댓글 삭제 검증 내용입니다.');await page.getByRole('button',{name:'댓글 등록',exact:true}).click();
 await choose(page,'학급 대표 · 반장');await go(page,'/posts/post-4');const parent=page.locator('.comment').filter({hasText:'부모 댓글 삭제 검증 내용입니다.'});await expect(parent.getByRole('button',{name:'댓글 삭제',exact:true})).toHaveCount(0);await parent.getByRole('button',{name:'답글',exact:true}).click();await page.getByLabel('답글 내용',{exact:true}).fill('다른 회원이 남긴 답글을 유지합니다.');await page.getByRole('button',{name:'답글 등록',exact:true}).click();
 await choose(page,'일반 학생');await go(page,'/posts/post-4');await page.locator('.comment').filter({hasText:'부모 댓글 삭제 검증 내용입니다.'}).getByRole('button',{name:'댓글 삭제',exact:true}).click();const dialog=page.getByRole('dialog',{name:'댓글 삭제 확인'});await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'삭제 확정'}).click();await expect(page.getByText('부모 댓글 삭제 검증 내용입니다.',{exact:true})).toHaveCount(0);await expect(page.locator('.comment').filter({hasText:'다른 회원이 남긴 답글을 유지합니다.'})).toBeVisible();
});
test('L4 force deletes comments and posts with reasons',async({page})=>{
 await choose(page,'일반 학생');await go(page,'/posts/post-4');await page.getByLabel('댓글 내용',{exact:true}).fill('운영진 강제 삭제 검증 댓글입니다.');await page.getByRole('button',{name:'댓글 등록',exact:true}).click();
 await choose(page,'학생회 임원');await go(page,'/posts/post-4');await expect(page.getByRole('button',{name:'게시글 강제 삭제',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'댓글 강제 삭제',exact:true})).toHaveCount(0);
 await choose(page,'학생회 회장단');await go(page,'/posts/post-4');await page.locator('.comment').filter({hasText:'운영진 강제 삭제 검증 댓글입니다.'}).getByRole('button',{name:'댓글 강제 삭제',exact:true}).click();let dialog=page.getByRole('dialog',{name:'댓글 강제 삭제 확인'});await dialog.getByRole('checkbox').check();await expect(dialog.getByRole('button',{name:'삭제 확정'})).toBeDisabled();await dialog.getByLabel('강제 삭제 사유').fill('운영 기준 위반으로 삭제합니다.');await dialog.getByRole('button',{name:'삭제 확정'}).click();await expect(page.getByText('운영진 강제 삭제 검증 댓글입니다.',{exact:true})).toHaveCount(0);
 await page.locator('.article-actions').getByRole('button',{name:'게시글 강제 삭제',exact:true}).click();dialog=page.getByRole('dialog',{name:'게시글 강제 삭제 확인'});await dialog.getByLabel('강제 삭제 사유').fill('운영 기준 위반 게시글 삭제');await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'삭제 확정'}).click();await expect(page).toHaveURL(/boards/);await go(page,'/posts/post-4');await expect(page.getByRole('heading',{name:'게시글을 찾을 수 없어요'})).toBeVisible();
});
test('all levels queue abusive posts, slang comments and full-name references',async({page})=>{
 for(const [index,role] of ['일반 학생','학급 대표 · 반장','학생회 임원','학생회 회장단','담당 교사'].entries()){
  await choose(page,role);await go(page,'/posts/write');await page.getByLabel('제목',{exact:true}).fill('등급 공통 검사 '+index);await page.getByLabel('내용',{exact:true}).fill('이1새1끼 라는 표현을 사용한 검사 게시글입니다.');await page.getByRole('button',{name:'게시글 등록',exact:true}).click();await expect(page.getByText('아직 공개되지 않은 글입니다.',{exact:true})).toBeVisible();await expect(page.getByText('승인 대기',{exact:true}).first()).toBeVisible();
  await go(page,'/posts/post-4');const content='검사 '+index+' 여시 펨코 일베 디시 우흥 북 딱 예아';await page.getByLabel('댓글 내용',{exact:true}).fill(content);await page.getByRole('button',{name:'댓글 등록',exact:true}).click();await expect(page.locator('.comment').filter({hasText:content}).getByText('승인 대기',{exact:true})).toBeVisible();
 }
 await choose(page,'일반 학생');await go(page,'/posts/write');await page.getByLabel('제목',{exact:true}).fill('이름 포함 검사 확인');await page.getByLabel('내용',{exact:true}).fill('이1서1연과 학교 도서관에 갔습니다.');await page.getByRole('button',{name:'게시글 등록',exact:true}).click();await expect(page.getByText(/회원 이름 포함/)).toBeVisible();
});

test('members report comments and L4 deletes reported content',async({page})=>{
 await choose(page,'일반 학생');await go(page,'/posts/post-4');await page.getByLabel('댓글 내용',{exact:true}).fill('댓글 신고 흐름을 검증하는 내용입니다.');await page.getByRole('button',{name:'댓글 등록',exact:true}).click();const own=page.locator('.comment').filter({hasText:'댓글 신고 흐름을 검증하는 내용입니다.'});await expect(own.getByRole('button',{name:'댓글 신고',exact:true})).toHaveCount(0);
 await choose(page,'학급 대표 · 반장');await go(page,'/posts/post-4');await page.locator('.comment').filter({hasText:'댓글 신고 흐름을 검증하는 내용입니다.'}).getByRole('button',{name:'댓글 신고',exact:true}).click();let dialog=page.getByRole('dialog',{name:'댓글 신고',exact:true});await expect(dialog.getByRole('button',{name:'댓글 신고 접수'})).toBeDisabled();await dialog.getByLabel('댓글 신고 사유').fill('운영 기준에 맞지 않는 댓글입니다.');await dialog.getByRole('button',{name:'댓글 신고 접수'}).click();await expect(dialog).toHaveCount(0);
 await choose(page,'학생회 회장단');await go(page,'/admin/posts');const reported=page.locator('.comment-report').filter({hasText:'댓글 신고 흐름을 검증하는 내용입니다.'});await expect(reported).toContainText('운영 기준에 맞지 않는 댓글입니다.');await reported.getByRole('button',{name:'댓글 강제 삭제',exact:true}).click();dialog=page.getByRole('dialog',{name:'댓글 강제 삭제 확인'});await dialog.getByLabel('강제 삭제 사유').fill('신고 내용 확인 후 댓글 삭제');await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'삭제 확정'}).click();await expect(reported).toHaveCount(0);await go(page,'/posts/post-4');await expect(page.getByText('댓글 신고 흐름을 검증하는 내용입니다.',{exact:true})).toHaveCount(0);
});
test('given names without surnames also wait for review',async({page})=>{
 await choose(page,'일반 학생');await go(page,'/posts/write');await page.getByLabel('제목',{exact:true}).fill('단독 이름 검사 확인');await page.getByLabel('내용',{exact:true}).fill('서1연과 함께 학교 도서관에 갔습니다.');await page.getByRole('button',{name:'게시글 등록',exact:true}).click();await expect(page.getByText('아직 공개되지 않은 글입니다.',{exact:true})).toBeVisible();await expect(page.getByText(/회원 이름 포함/)).toBeVisible();
});

test('music recommendation board has no prefixes',async({page})=>{
 await choose(page,'일반 학생');await go(page,'/boards/music');await expect(page.getByRole('heading',{name:'노래 추천',exact:true})).toBeVisible();await page.getByRole('link',{name:'글쓰기',exact:true}).last().click();await expect(page.getByRole('combobox',{name:'게시판',exact:true})).toHaveValue('music');await expect(page.getByRole('combobox',{name:'말머리',exact:true})).toHaveCount(0);await page.getByLabel('제목',{exact:true}).fill('오늘 듣기 좋은 연주곡');await page.getByLabel('내용',{exact:true}).fill('잔잔한 피아노 연주곡을 추천해요. 책을 읽으며 듣기 좋아요.');await page.getByRole('button',{name:'게시글 등록',exact:true}).click();await expect(page.getByRole('heading',{name:'오늘 듣기 좋은 연주곡'})).toBeVisible();await expect(page.getByText('승인 대기',{exact:true})).toHaveCount(0);await go(page,'/boards/music');await expect(page.getByRole('combobox',{name:'말머리 필터'})).toHaveCount(0);await expect(page.getByRole('link',{name:/오늘 듣기 좋은 연주곡/})).toBeVisible();await expect(page.locator('[class*=prefix]')).toHaveCount(0);
});
