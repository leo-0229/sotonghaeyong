import {expect,test,type Page} from '@playwright/test';

const go=(page:Page,path:string)=>page.goto('/#'+path);
async function choose(page:Page,role='일반 학생'){
  await go(page,'/login');await page.locator('.demo-accounts button').filter({hasText:role}).click();
  await expect(page.locator('.login-main')).toHaveCount(0);
}
test.beforeEach(async({page})=>{await page.clock.install({time:new Date('2026-11-23T12:00:00+09:00')});});

test('board filters survive opening a post, back navigation and reload',async({page})=>{
  await choose(page);
  await page.evaluate(()=>{
    const state=JSON.parse(localStorage.getItem('mpms-draft-v2')!);
    state.posts=Array.from({length:31},(_,i)=>({...state.posts[0],id:'search-'+i,authorId:'student',board:'question',prefix:'궁금해용',title:'검색연습 '+i,content:'검색과 페이지 복원 확인을 위한 가상 게시글입니다.',status:'APPROVED',comments:[],views:i,date:new Date(2026,10,i+1).toISOString()}));
    localStorage.setItem('mpms-draft-v2',JSON.stringify(state));
  });
  await page.reload();
  await expect(page.getByRole('heading',{name:'소통해용.',exact:true})).toBeVisible();
  await go(page,'/search');await page.getByLabel('게시글 검색어').fill('검색연습');await page.locator('.board-search').getByRole('button',{name:'검색',exact:true}).click();
  await page.getByLabel('게시판 필터').selectOption('question');await page.getByLabel('말머리 필터').selectOption('value:궁금해용');await page.getByLabel('게시글 정렬').selectOption('views');
  await page.getByRole('button',{name:'2 페이지',exact:true}).click();const resultUrl=page.url();
  const href=await page.locator('tbody .post-row').first().getByRole('link').getAttribute('href');
  await page.locator('tbody .post-row').first().getByRole('link').click();await expect(page.locator('.article')).toBeVisible();
  await page.goBack();await expect(page).toHaveURL(resultUrl);await page.reload();
  await expect(page.getByLabel('게시글 검색어')).toHaveValue('검색연습');await expect(page.getByLabel('게시판 필터')).toHaveValue('question');await expect(page.getByLabel('게시글 정렬')).toHaveValue('views');
  await expect(page.getByRole('button',{name:'2 페이지',exact:true})).toHaveAttribute('aria-current','page');
  await expect(page.locator('tbody .post-row').first().getByRole('link')).toHaveAttribute('href',href!);
  await page.getByRole('button',{name:'검색 초기화'}).click();await expect(page.getByLabel('게시글 검색어')).toHaveValue('');
});

test('mobile menu traps focus, closes with Escape and restores the opener',async({page})=>{
  await page.setViewportSize({width:320,height:740});await choose(page);
  const opener=page.getByRole('button',{name:'게시판 메뉴 열기'});await opener.click();
  const menu=page.getByRole('dialog',{name:'주 메뉴'});await expect(menu).toBeVisible();
  await expect(menu.getByRole('button',{name:'메뉴 닫기',exact:true})).toBeFocused();
  await page.keyboard.press('Shift+Tab');await expect(menu.getByRole('link',{name:'레벨별 이용 가이드'})).toBeFocused();
  await page.keyboard.press('Tab');await expect(menu.getByRole('button',{name:'메뉴 닫기',exact:true})).toBeFocused();
  await page.keyboard.press('Escape');await expect(menu).toHaveCount(0);await expect(opener).toBeFocused();
  expect(await page.locator('.main-content').evaluate(element=>(element as HTMLElement).inert)).toBe(false);
});

test('core pages fit 320px and provide readable real data on the new home',async({page},info)=>{
  await page.setViewportSize({width:320,height:740});await choose(page);
  for(const path of ['/','/boards','/search','/posts/post-1','/posts/write','/suggestions','/suggestions/new','/pledges','/events','/mentoring','/council-channel','/class-tasks']){
    await go(page,path);await expect(page.locator('.main-content h1').first()).toBeVisible();await expect(page.locator('.loading')).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),path).toBe(true);
  }
  await go(page,'/');await expect(page.getByRole('heading',{name:'주요 공지',exact:true})).toBeVisible();
  await page.screenshot({path:info.outputPath('home-320.png'),fullPage:true});
});

test('offline notice keeps a comment draft and disappears on reconnect',async({page,context})=>{
  await choose(page);await go(page,'/posts/post-1');await page.getByLabel('댓글 내용',{exact:true}).fill('아직 보내지 않은 댓글 내용입니다.');
  await context.setOffline(true);await expect(page.getByRole('status').filter({hasText:'인터넷 연결이 끊겼습니다.'})).toBeVisible();
  await expect(page.getByLabel('댓글 내용',{exact:true})).toHaveValue('아직 보내지 않은 댓글 내용입니다.');
  await context.setOffline(false);await expect(page.locator('.connection-notice')).toHaveCount(0);
});

test('member role changes require explicit confirmation and can be cancelled',async({page})=>{
  await choose(page,'담당 교사');await go(page,'/admin/roles');
  const role=page.getByLabel('이서연 등급',{exact:true});await role.selectOption('COUNCIL_OFFICER');
  const confirm=page.getByRole('region',{name:'회원 변경 확인'});await expect(confirm).toContainText('학생회 임원');await expect(role).toHaveValue('STUDENT');
  await confirm.getByRole('button',{name:'변경 취소'}).click();await expect(role).toHaveValue('STUDENT');
  await role.selectOption('COUNCIL_OFFICER');await confirm.getByRole('button',{name:'변경 확정'}).click();await expect(role).toHaveValue('COUNCIL_OFFICER');
  await page.reload();await expect(page.getByLabel('이서연 등급',{exact:true})).toHaveValue('COUNCIL_OFFICER');
});

