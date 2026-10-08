import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {readFileSync} from 'node:fs';
let mf:Miniflare,db:D1Database;
const origin='http://localhost:8787';
interface Login{userId:string;csrfToken:string;cookie:string}
async function request(path:string,method='GET',body?:unknown,auth?:Login,extra:Record<string,string>={}){
 const headers:Record<string,string>={origin,'content-type':'application/json',...extra};if(auth){headers.cookie=auth.cookie;headers['x-csrf-token']=auth.csrfToken;}
 return mf.dispatchFetch(origin+path,{method,headers,...(body===undefined?{}:{body:JSON.stringify(body)})});
}
async function signup(email:string):Promise<Login>{const r=await request('/api/auth/register','POST',{email,password:'secure-password-long-1234'});expect(r.status).toBe(200);const b=await r.json() as Login;return {...b,cookie:r.headers.get('set-cookie')!.split(';')[0]!};}
let alice:Login,bob:Login,ws:string,proj:string;
beforeAll(async()=>{
 mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'control',modules:true,scriptPath:'dist/index.js',compatibilityDate:'2026-10-08',d1Databases:['DB'],bindings:{APP_ORIGIN:origin,REGISTRATION_ENABLED:'true',RUNTIME_ENABLED:'false'}}]}));
 db=await mf.getD1Database('DB');
 // D1 exec is line oriented. Migration statements are run via the same Wrangler local D1 engine.
 const sql=readFileSync('migrations/0001_control_plane.sql','utf8');
 for(const statement of sql.split(/;\n(?=(?:CREATE|PRAGMA|$))/).map(x=>x.trim()).filter(Boolean))await db.prepare(statement).run();
 alice=await signup('alice@example.test');bob=await signup('bob@example.test');
 ws=(await (await request('/api/workspaces','POST',{name:'Alice workspace'},alice)).json() as {id:string}).id;
 proj=(await (await request(`/api/workspaces/${ws}/projects`,'POST',{name:'Real source app'},alice)).json() as {id:string}).id;
},30000);
afterAll(async()=>{await mf?.dispose();});
const make=async(files:Record<string,string>={'index.html':'<h1>Hello</h1>'},baseRevision=0)=>{
 const r=await request(`/api/projects/${proj}/proposals`,'POST',{baseRevision,bundle:{stack:'static-web-v1',files,schema:[],permissions:[]}},alice);expect(r.status).toBe(201);return await r.json() as {id:string;digest:string};};
