import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {localModeration} from '@/lib/moderation';
import {reviewContent} from '../../supabase/functions/_shared/content-review';

describe('reported moderation regressions',()=>{
 it('queues the entire pasted abuse/sexual dictionary',()=>{const result=reviewContent('사전 본문 검사 확인',readFileSync('supabase/functions/_shared/content-rules.ts','utf8'));expect(result).toMatchObject({status:'PENDING',rulesVerified:false});expect(result.reasons).toContain('욕설·혐오 의심 표현');expect(result.reasons).toContain('성적·성 관련 민감 표현');});
 it.each(['이1새1끼','이 새 끼','새123끼','새\u200b끼','ㅅㅐㄲㅣ','t o R l','이1새1기','씨1발','섹1스'])('queues evasion: %s',text=>expect(reviewContent('내용 검사',text).status).toBe('PENDING'));
 it.each(['재기하다','재기해','여시','펨코','일베','디시','운지','우흥','북','딱','예아','북 딱 예아','북1딱','여1시','디1시'])('queues specified slang: %s',text=>expect(localModeration('내용 검사',text)).toContain('지정 은어·커뮤니티 관련 표현 · 운영진 확인 필요'));
 it.each(['이서연','이1서1연','이 서 연','서연','서1연','서연이','이서연'.normalize('NFD')])('queues only supplied registered names: %s',text=>expect(localModeration('친구 이야기',text,['이서연'])).toContain('회원 이름 포함 · 운영진 확인 필요'));
 it.each(['김민수','민수','허가온','가온','지원','사랑','수정','준','허준'])('does not hold an unregistered ordinary name: %s',text=>expect(localModeration('학교 이야기',text,['이서연'])).toEqual([]));
 it('checks runtime name changes on the next request',()=>{expect(reviewContent('학교 이야기','김민수와 함께 책을 읽어요.').status).toBe('APPROVED');expect(reviewContent('학교 이야기','김민수와 함께 책을 읽어요.',['김민수']).status).toBe('PENDING');});
 it('does not assemble a name across title and body',()=>expect(localModeration('이서','연과 함께 이야기해요.',['이서연'])).not.toContain('회원 이름 포함 · 운영진 확인 필요'));
 it.each(['씌발','야스','질싸','성노예','느그부모','sibal','bozi'])('uses attributed Korcen literal data: %s',text=>expect(reviewContent('내용 검사',text).status).toBe('PENDING'));
});
