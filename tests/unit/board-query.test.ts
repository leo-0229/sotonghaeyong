import {describe,expect,it} from 'vitest';
import {boardQuery,readBoardQuery,pageWindow} from '../../src/lib/board-query';

describe('reloadable board filters',()=>{
  it('round trips Korean searches and punctuation without changing their meaning',()=>{
    const value={q:'도서관 & 추천?',sort:'views',prefix:'value:궁금해용',board:'question',page:3};
    expect(readBoardQuery(new URLSearchParams(boardQuery(value)))).toEqual(value);
  });
  it.each(['-1','0','NaN','Infinity','1.5','999999999999999999999'])('normalizes invalid page %s',page=>{
    expect(readBoardQuery(new URLSearchParams({page,sort:'invalid',board:'private'}))).toMatchObject({page:1,sort:'latest',board:'all'});
  });
  it('limits search length and leaves default URLs uncluttered',()=>{
    expect(readBoardQuery(new URLSearchParams({q:'a'.repeat(500)})).q).toHaveLength(200);
    expect(boardQuery(readBoardQuery(new URLSearchParams()))).toBe('');
  });
  it('keeps navigation bounded even for very large result sets',()=>{
    expect(pageWindow(1,1)).toEqual([1]);
    expect(pageWindow(1,10000)).toEqual([1,2,3,4,5]);
    expect(pageWindow(5000,10000)).toEqual([4998,4999,5000,5001,5002]);
    expect(pageWindow(10000,10000)).toEqual([9996,9997,9998,9999,10000]);
  });
});
