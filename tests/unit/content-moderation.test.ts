import {describe,it,expect} from 'vitest';
import {localModeration,publicationStatus} from '@/lib/moderation';
describe('school content moderation',()=>{
 it.each(['씨 발','씨 1 발','씨123발','씨.발','씨-발','씨\u200b발','씨\u200d발','ㅅㅣㅂㅏㄹ','tlqkf','Tlqkf','TLQKF','ｔｌｑｋｆ','t l q k f','개.새.끼','병1신','qudtls','느금마','짱깨','한남충','맘충','ㅅㅂ','ㅂㅅ','f u c k','f1u2c3k'])('flags profanity and evasion: %s',value=>{
  expect(localModeration('내용 검사',value)).toContain('욕설·혐오 의심 표현');
 });
 it.each(['섹스','섹1스','ㅅㅔㄱㅅㅡ','tprtm','야 1 동','포르노','자위','성관계','강간','성착취','음경','보지','자지','s e x','p o r n'])('flags sexual terms: %s',value=>{
  expect(localModeration('내용 검사',value)).toContain('성적·성 관련 민감 표현');
 });
 it.each(['ㅋㅋㅋ','ㅎㅎㅎ','ㄷㄷㄷ','ㅠㅠㅠ','ㅜㅜㅜ','ㅋㅋㅎㅎㅠㅠ','ㄱㅅ','ㅇㅇ','ㅇㅋ','ㄴㄴ','ㅊㅋ','ㄹㅇ','ㅎㄱㅈ','없습니다. 감사합니다.','밥상에 과일이 있어요.','개발 수업이 재미있어요.','시발점이 되는 행사입니다.','보지 못했습니다.','잠자지 못했어요.','게이도 다른 친구와 똑같이 존중해요.','성소수자 차별을 반대합니다.','class project','Sussex','김가람 선생님과 상담했어요.'])('allows ordinary or short expressions: %s',value=>{
  expect(localModeration('학교 이야기',value)).toEqual([]);
 });
 it('does not form a prohibited word across title and body boundaries',()=>expect(localModeration('시','발')).toEqual([]));
 it('checks the title too',()=>expect(localModeration('씨1발','안전한 게시글 본문입니다.')).toContain('욕설·혐오 의심 표현'));
 it('still queues every post after a rule pass',()=>expect(publicationStatus([],null)).toBe('PENDING'));
});
