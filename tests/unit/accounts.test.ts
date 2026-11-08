import {describe,it,expect} from 'vitest';
import {authEmail,normalizeLoginId,parseStudentId,temporaryCredentials,validateCredentials} from '@/lib/accounts';
import {level,type Member} from '@/lib/domain';
describe('issued account identity',()=>{
 it('parses the five-digit grade-room-number format',()=>{expect(parseStudentId('21421')).toEqual({studentId:'21421',classId:'2-14',grade:2,room:14,number:21});expect(parseStudentId('10101').number).toBe(1);});
 it.each(['0000','2315','20015','23100','231000','abc','2-14-21'])('rejects invalid ID %s',id=>expect(()=>parseStudentId(id)).toThrow());
 it('generates independent temporary IDs and passwords without identity data',()=>{const a=temporaryCredentials(),b=temporaryCredentials();expect(a.loginId).toMatch(/^tmp_[a-z0-9]{16}$/);expect(a.password.length).toBeGreaterThanOrEqual(24);expect(a).not.toEqual(b);expect(a.password).not.toContain(a.loginId);});
 it('requires a new ID and a different 12-character password',()=>{expect(validateCredentials('tmp_demo','my_new_id','OldPass!2026','MyNewPass!2026')).toBe('my_new_id');expect(()=>validateCredentials('tmp_demo','tmp_other','OldPass!2026','MyNewPass!2026')).toThrow();expect(()=>validateCredentials('my_user','my_user','OldPass!2026','MyNewPass!2026')).toThrow();expect(()=>validateCredentials('tmp_demo','new_user','samepassword12','samepassword12')).toThrow();expect(()=>validateCredentials('tmp_demo','new_user','oldpassword12','short')).toThrow();});
 it('maps only the normalized ID to an internal non-delivery Auth address',()=>{expect(normalizeLoginId(' My_Name ')).toBe('my_name');expect(authEmail(' My_Name ')).toBe('my_name@accounts.mpms.invalid');});
 it('does not grant community permissions before first login completion',()=>{const m:Member={id:'temp',name:'가상학생',classId:'2-3',role:'COUNCIL_EXECUTIVE',status:'ACTIVE',mustChangeCredentials:true};expect(level(m)).toBe(0);expect(level({...m,mustChangeCredentials:false})).toBe(4);});
});
