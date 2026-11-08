import {describe,it,expect} from 'vitest';
import {sealTemporaryPassword,openTemporaryPassword} from '../../supabase/functions/_shared/temporary-vault';
describe('temporary password encryption',()=>{
 const secret='19'.repeat(32);
 it('encrypts passwords with a fresh IV and decrypts only for the intended user',async()=>{
  const a=await sealTemporaryPassword(secret,'user-1','testPass8');
  const b=await sealTemporaryPassword(secret,'user-1','testPass8');
  expect(a).not.toContain('testPass8');expect(a).not.toEqual(b);
  expect(await openTemporaryPassword(secret,'user-1',a)).toBe('testPass8');
  await expect(openTemporaryPassword(secret,'user-2',a)).rejects.toThrow();
  await expect(openTemporaryPassword('28'.repeat(32),'user-1',a)).rejects.toThrow();
 });
 it('rejects missing or invalid server keys',async()=>{await expect(sealTemporaryPassword('','user','testPass8')).rejects.toThrow();});
});
