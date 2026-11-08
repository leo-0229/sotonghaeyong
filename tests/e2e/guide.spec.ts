import {expect, test} from '@playwright/test';

test('guide requires login and explains own deletion versus L4 moderation on mobile', async ({page}) => {
  await page.goto('/#/guide');
  await expect(page.getByRole('heading', {name: '체험 계정으로 둘러보기'})).toBeVisible();
  await expect(page.getByRole('heading', {name: '레벨별 권한'})).toHaveCount(0);
  await page.locator('.demo-accounts button').filter({hasText: '일반 학생'}).click();
  await page.goto('/#/guide');
  await expect(page.getByRole('heading', {name: '이용 가이드', exact: true})).toBeVisible();
  const levels = page.getByRole('group', {name: '레벨 안내 선택'});
  await expect(levels.getByRole('button', {name: /^L1/})).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('본인 게시글 수정·삭제, 본인 댓글 삭제', {exact: true})).toBeVisible();
  await levels.getByRole('button', {name: /^L4/}).click();
  await expect(page.getByText('다른 사람의 게시글·댓글 강제 삭제: 5자 이상 사유와 확인 필요', {exact: true})).toBeVisible();
  await expect(page.getByRole('link', {name: '회원 · 계정 관리', exact: true})).toHaveCount(0);
  await page.setViewportSize({width: 390, height: 844});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', {name: '게시판 메뉴 열기'}).click();
  await page.getByRole('link', {name: '레벨별 이용 가이드'}).click();
  await expect(page.locator('.sidebar-open')).toHaveCount(0);
});

test('L5 guide defaults to teacher and preserves council role exceptions', async ({page}) => {
  await page.goto('/');
  await page.locator('.demo-accounts button').filter({hasText: '담당 교사'}).click();
  await page.getByRole('link', {name: '이용 가이드', exact: true}).click();
  await expect(page.getByRole('group', {name: '레벨 안내 선택'}).getByRole('button', {name: /^L5/})).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('L5는 학생회 역할이 아니므로 다른 회원의 학생회 개인 채널을 읽거나 학생회 공식 답변을 작성할 수 없습니다.', {exact: true})).toBeVisible();
  await page.goto('/#/about');
  await expect(page.getByRole('heading', {name: '이용 가이드', exact: true})).toBeVisible();
});
