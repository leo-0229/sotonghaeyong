import {describe,expect,it} from 'vitest';
import {localModeration,publicationStatus} from '@/lib/moderation';
import {canMatchMentoring} from '@/lib/domain';
import {createSeed} from '@/lib/seed';
import {inferMutation} from '@/lib/backend';
describe('automated publication policy',()=>{
 it.each(['시발 이건 뭐야','ㅅㅂ 왜이래','https://example.com','example.com/test','www.example.org','너는 정말 한심하다'])('holds suspicious text: %s',text=>{expect(localModeration('게시글 제목',text).length).toBeGreaterThan(0);});
 it.each(['ㅋㅋㅋ','ㅎㅎㅎ','ㄷㄷㄷ','ㅠㅠㅠ','ㅜㅜㅜ','ㅋㅋㅎㅎ','운동장에서 만나요. 오늘도 즐거운 하루예요.'])('does not flag allowed expression: %s',text=>{expect(localModeration('학교 이야기',text)).toEqual([]);});
 it('does not check teacher names or honorifics even if an old roster is supplied',()=>expect(localModeration('학교 이야기','김가람 선생님과 이야기했어요.',['김가람'])).toEqual([]));
 it('never publishes on missing, uncertain or conflicting AI results',()=>{expect(publicationStatus([],null)).toBe('PENDING');expect(publicationStatus([],{safe:true,uncertain:true,reasons:[]})).toBe('PENDING');expect(publicationStatus(['링크'],{safe:true,uncertain:false,reasons:[]})).toBe('PENDING');expect(publicationStatus([],{safe:true,uncertain:false,reasons:['추가 확인']})).toBe('PENDING');});
 it('automatically approves only a clear rule and AI pass',()=>expect(publicationStatus([],{safe:true,uncertain:false,reasons:[]})).toBe('APPROVED'));
});
describe('school life matching',()=>{
 const s=createSeed();const a={id:'a',memberId:'president',kind:'멘토' as const,time:'점심',goal:'학교생활 안내',status:'매칭 대기'};const b={id:'b',memberId:'student',kind:'멘티' as const,time:'점심',goal:'학교생활 도움',status:'매칭 대기'};
 it('allows same-gender 1:1 regardless of subjects',()=>expect(canMatchMentoring(a,b,s.members)).toBe(true));
 it('rejects other genders, unknown genders and a second match',()=>{expect(canMatchMentoring(a,{...b,memberId:'officer'},s.members)).toBe(false);expect(canMatchMentoring(a,b,s.members.map(m=>m.id==='student'?{...m,gender:undefined}:m))).toBe(false);expect(canMatchMentoring({...a,status:'매칭 완료'},b,s.members)).toBe(false);});
 it('does not start with a logged-in account',()=>expect(createSeed().currentMemberId).toBeNull());
 it('sends only the edited pledge to a typed mutation',()=>{const next=structuredClone(s);next.pledges[0].details='실제 추진 내용을 수정했습니다.';expect(inferMutation(s,next,s.members[4])).toMatchObject({operation:'save_pledge',payload:{pledge:{id:'p1',details:'실제 추진 내용을 수정했습니다.'}}});});
});
