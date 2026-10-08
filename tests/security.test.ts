import {describe,it,expect} from 'vitest';
import {canonical,checkOrigin,constantEqual,digest,passwordHash,validateBundle,validateEmail,validatePassword} from '../src/security';
const bundle=(path='index.html')=>({stack:'static-web-v1',files:{[path]:'<h1>app</h1>'},schema:[],permissions:[]});
describe('trust contracts',()=>{
 it('canonical digest does not depend on key insertion order',async()=>{expect(await digest(canonical({b:1,a:2}))).toBe(await digest(canonical({a:2,b:1})));});
 it('content edits change the digest',async()=>expect(await digest('A')).not.toBe(await digest('B')));
 it('valid declared stack passes',()=>expect(validateBundle(bundle()).stack).toBe('static-web-v1'));
 for(const path of ['../index.html','/index.html','foo/../index.html','.env.txt','foo\\index.html','a//index.html','index.ts','index.html%00.js'])it(`rejects unsafe path ${path}`,()=>expect(()=>validateBundle({...bundle(),files:{'index.html':'ok',[path]:'bad'}})).toThrow());
 it('rejects schema before there is a real runtime adapter',()=>expect(()=>validateBundle({...bundle(),schema:['create table']})).toThrow());
 it('rejects permissions it cannot enforce',()=>expect(()=>validateBundle({...bundle(),permissions:['network']})).toThrow());
 it('rejects hidden bundle keys',()=>expect(()=>validateBundle({...bundle(),secret:'x'})).toThrow());
 it('caps bytes',()=>expect(()=>validateBundle({...bundle(),files:{'index.html':'a'.repeat(500001)}})).toThrow());
 it('requires entry point',()=>expect(()=>validateBundle(bundle('app.js'))).toThrow());
 it('normalizes emails',()=>expect(validateEmail('A@EXAMPLE.COM')).toBe('a@example.com'));
 it('rejects weak passwords',()=>expect(()=>validatePassword('tiny')).toThrow());
 it('passwords salted and deterministic',async()=>{const a=await passwordHash('very-long-password','salt1');expect(a).toBe(await passwordHash('very-long-password','salt1'));expect(a).not.toBe(await passwordHash('very-long-password','salt2'));});
 it('exact origin only',()=>{expect(()=>checkOrigin(new Request('https://local',{headers:{origin:'https://bad'}}),'https://good')).toThrow();});
 it('comparison checks length and value',()=>{expect(constantEqual('abc','abc')).toBe(true);expect(constantEqual('abc','ab')).toBe(false);expect(constantEqual('abc','abd')).toBe(false);});
});
