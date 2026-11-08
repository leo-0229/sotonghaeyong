import {afterEach,describe,it,expect,vi} from 'vitest';
import {reviewContent} from '../../supabase/functions/_shared/content-review';

afterEach(()=>vi.unstubAllGlobals());
describe('rule-only automatic approval',()=>{
 it('approves ordinary content without an API key or network request',()=>{
  const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
  expect(reviewContent('학교 이야기','도서관에서 책을 함께 읽어요.')).toEqual({status:'APPROVED',rulesVerified:true,reasons:[]});
  expect(fetcher).not.toHaveBeenCalled();
 });
 it.each(['씨 1 발 이라는 표현입니다.','쌤과 상담하고 싶어요.','썜과 상담하고 싶어요.','선생님께 질문합니다.','선생 관련 질문입니다.','교사에게 문의합니다.','https://example.com','010-0000-0000'])('queues flagged content: %s',text=>{
  expect(reviewContent('질문합니다',text)).toMatchObject({status:'PENDING',rulesVerified:false});
  expect(reviewContent('질문합니다',text).reasons.length).toBeGreaterThan(0);
 });
 it('checks titles as well as bodies',()=>expect(reviewContent('선생님께 궁금해요','학교생활을 잘하고 싶은 마음입니다.').status).toBe('PENDING'));
});
