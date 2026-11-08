import {expect,test,type Page} from '@playwright/test';
const go=(page:Page,path:string)=>page.goto('/#'+path);
async function choose(page:Page,label:string){await go(page,'/login');await page.locator('.demo-accounts button').filter({hasText:label}).click();await expect(page.locator('.login-main')).toHaveCount(0);}
async function question(page:Page,title:string){await go(page,'/suggestions/new');await page.getByLabel('제목',{exact:true}).fill(title);await page.getByLabel('건의 내용').fill('도서관 이용 안내를 더 자세히 알려 주시면 좋겠어요.');await page.getByRole('button',{name:'건의·질문 등록',exact:true}).click();await page.getByRole('link',{name:title,exact:true}).click();}
test.beforeEach(async({page})=>{await page.clock.install({time:new Date('2026-11-09T09:00:00+09:00')});});

test('authors edit question fields, keep one question and requeue suspicious replacements',async({page})=>{
 await choose(page,'일반 학생');await question(page,'도서관 건의 수정 확인');await page.clock.runFor(1000);
 await page.getByRole('button',{name:'건의 수정',exact:true}).click();await expect(page.getByLabel('제목',{exact:true})).toHaveValue('도서관 건의 수정 확인');
 await page.getByLabel('제목',{exact:true}).fill('수정한 도서관 건의 확인');await page.getByLabel('건의 분야').selectOption('기타');await page.getByLabel('공개 범위').selectOption('PUBLIC');await page.getByLabel('건의 내용').fill('도서관 좌석 안내를 학생들에게 자세히 알려 주시면 좋겠어요.');await page.getByRole('button',{name:'수정 내용 저장',exact:true}).click();
 await expect(page.getByRole('heading',{name:'수정한 도서관 건의 확인',exact:true})).toBeVisible();await expect(page.locator('article .muted').first()).toContainText('수정');await expect(page.getByRole('link',{name:'도서관 건의 수정 확인',exact:true})).toHaveCount(0);
 await choose(page,'학급 대표 · 반장');await go(page,'/suggestions');await page.getByRole('link',{name:'수정한 도서관 건의 확인',exact:true}).click();await expect(page.getByRole('button',{name:'건의 수정',exact:true})).toHaveCount(0);
 await choose(page,'일반 학생');await go(page,'/suggestions/mine');await page.getByRole('link',{name:'수정한 도서관 건의 확인',exact:true}).click();await page.getByRole('button',{name:'건의 수정',exact:true}).click();await page.getByLabel('건의 내용').fill('자세한 안내 링크는 https://example.com 에서 확인해 주세요.');await page.getByRole('button',{name:'수정 내용 저장',exact:true}).click();await expect(page.getByText('공개 검토 중입니다.',{exact:true})).toBeVisible();
 await choose(page,'학급 대표 · 반장');await go(page,'/suggestions');await expect(page.getByRole('link',{name:'수정한 도서관 건의 확인',exact:true})).toHaveCount(0);
});

test('own comments can be edited and flagged edits disappear from another member view',async({page})=>{
 await choose(page,'일반 학생');await go(page,'/posts/post-4');await page.getByLabel('댓글 내용',{exact:true}).fill('댓글 수정 흐름을 확인하는 내용입니다.');await page.getByRole('button',{name:'댓글 등록',exact:true}).click();
 const comment=page.locator('.comments .comment').filter({hasText:'댓글 수정 흐름을 확인하는 내용입니다.'});await comment.getByRole('button',{name:'수정',exact:true}).click();await comment.getByLabel('수정 내용').fill('댓글에 외부 링크 https://example.com 를 추가해요.');await comment.getByRole('button',{name:'수정 저장',exact:true}).click();await expect(page.locator('.comments .comment').filter({hasText:'댓글에 외부 링크 https://example.com 를 추가해요.'}).getByText('승인 대기',{exact:true})).toBeVisible();
 await choose(page,'학급 대표 · 반장');await go(page,'/posts/post-4');await expect(page.getByText('댓글에 외부 링크 https://example.com 를 추가해요.',{exact:true})).toHaveCount(0);
});

test('council edits its own answer and private replies cannot be exposed by question edits',async({page})=>{
 await choose(page,'일반 학생');await question(page,'답변 수정과 비공개 전환 보호');
 await choose(page,'학생회 임원');await go(page,'/admin/suggestions');await page.getByRole('link',{name:'답변 수정과 비공개 전환 보호',exact:true}).click();await page.getByLabel('학생회 답변',{exact:true}).fill('도서관 운영 안내를 확인하여 전달하겠습니다.');await page.getByRole('button',{name:'답변 등록',exact:true}).click();
 const answer=page.locator('article .comment').filter({hasText:'도서관 운영 안내를 확인하여 전달하겠습니다.'});await answer.getByRole('button',{name:'수정',exact:true}).click();await answer.getByLabel('수정 내용').fill('답변 참고 링크 https://example.com 를 안내합니다.');await answer.getByRole('button',{name:'수정 저장',exact:true}).click();await expect(page.locator('article .comment').filter({hasText:'답변 참고 링크 https://example.com 를 안내합니다.'}).getByText('승인 대기',{exact:true})).toBeVisible();
 await choose(page,'일반 학생');await go(page,'/suggestions/mine');await page.getByRole('link',{name:'답변 수정과 비공개 전환 보호',exact:true}).click();await expect(page.getByText('답변 참고 링크 https://example.com 를 안내합니다.',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'건의 수정',exact:true}).click();await page.getByLabel('공개 범위').selectOption('PUBLIC');await page.getByRole('button',{name:'수정 내용 저장',exact:true}).click();await expect(page.getByRole('status')).toContainText('답변이 달린 비공개 건의는 공개로 바꿀 수 없습니다.');await expect(page.getByRole('heading',{name:'건의·질문 수정',exact:true})).toBeVisible();
});
