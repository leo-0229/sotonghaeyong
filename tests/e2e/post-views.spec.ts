import {expect,test,type Page} from '@playwright/test';
const go=(page:Page,path:string)=>page.goto('/#'+path);
async function choose(page:Page,label:string){await go(page,'/login');await page.locator('.demo-accounts button').filter({hasText:label}).click();await expect(page.locator('.login-main')).toHaveCount(0);}
test.beforeEach(async({page})=>{await page.clock.install({time:new Date('2026-11-14T12:00:00+09:00')});});

test('reading counts once per member per day and survives reload',async({page})=>{
 await go(page,'/popular');await expect(page.getByRole('heading',{name:'체험 계정으로 둘러보기'})).toBeVisible();await expect(page.getByRole('heading',{name:'인기글',exact:true})).toHaveCount(0);
 await choose(page,'일반 학생');await go(page,'/boards/free');const row=page.getByRole('row').filter({hasText:'이번 문산제에 어떤 부스가 있으면 좋을까요?'});const baseline=Number(await row.locator('td').nth(4).innerText());
 await row.getByRole('link').click();await expect(page.locator('.article-meta')).toContainText('조회 '+(baseline+1));await expect(page.locator('.article-meta time')).toHaveCount(1);
 await page.reload();await expect(page.locator('.article-meta')).toContainText('조회 '+(baseline+1));
 await go(page,'/boards/free');await expect(row.locator('td').nth(4)).toHaveText(String(baseline+1));
 await choose(page,'학급 대표 · 반장');await go(page,'/posts/post-4');await expect(page.locator('.article-meta')).toContainText('조회 '+(baseline+2));
});

test('authors do not inflate their own post counter',async({page})=>{
 await choose(page,'일반 학생');await go(page,'/posts/write');await page.getByLabel('제목',{exact:true}).fill('본인 글 조회수 확인');await page.getByLabel('내용',{exact:true}).fill('내가 작성한 글을 읽으면 조회수를 올리지 않는지 확인합니다.');await page.getByRole('button',{name:'게시글 등록',exact:true}).click();
 await expect(page.locator('.article-meta')).toContainText('조회 0');const url=page.url();
 await page.reload();await expect(page.locator('.article-meta')).toContainText('조회 0');
 await choose(page,'학급 대표 · 반장');await page.goto(url);await expect(page.locator('.article-meta')).toContainText('조회 1');
 await choose(page,'일반 학생');await page.goto(url);await expect(page.locator('.article-meta')).toContainText('조회 1');
});

test('home shows top five and popularity stays ranked and readable on mobile',async({page})=>{
 await choose(page,'일반 학생');await go(page,'/');const preview=page.getByRole('region',{name:'인기글 미리보기'});await expect(preview.getByRole('heading',{name:'인기글 TOP 5'})).toBeVisible();await expect(preview.locator('tbody tr')).toHaveCount(5);
 await preview.getByRole('link',{name:/전체 보기/}).click();await expect(page.getByRole('heading',{name:'인기글',exact:true})).toBeVisible();await expect(page.getByRole('columnheader',{name:'순위',exact:true})).toBeVisible();
 const counts=await page.locator('tbody tr').evaluateAll(rows=>rows.map(row=>Number(row.children[4].textContent)));expect(counts).toEqual([...counts].sort((a,b)=>b-a));await expect(page.locator('tbody tr').first().locator('td').first()).toHaveText('1');
 await expect(page.getByRole('link',{name:/친구들과 함께하는 독서 모임을 만들고 싶어요/})).toHaveCount(0);
 await page.setViewportSize({width:360,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.locator('tbody tr').first()).toContainText('조회');
});
