import {expect,test,type Page} from '@playwright/test';
const go=(page:Page,path:string)=>page.goto('/#'+path);
async function choose(page:Page,label:string){await go(page,'/login');await page.locator('.demo-accounts button').filter({hasText:label}).click();await expect(page.locator('.login-main')).toHaveCount(0);}
async function pendingPost(page:Page,title:string){await go(page,'/posts/write');await page.getByLabel('제목',{exact:true}).fill(title);await page.getByLabel('내용',{exact:true}).fill('안내 내용은 https://example.com 에서 확인할 수 있습니다.');await page.getByRole('button',{name:'게시글 등록',exact:true}).click();await expect(page.locator('.article-category')).toContainText('승인 대기');return page.url();}
async function reject(page:Page,title:string){await go(page,'/admin/posts');const card=page.locator('.post-review').filter({hasText:title});await card.getByLabel('반려 사유').fill('외부 링크 대신 필요한 내용을 직접 적어 주세요.');await card.getByRole('button',{name:'반려',exact:true}).click();}
test.beforeEach(async({page})=>{await page.clock.install({time:new Date('2026-11-14T12:00:00+09:00')});});

test('authors see rejection attribution and L3 can republish after reconsideration',async({page})=>{
 await choose(page,'일반 학생');const url=await pendingPost(page,'반려 처리자와 사유 확인');await choose(page,'학생회 임원');await reject(page,'반려 처리자와 사유 확인');
 await choose(page,'일반 학생');await page.goto(url);const note=page.getByRole('note',{name:'게시글 반려 안내'});await expect(note).toContainText('반려한 운영진: 최도윤');await expect(note).toContainText('외부 링크 대신 필요한 내용을 직접 적어 주세요.');await expect(note).toContainText('처리 시각:');
 await choose(page,'학급 대표 · 반장');await page.goto(url);await expect(page.getByRole('note',{name:'게시글 반려 안내'})).toHaveCount(0);await expect(page.getByText('외부 링크 대신 필요한 내용을 직접 적어 주세요.',{exact:true})).toHaveCount(0);
 await choose(page,'학생회 임원');await go(page,'/admin/posts');await page.locator('.filter-tabs').getByRole('button',{name:'반려',exact:true}).click();const card=page.locator('.post-review').filter({hasText:'반려 처리자와 사유 확인'});await expect(card.getByRole('note')).toContainText('최도윤');await card.getByRole('button',{name:'재검토 후 공개',exact:true}).click();
 await choose(page,'일반 학생');await page.goto(url);await expect(page.locator('.article-category')).toContainText('승인 완료');await expect(page.getByRole('note',{name:'게시글 반려 안내'})).toHaveCount(0);
});

test('a moderator cannot republish their own rejected post',async({page})=>{
 await choose(page,'학생회 임원');await pendingPost(page,'본인 글 재승인 금지 확인');await choose(page,'학생회 회장단');await reject(page,'본인 글 재승인 금지 확인');
 await choose(page,'학생회 임원');await go(page,'/admin/posts');await page.locator('.filter-tabs').getByRole('button',{name:'반려',exact:true}).click();await expect(page.locator('.post-review').filter({hasText:'본인 글 재승인 금지 확인'}).getByRole('button',{name:'재검토 후 공개',exact:true})).toBeDisabled();
});
