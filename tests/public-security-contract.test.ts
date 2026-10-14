import {it,expect} from 'vitest';
import {identityOrigin} from '../src/client-auth';
import type {Env} from '../src/contracts';
it('public credentials can only be processed on the configured HTTPS origin, not the same hostname over HTTP or another port',()=>{const env={APP_ORIGIN:'https://control.example.test'} as Env;expect(identityOrigin(env,new Request('https://control.example.test/api/auth/login'))).toBe('public');for(const url of ['http://control.example.test/api/auth/login','https://control.example.test:444/api/auth/login','https://other.example.test/api/auth/login'])expect(identityOrigin(env,new Request(url)),url).toBeNull();});
