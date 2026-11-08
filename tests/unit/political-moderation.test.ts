import {describe,it,expect} from 'vitest';
import {localModeration} from '@/lib/moderation';
import {reviewContent} from '../../supabase/functions/_shared/content-review';
import {KOREAN_PRESIDENT_NAMES} from '../../supabase/functions/_shared/political-rules';

const reason='정치·이념·정치인 관련 표현 · 운영진 확인 필요';
describe('political content review',()=>{
 it.each(['좌빨','극우','페미','남혐','여혐','보수','진보','좌익','우익','좌파','우파','극좌','대통령','총리','정치인','보좌관','김현지','트럼프','무솔리니','히틀러','나치','파시즘','포퓰리즘','국민의힘','더불어민주당','개혁신당','조국혁신당','한동훈','정청래','나경원','홍준표','박찬대','이준석','심상정'])('queues a requested political reference: %s',term=>{
  expect(localModeration('학교 이야기',term+'에 대해 이야기합니다.')).toContain(reason);
  expect(reviewContent('학교 이야기',term+'에 대해 이야기합니다.')).toMatchObject({status:'PENDING',rulesVerified:false});
 });
 it.each(KOREAN_PRESIDENT_NAMES)('queues Korean president name: %s',name=>expect(localModeration(name,'역사 수업에서 읽은 이야기입니다.')).toContain(reason));
 it.each(['이 재 명','윤1석2열','김\u200b현지','좌.파','극_우','ㅌㅡㄹㅓㅁㅍㅡ','dlwoaud','rla gus wl','히틀러'.normalize('NFD'),'ＴＲＵＭＰ','Hitler','Mussolini','Nazism','fascism','populism'])('handles normalized and alternative forms: %s',text=>expect(localModeration('내용 검사',text)).toContain(reason));
 it('never joins separate title/body fragments into a political term',()=>expect(localModeration('김현','지와 도서관에서 만났어요.')).not.toContain(reason));
 it('reports the category once even with multiple terms',()=>expect(localModeration('좌파와 우파','보수 진보 대통령 김현지').filter(r=>r===reason)).toHaveLength(1));
 it.each(['학생회 회장 선거 공약을 소개합니다.','학생회 행사에 투표해 주세요.','반장 후보를 응원합니다.','지나치게 시끄럽지 않게 이야기해요.','지나친 소음은 줄여 주세요.','길을 지나칠 때 주변을 살펴요.','복도를 지나칩니다.','시장에 가서 간식을 샀어요.','의원에서 진료를 받았어요.','학교생활 이야기를 함께 나눠요. ㅋㅋㅋ'])('keeps ordinary school participation and unrelated text clear: %s',text=>{
  expect(localModeration('학교 이야기',text)).toEqual([]);
  expect(reviewContent('학교 이야기',text).status).toBe('APPROVED');
 });
 it('queues an exact requested name even in an ordinary classmate context',()=>expect(localModeration('친구 이야기','김현지와 도서관에서 책을 읽었어요.')).toContain(reason));
});