describe('real Workers/D1 authentication and tenant isolation',()=>{
 it('requires login',async()=>expect((await request(`/api/projects/${proj}`)).status).toBe(401));
 it('sets secure session cookie',async()=>{const r=await request('/api/auth/login','POST',{email:'alice@example.test',password:'secure-password-long-1234'});expect(r.headers.get('set-cookie')).toContain('HttpOnly; Secure; SameSite=Strict');});
 it('incorrect password fails',async()=>expect((await request('/api/auth/login','POST',{email:'alice@example.test',password:'wrong-password-long-1234'})).status).toBe(401));
 it('register is an actual persisted user',async()=>expect((await db.prepare('SELECT count(*) as n FROM users').first<{n:number}>())?.n).toBe(2));
 it('other tenant cannot read workspace projects',async()=>expect((await request(`/api/workspaces/${ws}/projects`,'GET',undefined,bob)).status).toBe(404));
 it('other tenant cannot read project',async()=>expect((await request(`/api/projects/${proj}`,'GET',undefined,bob)).status).toBe(404));
 it('other tenant cannot write proposals',async()=>expect((await request(`/api/projects/${proj}/proposals`,'POST',{},bob)).status).toBe(404));
 it('other tenant list does not disclose workspace',async()=>expect(await (await request('/api/workspaces','GET',undefined,bob)).json()).toEqual([]));
 it('missing CSRF denies writes',async()=>{const r=await mf.dispatchFetch(origin+'/api/workspaces',{method:'POST',headers:{origin,cookie:alice.cookie,'content-type':'application/json'},body:'{"name":"bad"}'});expect(r.status).toBe(403);});
 it('cross-origin denies writes',async()=>expect((await request('/api/workspaces','POST',{name:'bad'},alice,{origin:'https://bad.test'})).status).toBe(403));
 it('viewer cannot mutate',async()=>{await db.prepare('INSERT INTO memberships(workspace_id,user_id,role) VALUES(?,?,?)').bind(ws,bob.userId,'viewer').run();expect((await request(`/api/workspaces/${ws}/projects`,'POST',{name:'Denied'},bob)).status).toBe(404);await db.prepare('DELETE FROM memberships WHERE user_id=?').bind(bob.userId).run();});
 it('runtime gives explicit unavailable status',async()=>expect((await request(`/api/projects/${proj}/runtime`,'GET',undefined,alice)).status).toBe(503));
 it('expired session rejected',async()=>{const short=await signup('short@example.test');await db.prepare('UPDATE sessions SET expires_at=1 WHERE user_id=?').bind(short.userId).run();expect((await request('/api/me','GET',undefined,short)).status).toBe(401);});
 it('logout revokes actual session',async()=>{const temp=await signup('logout@example.test');expect((await request('/api/auth/logout','POST',{},temp)).status).toBe(200);expect((await request('/api/me','GET',undefined,temp)).status).toBe(401);});
});
describe('atomic approval against real D1',()=>{
 it('reject does not change source or revision',async()=>{const q=await make();expect((await request(`/api/proposals/${q.id}/reject`,'POST',{digest:q.digest},alice)).status).toBe(200);expect((await db.prepare('SELECT revision FROM projects WHERE id=?').bind(proj).first<{revision:number}>())!.revision).toBe(0);expect((await request(`/api/proposals/${q.id}/approve`,'POST',{digest:q.digest},alice)).status).toBe(409);});
 it('proposal immutable even at persistence boundary',async()=>{const q=await make();await expect(db.prepare('UPDATE proposals SET bundle_json=? WHERE id=?').bind('tampered',q.id).run()).rejects.toThrow();});
 it('digest mismatch cannot approve',async()=>{const q=await make();expect((await request(`/api/proposals/${q.id}/approve`,'POST',{digest:'bad'},alice)).status).toBe(409);});
 it('tenant cannot inspect or approve proposal',async()=>{const q=await make();expect((await request(`/api/proposals/${q.id}`,'GET',undefined,bob)).status).toBe(404);expect((await request(`/api/proposals/${q.id}/approve`,'POST',{digest:q.digest},bob)).status).toBe(404);});
 it('exact approval, stale revision, replay and audit work',async()=>{const q=await make(),stale=await make();expect((await request(`/api/proposals/${q.id}/approve`,'POST',{digest:q.digest},alice)).status).toBe(200);expect((await request(`/api/proposals/${stale.id}/approve`,'POST',{digest:stale.digest},alice)).status).toBe(409);expect((await request(`/api/proposals/${q.id}/approve`,'POST',{digest:q.digest},alice)).status).toBe(200);const row=await db.prepare('SELECT revision,release_digest FROM projects WHERE id=?').bind(proj).first<{revision:number;release_digest:string}>();expect(row).toMatchObject({revision:1,release_digest:q.digest});expect((await db.prepare('SELECT count(*) as n FROM audit_events WHERE project_id=?').bind(proj).first<{n:number}>())!.n).toBe(1);});
 it('database failure rolls back release and decision together',async()=>{const q=await make({'index.html':'changed'},1);await db.prepare("CREATE TRIGGER force_failure BEFORE INSERT ON audit_events BEGIN SELECT RAISE(ABORT,'test_failure'); END").run();expect((await request(`/api/proposals/${q.id}/approve`,'POST',{digest:q.digest},alice)).status).toBe(409);expect((await db.prepare('SELECT revision FROM projects WHERE id=?').bind(proj).first<{revision:number}>())!.revision).toBe(1);expect((await db.prepare('SELECT status FROM proposals WHERE id=?').bind(q.id).first<{status:string}>())!.status).toBe('pending');await db.prepare('DROP TRIGGER force_failure').run();});
});
