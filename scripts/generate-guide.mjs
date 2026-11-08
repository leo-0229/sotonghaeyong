import {readFile, writeFile} from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const content = JSON.parse(await readFile(new URL('src/lib/guide-content.json', root), 'utf8'));
const target = new URL('guide.md', root);
const existing = (await readFile(target, 'utf8')).replaceAll('\r\n', '\n');
const marker = '<!-- GENERATED-GUIDE-END -->';
if (!existing.includes(marker)) throw new Error('guide.md is missing the generated section boundary.');
const parts = ['# 소통해용 이용·운영 가이드', '', '사이트의 이용 가이드와 같은 규칙입니다. 로그인 후 왼쪽 **레벨별 이용 가이드**에서 내 계정의 권한을 확인할 수 있습니다.', '', '## 레벨별 권한', '', '레벨은 담당 업무를 구분합니다. 높은 레벨이 모든 역할을 대신하지는 않습니다. 특히 학급 제출은 L2, 학생회 공식 답변은 L3·L4가 담당합니다.', ''];
for (const item of content.levels) {
  parts.push(`### L${item.level} · ${item.label}`, '', '할 수 있는 일:', '', ...item.can.map(text => `- ${text}`), '', '꼭 확인할 규칙:', '', ...item.limits.map(text => `- ${text}`), '');
}
for (const section of content.sections) parts.push(`## ${section.title}`, '', ...section.paragraphs.flatMap(text => [text, '']));
const next = parts.join('\n') + '\n' + existing.slice(existing.indexOf(marker));
if (process.argv.includes('--check')) {
  if (existing !== next) {console.error('guide.md is out of date. Run npm run docs:generate.'); process.exitCode = 1;}
  else console.log('Guide content matches the website.');
} else {await writeFile(target, next); console.log('Generated guide.md from shared website rules.');}
