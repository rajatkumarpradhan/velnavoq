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
async function consent(hours?:any,shortDeadline=false,subset:any=scopes){
 const challenge=btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 const q=new URLSearchParams({client_id:cid,redirect_uri:callback,resource:origin+'/mcp',response_type:'code',scope:[...scopes,'patch.propose','sandbox.write','checks.run','preview.create','repair.run','release.publish','schema.propose','schema.read','projects.create'].join(' '),state:crypto.randomUUID(),code_challenge:challenge,code_challenge_method:'S256'});
 const r=await mf.dispatchFetch(origin+'/oauth/account/authorize?'+q,{headers:{cookie},redirect:'manual'});expect(r.status).toBe(303);
 const id=new URL(r.headers.get('location')!).hash.split('accountConsent=')[1];
 const approval=await api('/api/account-mcp/consents/'+id+'/approve',{clientId:cid,redirectUri:callback,resource:origin+'/mcp',scopes:[...scopes,'patch.propose','sandbox.write','checks.run','preview.create','repair.run','release.publish','schema.propose','schema.read','projects.create'],grantedScopes:subset,projectIds:[pid],createWorkspaceIds:[],requestApprovals:true,...(hours===undefined?{}:{consentHours:hours})});
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

const rpc=(access:string,name:string,args:any={})=>mf.dispatchFetch(origin+'/mcp',{method:'POST',headers:{authorization:'Bearer '+access,'content-type':'application/json',accept:'application/json, text/event-stream','MCP-Protocol-Version':'2025-11-25'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:name==='tools/list'?name:'tools/call',params:name==='tools/list'?{}:{name,arguments:args}})});
it('grants only the selected read subset in consent, root, child, token response and renewable family',async()=>{
 const {token:t,id}=await consent('until_revoked');expect(t.scope).toBe(scopes.join(' '));const p=await root(t.access_token);expect(JSON.parse(p.scopes)).toEqual(scopes);
 const c:any=await db.prepare('SELECT scopes FROM account_mcp_consents WHERE id=?').bind(id).first();expect(JSON.parse(c.scopes)).toEqual(scopes);
 const child:any=await db.prepare('SELECT t.scopes FROM account_mcp_projects g JOIN mcp_access_tokens t ON t.id=g.child_token_id WHERE g.token_id=?').bind(p.id).first();expect(JSON.parse(child.scopes)).toEqual(scopes);
 const fam:any=await db.prepare('SELECT scopes_json FROM account_mcp_refresh_families WHERE authorization_id=?').bind(p.id).first();expect(JSON.parse(fam.scopes_json)).toEqual(scopes);
 const listed:any=await(await rpc(t.access_token,'tools/list')).json();const names=listed.result.tools.map((x:any)=>x.name);expect(names).toContain('velnavoq.project');expect(names).toContain('velnavoq.files');for(const n of ['velnavoq.propose_patch','velnavoq.build_private_app','velnavoq.create_project','velnavoq.publish'])expect(names).not.toContain(n);
 const read:any=await(await rpc(t.access_token,'velnavoq.project',{projectId:pid})).json();expect(JSON.stringify(read)).toContain(pid);
 for(const name of ['velnavoq.propose_patch','velnavoq.build_private_app','velnavoq.create_project','velnavoq.publish']){const denied:any=await(await rpc(t.access_token,name,{projectId:pid})).json();expect(denied.error||denied.result?.isError).toBeTruthy();}
 expect((await refresh(t,{scope:'project.read files.read release.publish'})).status).toBe(400);
 const next:any=await(await refresh(t)).json();expect(next.scope).toBe(t.scope);expect(JSON.parse((await root(next.access_token)).scopes)).toEqual(scopes);
 expect((await api('/api/account-mcp/tokens/'+p.id+'/revoke',{})).status).toBe(200);expect((await refresh(next)).status).toBe(400);
});
it('rejects empty, duplicate, non-string and out-of-ceiling subsets without approving',async()=>{for(const selected of [[],['project.read','project.read'],['unknown'],[123],null]){const r=await consent(24,false,selected);expect(r.approval?.status).toBe(400)}});
it('a narrower new consent cannot rewrite an existing authorization',async()=>{const {token:old}=await consent(24),before=await root(old.access_token);const {token:next}=await consent(24,false,['project.read']);expect(next.scope).toBe('project.read');expect(await root(old.access_token)).toEqual(before)});
