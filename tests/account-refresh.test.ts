import {beforeAll,beforeEach,afterAll,it,expect} from 'vitest';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {readFileSync,readdirSync} from 'node:fs';
import {digest} from '../src/security';
import {newConsentDeadline} from '../src/account-mcp-refresh';
const origin='http://localhost:8787',callback='https://refresh.example.test/callback',verifier='r'.repeat(43),scopes=['project.read','files.read'];
let mf:Miniflare,db:D1Database,cookie='',csrf='',user='',pid='',cid='';
const api=(path:string,body?:any)=>mf.dispatchFetch(origin+path,{method:body===undefined?'GET':'POST',headers:{origin,cookie,'content-type':'application/json','x-csrf-token':csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});
const form=(body:Record<string,string>,path='/oauth/account/token')=>mf.dispatchFetch(origin+path,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body).toString()});
const refresh=(token:any,extra:Record<string,string>={})=>form({grant_type:'refresh_token',client_id:cid,refresh_token:token.refresh_token,...extra});
async function root(access:string){return db.prepare('SELECT * FROM account_mcp_tokens WHERE token_hash=?').bind(await digest(access)).first<any>();}
async function consent(hours?:any,shortDeadline=false){
 const challenge=btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 const q=new URLSearchParams({client_id:cid,redirect_uri:callback,resource:origin+'/mcp',response_type:'code',scope:scopes.join(' '),state:crypto.randomUUID(),code_challenge:challenge,code_challenge_method:'S256'});
 const r=await mf.dispatchFetch(origin+'/oauth/account/authorize?'+q,{headers:{cookie},redirect:'manual'});expect(r.status).toBe(303);
 const id=new URL(r.headers.get('location')!).hash.split('accountConsent=')[1];
 const approval=await api('/api/account-mcp/consents/'+id+'/approve',{clientId:cid,redirectUri:callback,resource:origin+'/mcp',scopes,projectIds:[pid],createWorkspaceIds:[],requestApprovals:true,...(hours===undefined?{}:{consentHours:hours})});
 if(approval.status!==200)return {approval};
 const code=new URL((await approval.json() as any).redirect).searchParams.get('code')!;
 if(shortDeadline)await db.prepare('UPDATE account_mcp_consents SET renewable_until=? WHERE id=?').bind(Date.now()+1500,id).run();
 const response=await form({grant_type:'authorization_code',client_id:cid,redirect_uri:callback,resource:origin+'/mcp',code,code_verifier:verifier});expect(response.status).toBe(200);
 return {response,token:await response.json() as any,id};
}
beforeAll(async()=>{
 mf=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:'dist/index.js',compatibilityDate:'2026-10-08',d1Databases:['DB'],bindings:{APP_ORIGIN:origin,REGISTRATION_ENABLED:'true',RUNTIME_ENABLED:'false'}}));db=await mf.getD1Database('DB');
 for(const file of readdirSync('migrations').filter(x=>x.endsWith('.sql')).sort())for(const statement of readFileSync('migrations/'+file,'utf8').replace(/^--.*$/gm,'').split(/;\n(?=(?:CREATE|ALTER|PRAGMA|$))/).filter(x=>x.trim()))await db.prepare(statement).run();
 const r=await api('/api/auth/register',{email:'refresh-owner@example.test',password:'synthetic-password-123456'});expect(r.status).toBe(200);const who:any=await r.json();cookie=r.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');csrf=who.csrfToken;user=who.userId;
 const ws:any=await (await api('/api/workspaces',{name:'Refresh QA'})).json();pid=(await (await api('/api/workspaces/'+ws.id+'/projects',{name:'Private refresh QA'})).json() as any).id;
 const registration=await mf.dispatchFetch(origin+'/oauth/account/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({client_name:'Synthetic refresh client',redirect_uris:[callback],grant_types:['authorization_code','refresh_token']})});expect(registration.status).toBe(201);cid=(await registration.json() as any).client_id;
},30000);
beforeEach(async()=>{await db.prepare('DELETE FROM rate_limits').run()});
afterAll(async()=>{await mf?.dispose()});
it('only explicit numeric 24 selects renewable consent; one-hour default remains',()=>{expect(newConsentDeadline(undefined,100)).toBe(0);expect(newConsentDeadline(1,100)).toBe(0);expect(newConsentDeadline(24,100)).toBe(86400100);for(const bad of [0,2,25,'24',null,true])expect(()=>newConsentDeadline(bad,100)).toThrow();});
it('advertises refresh metadata without silently changing default grants',async()=>{
 const metadata:any=await (await mf.dispatchFetch(origin+'/.well-known/oauth-authorization-server/oauth/account')).json();expect(metadata.grant_types_supported).toContain('refresh_token');
 const result=await consent(),t=result.token;expect(t.refresh_token).toBeUndefined();expect(t.expires_in).toBeGreaterThan(3590);expect(t.expires_in).toBeLessThanOrEqual(3600);const r=await root(t.access_token);expect((await db.prepare('SELECT count(*) n FROM account_mcp_refresh_families WHERE authorization_id=?').bind(r.id).first<any>()).n).toBe(0);expect((await refresh({refresh_token:t.access_token})).status).toBe(400);
});
it('rejects an unsupported lifetime without consuming pending consent',async()=>{const result=await consent(48);expect(result.approval?.status).toBe(400)});
it('opt-in caps consent at approval+24h, stores no plaintext refresh and rotates parent+derived children atomically',async()=>{
 const before=Date.now(),{token:t,id}=await consent(24);expect(t.refresh_token).toMatch(/^[a-f0-9]{64}$/);expect(t.refresh_token_expires_in).toBeGreaterThan(86390);expect(t.refresh_token_expires_in).toBeLessThanOrEqual(86400);
 const c=await db.prepare('SELECT renewable_until FROM account_mcp_consents WHERE id=?').bind(id).first<any>();expect(c.renewable_until).toBeGreaterThanOrEqual(before+86400000);
 const old=await root(t.access_token),child=await db.prepare('SELECT t.* FROM account_mcp_projects g JOIN mcp_access_tokens t ON t.id=g.child_token_id WHERE g.token_id=?').bind(old.id).first<any>();
 const r=await refresh(t);expect(r.status).toBe(200);expect(r.headers.get('cache-control')).toBe('no-store');const next:any=await r.json();expect(next.access_token).not.toBe(t.access_token);expect(next.refresh_token).not.toBe(t.refresh_token);expect(await root(t.access_token)).toBeNull();const current=await root(next.access_token);expect(current.id).toBe(old.id);expect(current.scopes).toBe(old.scopes);expect(current.workspaces_json).toBe(old.workspaces_json);
 const updated=await db.prepare('SELECT t.* FROM account_mcp_projects g JOIN mcp_access_tokens t ON t.id=g.child_token_id WHERE g.token_id=?').bind(old.id).first<any>();expect((await db.prepare('SELECT revoked_at FROM mcp_access_tokens WHERE id=?').bind(child.id).first<any>()).revoked_at).not.toBeNull();expect(updated.token_hash).toBe(await digest(await digest(next.access_token+':'+pid)));expect(updated.token_hash).not.toBe(child.token_hash);expect(updated.expires_at).toBe(current.expires_at);
 const stored=await db.prepare('SELECT * FROM account_mcp_refresh_entries WHERE token_hash=?').bind(await digest(t.refresh_token)).first<any>();expect(stored.consumed_at).not.toBeNull();expect(JSON.stringify(stored)).not.toContain(t.refresh_token);expect(current.expires_at).toBeLessThanOrEqual(c.renewable_until);
});
it('wrong client, wrong resource and extra scope cannot renew or force revocation',async()=>{
 const {token:t}=await consent(24);for(const extra of [{client_id:'other'},{resource:'https://other.test/mcp'},{scope:'project.read projects.create'}])expect((await refresh(t,extra)).status).toBe(400);
 expect((await refresh(t,{scope:'files.read project.read'})).status).toBe(200);
});
it('access may expire but refresh cannot exceed absolute deadline',async()=>{
 const {token:t,id}=await consent(24),old=await root(t.access_token);await db.prepare('UPDATE account_mcp_tokens SET expires_at=? WHERE id=?').bind(Date.now()-1,old.id).run();const next=await refresh(t);expect(next.status).toBe(200);const n:any=await next.json();expect((await root(n.access_token)).expires_at).toBeGreaterThan(Date.now());
 // Test expired consent by advancing the persisted entry guard in an isolated DB, not production.
 await db.prepare('UPDATE account_mcp_refresh_entries SET expires_at=? WHERE token_hash=?').bind(Date.now()-1,await digest(n.refresh_token)).run();expect((await refresh(n)).status).toBe(400);
});
it('consumed refresh replay revokes only its family, root and descendants',async()=>{
 const {token:t}=await consent(24),{token:other}=await consent(24);const r=await root(t.access_token);const next:any=await (await refresh(t)).json();expect((await refresh(t)).status).toBe(400);expect((await refresh(next)).status).toBe(400);expect((await root(next.access_token)).revoked_at).not.toBeNull();const child=await db.prepare('SELECT t.revoked_at FROM account_mcp_projects g JOIN mcp_access_tokens t ON t.id=g.child_token_id WHERE g.token_id=?').bind(r.id).first<any>();expect(child.revoked_at).not.toBeNull();expect((await refresh(other)).status).toBe(200);
});
it('concurrent same-refresh attempts have one HTTP winner and safe family revocation, no duplicate successors',async()=>{
 const {token:t}=await consent(24);const results=await Promise.all([refresh(t),refresh(t)]);expect(results.map(r=>r.status).sort()).toEqual([200,400]);const original:any=await db.prepare('SELECT * FROM account_mcp_refresh_entries WHERE token_hash=?').bind(await digest(t.refresh_token)).first();const successors:any=await db.prepare('SELECT count(*) n FROM account_mcp_refresh_entries WHERE predecessor_hash=?').bind(await digest(t.refresh_token)).first();expect(successors.n).toBe(1);const family:any=await db.prepare('SELECT * FROM account_mcp_refresh_families WHERE id=?').bind(original.family_id).first();expect(family.revoked_at).not.toBeNull();
});
it('owner revoke and refresh-token endpoint revoke propagate; other-client revoke does not',async()=>{
 const {token:t}=await consent(24);const id=(await root(t.access_token)).id;expect((await api('/api/account-mcp/tokens/'+id+'/revoke',{})).status).toBe(200);expect((await refresh(t)).status).toBe(400);
 const {token:x}=await consent(24);expect((await form({client_id:'other',token:x.refresh_token},'/oauth/account/revoke')).status).toBe(200);const y:any=await (await refresh(x)).json();expect((await form({client_id:cid,token:y.refresh_token},'/oauth/account/revoke')).status).toBe(200);expect((await refresh(y)).status).toBe(400);expect((await root(y.access_token)).revoked_at).not.toBeNull();
});
it('revoked children are not resurrected while live hash-derived child grants re-key without extra scopes',async()=>{
 const {token:t}=await consent(24);const parent=await root(t.access_token);const grant:any=await db.prepare('SELECT * FROM account_mcp_projects WHERE token_id=?').bind(parent.id).first();await db.prepare('UPDATE mcp_access_tokens SET revoked_at=? WHERE id=?').bind(Date.now(),grant.child_token_id).run();const before:any=await db.prepare('SELECT * FROM mcp_access_tokens WHERE id=?').bind(grant.child_token_id).first();const r=await refresh(t);expect(r.status).toBe(200);const after:any=await db.prepare('SELECT * FROM mcp_access_tokens WHERE id=?').bind(grant.child_token_id).first();expect(after).toEqual(before);
 const {token:x}=await consent(24);const px=await root(x.access_token);await db.prepare('UPDATE account_mcp_projects SET derivation=1 WHERE token_id=?').bind(px.id).run();const n:any=await(await refresh(x)).json();const ch:any=await db.prepare('SELECT t.* FROM account_mcp_projects g JOIN mcp_access_tokens t ON t.id=g.child_token_id WHERE g.token_id=?').bind(px.id).first();expect(ch.token_hash).toBe(await digest(await digest((await digest(n.access_token))+':'+pid)));expect(ch.scopes).toBe(JSON.stringify(scopes));
});
it('renewal does not widen creation/workspace boundaries or manufacture grants',async()=>{
 const {token:t}=await consent(24);const old=await root(t.access_token),n:any=await(await refresh(t)).json();expect((await root(n.access_token)).workspaces_json).toBe('[]');const rpc=await mf.dispatchFetch(origin+'/mcp',{method:'POST',headers:{authorization:'Bearer '+n.access_token,'content-type':'application/json',accept:'application/json, text/event-stream','MCP-Protocol-Version':'2025-11-25'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'velnavoq.create_project',arguments:{name:'Denied',workspaceId:'ungranted'}}})});expect(JSON.stringify(await rpc.json())).toContain('Workspace not granted');expect((await db.prepare('SELECT count(*) n FROM account_mcp_projects WHERE token_id=?').bind(old.id).first<any>()).n).toBe(1);
});

