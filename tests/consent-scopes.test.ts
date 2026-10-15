import {it,expect} from 'vitest';
import {consentScopeSubset} from '../src/consent-scopes';
it('never grants a valid operation outside this request and normalizes order',()=>{expect(()=>consentScopeSubset(['project.read'],['release.publish'])).toThrow();expect(consentScopeSubset(['project.read','files.read'],['files.read','project.read'])).toEqual(['project.read','files.read']);expect(consentScopeSubset(['project.read'],undefined)).toEqual(['project.read']);});
