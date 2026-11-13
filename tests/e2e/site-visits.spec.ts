import {expect,test,type Page} from '@playwright/test';
const go=(page:Page,path:string)=>page.goto('/#'+path);
async function choose(page:Page,label:string){await go(page,'/login');await page.locator('.demo-accounts button').filter({hasText:label}).click();await expect(page.locator('.login-main')).toHaveCount(0);}
async function counts(page:Page,today:number,peak:number,total:number){const widget=page.getByRole('region',{name:'사이트 방문 통계'});await expect(widget.locator('dd').nth(0)).toHaveText(String(today));await expect(widget.locator('dd').nth(1)).toHaveText(String(peak));await expect(widget.locator('dd').nth(2)).toHaveText(String(total));}
test.beforeEach(async({page})=>{await page.clock.install({time:new Date('2026-11-14T23:59:30+09:00')});});

test('site counters require login and deduplicate routes, reloads and repeated logins',async({page})=>{
 await go(page,'/');await expect(page.getByRole('region',{name:'사이트 방문 통계'})).toHaveCount(0);await choose(page,'일반 학생');await counts(page,1,1,1);
 await go(page,'/events');await counts(page,1,1,1);await page.reload();await counts(page,1,1,1);
 await page.getByRole('button',{name:'방문 통계 새로고침',exact:true}).click();await counts(page,1,1,1);
 await choose(page,'학급 대표 · 반장');await counts(page,2,2,2);await choose(page,'일반 학생');await counts(page,2,2,2);
});

test('Korean midnight adds one visit to the total and retains the daily peak',async({page})=>{
 await choose(page,'일반 학생');await counts(page,1,1,1);await choose(page,'학급 대표 · 반장');await counts(page,2,2,2);
 await page.clock.runFor(60000);await counts(page,1,2,3);await page.getByRole('button',{name:'방문 통계 새로고침',exact:true}).click();await counts(page,1,2,3);
});

test('site visitor statistics fit a narrow mobile screen',async({page})=>{
 await choose(page,'일반 학생');await page.setViewportSize({width:360,height:844});await counts(page,1,1,1);await expect(page.getByRole('region',{name:'사이트 방문 통계'})).toContainText('계정당 하루 1회');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
