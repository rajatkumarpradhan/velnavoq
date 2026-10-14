import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const {api}=vi.hoisted(()=>({api:vi.fn()}));
vi.mock('../ui/navigation',()=>({api,HttpError:class HttpError extends Error{constructor(public status:number,public code:string){super(code)}}}));
import {ensurePreviewBuild} from '../ui/preview-build';
import {createPreviewSession} from '../ui/preview-session';
class TestWorker {
 static last:TestWorker; onmessage:((e:any)=>void)|null=null;onerror:(()=>void)|null=null;
 terminate=vi.fn();postMessage=vi.fn();
 constructor(){TestWorker.last=this}
}
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
beforeEach(()=>{
 vi.stubGlobal('Worker',TestWorker);api.mockReset();
 api.mockImplementation(async(path:string)=>{
  if(path.endsWith('/agent/context'))return {snapshot:{revision:1,sourceDigest:'digest'}};
  if(path==='/projects/p/build')return {jobs:[],id:'job',runtimeId:'runtime',files:{'index.html':'<h1>Hello</h1>'}};
  return {stored:true};
 });
});
afterEach(()=>vi.unstubAllGlobals());
describe('preview build lifecycle',()=>{
 it('records a successful worker result once and terminates the worker',async()=>{
  const ctrl=new AbortController();const pending=ensurePreviewBuild('p',ctrl.signal,()=>{});await tick();
  TestWorker.last.onmessage!({data:{kind:'result',result:{status:'succeeded',exitCode:0,durationMs:1}}});
  expect(await pending).toBe('job');expect(TestWorker.last.terminate).toHaveBeenCalledOnce();
  expect(api.mock.calls.filter(([p])=>p.endsWith('/finish'))).toHaveLength(1);
 });
 it('cancels even if a queued log would be rejected',async()=>{
  api.mockImplementation(async(path:string)=>{
   if(path.endsWith('/agent/context'))return {snapshot:{revision:1,sourceDigest:'digest'}};
   if(path==='/projects/p/build')return {jobs:[],id:'job',runtimeId:'runtime',files:{}};
   if(path.endsWith('/events'))throw Error('event_denied');return {};
  });
  const ctrl=new AbortController();const pending=ensurePreviewBuild('p',ctrl.signal,()=>{});const caught=pending.catch(e=>e);await tick();
  TestWorker.last.onmessage!({data:{kind:'log',text:'api_key=123456789secret'}});ctrl.abort();
  expect((await caught).message).toContain('cancelled');
  expect(api.mock.calls.some(([p])=>p.endsWith('/cancel'))).toBe(true);
  expect(api.mock.calls.some(([p])=>p.endsWith('/events'))).toBe(false);
 });
 it('cancels the reserved job when the worker cannot be created',async()=>{
  vi.stubGlobal('Worker',class{constructor(){throw Error('worker unavailable')}});
  await expect(ensurePreviewBuild('p',new AbortController().signal,()=>{})).rejects.toThrow('worker unavailable');
  expect(api.mock.calls.some(([p])=>p.endsWith('/cancel'))).toBe(true);
 });
 it('terminates and cancels if posting source to the worker throws',async()=>{
  vi.stubGlobal('Worker',class extends TestWorker{constructor(){super();this.postMessage.mockImplementation(()=>{throw Error('clone failed')})}});
  await expect(ensurePreviewBuild('p',new AbortController().signal,()=>{})).rejects.toThrow('clone failed');
  expect(TestWorker.last.terminate).toHaveBeenCalledOnce();expect(api.mock.calls.some(([p])=>p.endsWith('/cancel'))).toBe(true);
 });
 it('does not reserve a job for an already cancelled request',async()=>{
  const ctrl=new AbortController();ctrl.abort();await expect(ensurePreviewBuild('p',ctrl.signal,()=>{})).rejects.toThrow();
  expect(api).not.toHaveBeenCalled();
 });
 it('reuses an unexpired successful build for exactly the current source',async()=>{
  api.mockImplementation(async(path:string)=>path.endsWith('/agent/context')?{snapshot:{revision:1,sourceDigest:'digest'}}:{jobs:[{id:'cached',status:'succeeded',revision:1,source_digest:'digest',finished_at:Date.now()}]});
  expect(await ensurePreviewBuild('p',new AbortController().signal,()=>{})).toBe('cached');expect(api).toHaveBeenCalledTimes(2);
 });
});

describe('in-flight preview reservations',()=>{
 it('keeps the build creation receipt so an in-flight Stop can cancel its exact job',async()=>{
  let finish!:(value:any)=>void;const response=new Promise(resolve=>{finish=resolve});
  api.mockImplementation(async(path:string,init?:RequestInit)=>{
   if(path.endsWith('/agent/context'))return {snapshot:{revision:1,sourceDigest:'digest'}};
   if(path==='/projects/p/build'&&!init?.method)return {jobs:[]};
   if(path==='/projects/p/build'){expect(init?.signal).toBeUndefined();return response}return {};
  });
  const ctrl=new AbortController();const pending=ensurePreviewBuild('p',ctrl.signal,()=>{});const caught=pending.catch(e=>e);await tick();ctrl.abort();
  finish({id:'reserved',runtimeId:'runtime',files:{}});expect((await caught).message).toContain('cancelled');
  expect(api.mock.calls.some(([p])=>p==='/projects/p/build/reserved/cancel')).toBe(true);
 });
 it('stops the exact preview session if Stop arrived before its creation response',async()=>{
  let finish!:(value:any)=>void;const response=new Promise(resolve=>{finish=resolve});
  api.mockImplementation(async(path:string)=>path==='/projects/p/preview'?response:{});
  const ctrl=new AbortController();const pending=createPreviewSession('p','job',ctrl.signal);const caught=pending.catch(e=>e);ctrl.abort();
  finish({id:'session',files:{},expiresAt:1});expect((await caught).message).toContain('cancelled');
  expect(api.mock.calls.some(([p])=>p==='/projects/p/preview/session/stop')).toBe(true);
 });
 it('does not claim a stop receipt when the server stop fails',async()=>{
  const ctrl=new AbortController();
  api.mockImplementation(async(path:string)=>{if(path.endsWith('/stop'))throw Error('offline');ctrl.abort();return {id:'s',files:{},expiresAt:1}});
  await expect(createPreviewSession('p','job',ctrl.signal)).rejects.toThrow('stop could not be saved');
 });
 it('returns a normal preview receipt without a stop',async()=>{
  const value={id:'s',files:{'index.html':'hello'},expiresAt:1};api.mockResolvedValue(value);
  expect(await createPreviewSession('p','job',new AbortController().signal)).toEqual(value);expect(api).toHaveBeenCalledOnce();
 });
 it('does not create a preview session after an earlier Stop',async()=>{
  const ctrl=new AbortController();ctrl.abort();await expect(createPreviewSession('p','job',ctrl.signal)).rejects.toThrow('cancelled');expect(api).not.toHaveBeenCalled();
 });
});