it('short remaining consent caps parent and child tokens and denies refresh after absolute expiry',async()=>{
 const {token:t}=await consent(24,true);expect(t.expires_in).toBeLessThanOrEqual(1);const p=await root(t.access_token);const fam:any=await db.prepare('SELECT * FROM account_mcp_refresh_families WHERE authorization_id=?').bind(p.id).first();expect(p.expires_at).toBe(fam.grant_deadline_ms);const n:any=await(await refresh(t)).json();const parent=await root(n.access_token);expect(parent.expires_at).toBe(fam.grant_deadline_ms);const child:any=await db.prepare('SELECT t.* FROM account_mcp_projects g JOIN mcp_access_tokens t ON t.id=g.child_token_id WHERE g.token_id=?').bind(p.id).first();expect(child.expires_at).toBe(fam.grant_deadline_ms);await new Promise(r=>setTimeout(r,1550));expect((await refresh(n)).status).toBe(400);
});
it('new renewable grants leave preexisting one-hour token records unchanged',async()=>{
 const {token:old}=await consent();const before=await root(old.access_token);const {token:newer}=await consent(24);expect((await refresh(newer)).status).toBe(200);expect(await root(old.access_token)).toEqual(before);expect((await db.prepare('SELECT count(*) n FROM account_mcp_refresh_families WHERE authorization_id=?').bind(before.id).first<any>()).n).toBe(0);
});