test('suggestion management keeps selected questions in the admin list and filters unanswered work',async({page})=>{
  await choose(page,'학생회 임원');await go(page,'/admin/suggestions');
  await expect(page.getByRole('combobox',{name:'건의 처리 상태',exact:true})).toBeVisible({timeout:15000});await page.getByLabel('미답변 건의만 보기').check();
  const rows=page.locator('tbody tr');await expect(rows).not.toHaveCount(0);
  await rows.first().getByRole('link').click();await expect(page).toHaveURL(/#\/admin\/suggestions\?id=/);
  await expect(page.getByLabel('학생회 답변',{exact:true})).toBeVisible();
});

test('council records handling reasons and the author sees them without exposing private questions',async({page})=>{
  await choose(page);await go(page,'/suggestions/new');
  await page.getByLabel('제목',{exact:true}).fill('도서 공간 개선 요청');await page.getByLabel('건의 내용',{exact:true}).fill('쉬는 시간에 편하게 읽을 수 있는 공간을 마련해 주세요.');
  await page.getByRole('button',{name:'건의·질문 등록'}).click();await page.getByRole('link',{name:'도서 공간 개선 요청',exact:true}).click();const question=page.url();
  await choose(page,'학생회 임원');await page.goto(question);await page.getByRole('button',{name:'처리 상태·담당자 변경'}).click();
  await page.getByRole('combobox',{name:'새 처리 상태',exact:true}).selectOption('REJECTED');await page.getByRole('combobox',{name:'건의 담당자',exact:true}).selectOption('officer');await page.getByLabel('처리 예정일',{exact:true}).fill('2026-12-01');
  await page.getByLabel('처리 사유·결과 안내',{exact:true}).fill('공간 공사가 진행 중이라 현재는 설치할 수 없습니다.');await page.getByRole('button',{name:'처리 내용 저장'}).click();
  await choose(page);await page.goto(question);const workflow=page.getByRole('region',{name:'건의 처리 진행 상황'});await workflow.locator('summary').click();
  await expect(workflow).toContainText('공간 공사가 진행 중이라 현재는 설치할 수 없습니다.');await expect(workflow).toContainText('2026-12-01');await expect(workflow.getByRole('button',{name:'처리 상태·담당자 변경'})).toHaveCount(0);
  await choose(page,'학급 대표 · 반장');await page.goto(question);await expect(page.getByText('공간 공사가 진행 중이라 현재는 설치할 수 없습니다.',{exact:true})).toHaveCount(0);
});

test('approved replies remain readable when their parent comment is awaiting review',async({page})=>{
  await choose(page);await go(page,'/posts/post-1');
  await page.getByLabel('댓글 내용',{exact:true}).fill('같이 읽을 책을 추천해 주시면 좋겠어요.');await page.getByRole('button',{name:'댓글 등록',exact:true}).click();
  await choose(page,'학급 대표 · 반장');await go(page,'/posts/post-1');
  const parent=page.locator('.comment').filter({hasText:'같이 읽을 책을 추천해 주시면 좋겠어요.'});await parent.getByRole('button',{name:'답글',exact:true}).click();
  await page.getByLabel('답글 내용',{exact:true}).fill('도서관 추천 도서 목록도 참고하면 좋겠어요.');await page.getByRole('button',{name:'답글 등록',exact:true}).click();
  await choose(page);await go(page,'/posts/post-1');await page.locator('.comment').filter({hasText:'같이 읽을 책을 추천해 주시면 좋겠어요.'}).getByRole('button',{name:'수정',exact:true}).click();
  await page.getByRole('textbox',{name:'수정 내용',exact:true}).fill('추천 링크는 https://example.com 입니다.');await page.getByRole('button',{name:'수정 저장',exact:true}).click();
  await choose(page,'학급 대표 · 반장');await go(page,'/posts/post-1');
  await expect(page.getByText('도서관 추천 도서 목록도 참고하면 좋겠어요.',{exact:true})).toBeVisible();await expect(page.getByText('원댓글은 현재 표시되지 않습니다.',{exact:true})).toBeVisible();await expect(page.getByText('추천 링크는 https://example.com 입니다.',{exact:true})).toHaveCount(0);
});

test('pledge filters and history show the actual saved status and manual progress',async({page})=>{
  await choose(page,'학생회 회장단');await go(page,'/pledges');await page.getByRole('button',{name:'공약 내용 수정'}).first().click();
  await page.getByLabel('공약 제목',{exact:true}).fill('추진 이력 확인 공약');await page.getByRole('combobox',{name:'진행 상태',exact:true}).selectOption('완료');await page.getByLabel('진행률 (%)',{exact:true}).fill('25');await page.getByRole('textbox',{name:'세부 추진 내용',exact:true}).fill('담당자가 입력한 실제 진행 내용을 보관합니다.');await page.getByRole('button',{name:'공약 변경 저장'}).click();
  await page.getByRole('button',{name:'완료',exact:true}).click();const card=page.locator('.pledge-card').filter({hasText:'추진 이력 확인 공약'});await card.getByText('진행 상황 업데이트 이력',{exact:true}).click();
  await expect(card.locator('.pledge-history')).toContainText('담당자가 입력한 실제 진행 내용을 보관합니다.');await expect(card.locator('.pledge-history')).toContainText('25%');
  await page.reload();await page.locator('.pledge-card').filter({hasText:'추진 이력 확인 공약'}).getByText('진행 상황 업데이트 이력',{exact:true}).click();await expect(page.locator('.pledge-history')).toContainText('추진 이력 확인 공약');
});
