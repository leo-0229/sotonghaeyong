import {describe,it,expect} from 'vitest';
import {authEmail,normalizeLoginId,parseStudentId,temporaryCredentials,validateCredentials} from '@/lib/accounts';
import {level,type Member} from '@/lib/domain';
describe('issued account identity',()=>{
 it('normalizes 4- and 5-digit student IDs without losing the number',()=>{expect(parseStudentId('2315')).toEqual({studentId:'20315',classId:'2-3',grade:2,room:3,number:15});expect(parseStudentId('20315')).toEqual(parseStudentId('2315'));expect(parseStudentId('10101').number).toBe(1);});
 it.each(['0000','20715','20300','3915','203150','abc','2-3-15'])('rejects invalid ID %s',id=>expect(()=>parseStudentId(id)).toThrow());
 it('generates independent temporary IDs and passwords without identity data',()=>{const a=temporaryCredentials(),b=temporaryCredentials();expect(a.loginId).toMatch(/^tmp_[a-z0-9]{16}$/);expect(a.password.length).toBeGreaterThanOrEqual(24);expect(a).not.toEqual(b);expect(a.password).not.toContain(a.loginId);});
 it('requires a new ID and a different 12-character password',()=>{expect(validateCredentials('tmp_demo','my_new_id','OldPass!2026','MyNewPass!2026')).toBe('my_new_id');expect(()=>validateCredentials('tmp_demo','tmp_other','OldPass!2026','MyNewPass!2026')).toThrow();expect(()=>validateCredentials('my_user','my_user','OldPass!2026','MyNewPass!2026')).toThrow();expect(()=>validateCredentials('tmp_demo','new_user','samepassword12','samepassword12')).toThrow();expect(()=>validateCredentials('tmp_demo','new_user','oldpassword12','short')).toThrow();});
 it('maps only the normalized ID to an internal non-delivery Auth address',()=>{expect(normalizeLoginId(' My_Name ')).toBe('my_name');expect(authEmail(' My_Name ')).toBe('my_name@accounts.mpms.invalid');});
 it('does not grant community permissions before first login completion',()=>{const m:Member={id:'temp',name:'가상학생',classId:'2-3',role:'COUNCIL_EXECUTIVE',status:'ACTIVE',mustChangeCredentials:true};expect(level(m)).toBe(0);expect(level({...m,mustChangeCredentials:false})).toBe(4);});
});
