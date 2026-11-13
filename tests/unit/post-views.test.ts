import {describe,it,expect} from 'vitest';
import {getPopularPosts,viewDate} from '../../src/lib/post-views';
import type {Post} from '../../src/lib/domain';
const post=(id:string,views:number,extra:Partial<Post>={}):Post=>({id,views,board:'free',title:id,content:'게시글 내용입니다.',date:'2026-11-14T00:00:00Z',authorId:'author',author:'가상회원',status:'APPROVED',comments:[],...extra});
describe('post view dates and popularity',()=>{
 it('changes the view date at Korean midnight',()=>{expect(viewDate(new Date('2026-11-14T14:59:59Z'))).toBe('2026-11-14');expect(viewDate(new Date('2026-11-14T15:00:00Z'))).toBe('2026-11-15');});
 it('keeps drafts and pending content out even with higher counters',()=>{expect(getPopularPosts([post('public',2),post('pending',900,{status:'PENDING'}),post('hidden',1000,{status:'HIDDEN'}),post('draft',1001,{status:'DRAFT'})]).map(p=>p.id)).toEqual(['public']);});
 it('ranks by views without boosting pinned notices',()=>{expect(getPopularPosts([post('notice',1,{pinned:true}),post('regular',20)]).map(p=>p.id)).toEqual(['regular','notice']);});
 it('uses latest creation time and then id for tied counts',()=>{expect(getPopularPosts([post('old',5,{date:'2026-11-13T00:00:00Z'}),post('b',5),post('a',5)]).map(p=>p.id)).toEqual(['a','b','old']);});
 it('omits unread posts and does not reorder the input array',()=>{const input=[post('a',1),post('b',2),post('unread',0)];expect(getPopularPosts(input).map(p=>p.id)).toEqual(['b','a']);expect(input.map(p=>p.id)).toEqual(['a','b','unread']);});
});
