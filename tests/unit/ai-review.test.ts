import {afterEach,describe,it,expect,vi} from 'vitest';
import {reviewContent} from '../../supabase/functions/_shared/ai-review';
afterEach(()=>vi.unstubAllGlobals());
function mockAI(value:unknown){const fetcher=vi.fn(async()=>new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(value)}]}]}),{status:200}));vi.stubGlobal('fetch',fetcher);return fetcher;}
describe('automatic approval service boundary',()=>{
 it('approves a clear AI result after local rules pass',async()=>{const fetcher=mockAI({safe:true,uncertain:false,reasons:[]});expect(await reviewContent('학교 이야기','도서관에서 책을 함께 읽어요.','unit-key','unit-model')).toMatchObject({status:'APPROVED',aiVerified:true,reasons:[]});expect(fetcher).toHaveBeenCalledOnce();});
 it('never lets AI override an explicit abusive rule match',async()=>{const fetcher=mockAI({safe:true,uncertain:false,reasons:[]});expect(await reviewContent('제목입니다','씨1발 이라는 표현을 사용했습니다.','unit-key','unit-model')).toMatchObject({status:'PENDING',aiVerified:false});expect(fetcher).not.toHaveBeenCalled();});
 it('queues content when AI has not been connected',async()=>{const fetcher=mockAI({safe:true,uncertain:false,reasons:[]});expect(await reviewContent('학교 이야기','도서관에서 책을 함께 읽어요.')).toMatchObject({status:'PENDING',aiVerified:false});expect(fetcher).not.toHaveBeenCalled();});
 it('queues uncertainty or malformed AI responses',async()=>{mockAI({safe:true,uncertain:true,reasons:[]});expect((await reviewContent('학교 이야기','도서관에서 책을 함께 읽어요.','unit-key','unit-model')).status).toBe('PENDING');mockAI({safe:'true',uncertain:false,reasons:[]});expect((await reviewContent('학교 이야기','도서관에서 책을 함께 읽어요.','unit-key','unit-model')).status).toBe('PENDING');});
});