it('explicit ongoing consent survives access expiry and registration retention without extending old grants',async()=>{
 expect(newConsentDeadline('until_revoked',100)).toBe(-1);
 const {token:bounded}=await consent(24),before=await root(bounded.access_token);
 const {token:t,id}=await consent('until_revoked');expect(t.consent_mode).toBe('until_revoked');expect(t.refresh_token_expires_in).toBeUndefined();expect(t.expires_in).toBeLessThanOrEqual(3600);
 const p=await root(t.access_token),f:any=await db.prepare('SELECT * FROM account_mcp_refresh_families WHERE authorization_id=?').bind(p.id).first();expect(f.grant_deadline_ms).toBe(-1);
 await db.prepare('UPDATE account_mcp_tokens SET expires_at=? WHERE id=?').bind(Date.now()-1,p.id).run();await db.prepare('UPDATE account_mcp_clients SET expires_at=? WHERE id=?').bind(Date.now()-1,cid).run();
 const next:any=await(await refresh(t)).json();expect(next.access_token).toBeTruthy();expect(next.expires_in).toBeLessThanOrEqual(3600);expect(next.consent_mode).toBe('until_revoked');expect((await root(next.access_token)).scopes).toBe(p.scopes);expect(await root(bounded.access_token)).toEqual(before);
 expect((await refresh(bounded)).status).toBe(400);await db.prepare('UPDATE account_mcp_clients SET expires_at=? WHERE id=?').bind(Date.now()+30*86400000,cid).run();
 expect((await api('/api/account-mcp')).status).toBe(200);expect((await db.prepare('SELECT renewable_until FROM account_mcp_consents WHERE id=?').bind(id).first<any>()).renewable_until).toBe(-1);
 expect((await api('/api/account-mcp/tokens/'+p.id+'/revoke',{})).status).toBe(200);expect((await refresh(next)).status).toBe(400);expect((await root(next.access_token)).revoked_at).not.toBeNull();
});
it('ongoing refresh enforces binding, replay and atomic concurrency just like bounded grants',async()=>{
 const {token:t}=await consent('until_revoked');for(const extra of [{client_id:'wrong'},{resource:'https://wrong.test/mcp'},{scope:'projects.create'}])expect((await refresh(t,extra)).status).toBe(400);
 const next:any=await(await refresh(t)).json();expect(next.access_token).toBeTruthy();expect((await refresh(t)).status).toBe(400);expect((await refresh(next)).status).toBe(400);
 const {token:x}=await consent('until_revoked');const results=await Promise.all([refresh(x),refresh(x)]);expect(results.map(r=>r.status).sort()).toEqual([200,400]);expect((await db.prepare('SELECT count(*) n FROM account_mcp_refresh_entries WHERE predecessor_hash=?').bind(await digest(x.refresh_token)).first<any>()).n).toBe(1);
});
it('ongoing renewal never restores revoked child access or introduces workspace grants',async()=>{
 const {token:t}=await consent('until_revoked'),p=await root(t.access_token);const g:any=await db.prepare('SELECT * FROM account_mcp_projects WHERE token_id=?').bind(p.id).first();await db.prepare('UPDATE mcp_access_tokens SET revoked_at=? WHERE id=?').bind(Date.now(),g.child_token_id).run();
 const n:any=await(await refresh(t)).json();expect(n.access_token).toBeTruthy();expect((await root(n.access_token)).workspaces_json).toBe('[]');expect((await db.prepare('SELECT * FROM account_mcp_projects WHERE token_id=?').bind(p.id).first<any>()).child_token_id).toBe(g.child_token_id);expect((await db.prepare('SELECT * FROM mcp_access_tokens WHERE id=?').bind(g.child_token_id).first<any>()).revoked_at).not.toBeNull();
});
it('bounded refresh families cannot be upgraded to ongoing after issuance',async()=>{
 const {token:t}=await consent(24),p=await root(t.access_token);await expect(db.prepare('UPDATE account_mcp_refresh_families SET grant_deadline_ms=-1 WHERE authorization_id=?').bind(p.id).run()).rejects.toThrow();
 expect((await refresh(t)).status).toBe(200);expect(newConsentDeadline(undefined,10)).toBe(0);for(const bad of ['forever','-1',-1,Infinity])expect(()=>newConsentDeadline(bad,10)).toThrow();
});

it('management reports renewal revocation and access revocation together',async()=>{const {token:t}=await consent('until_revoked');const parent=await root(t.access_token);const before:any=await(await api('/api/account-mcp')).json();expect(before.tokens.find((x:any)=>x.id===parent.id)).toMatchObject({consent_expires_at:-1,renewal_revoked_at:null,revoked_at:null});expect((await form({client_id:cid,token:t.refresh_token},'/oauth/account/revoke')).status).toBe(200);const after:any=await(await api('/api/account-mcp')).json();expect(after.tokens.find((x:any)=>x.id===parent.id).renewal_revoked_at).toBeGreaterThan(0);expect(after.tokens.find((x:any)=>x.id===parent.id).revoked_at).toBeGreaterThan(0);expect((await refresh(t)).status).toBe(400)});
