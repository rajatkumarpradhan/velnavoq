import {terminalApi} from './terminal-api';
import {editorApi} from './editor-api';
import {codingAgentApi,verifyAgentApproval} from './coding-agent-api';
import {aiApi} from './ai-api';
import {persistence} from './persistence';
import {tenancy} from './tenancy';
import {ApiError,type Env,type Proposal} from './contracts';
import {authenticate,identity,project,rateLimit,role} from './auth';
import {canonical,digest,readBody,validateBundle,validateName} from './security';
async function route(req:Request,env:Env):Promise<Response>{
 const url=new URL(req.url),path=url.pathname,method=req.method;
 if(path==='/api/health'&&method==='GET')return Response.json({service:'velnavoq-control',status:'ok',runtime:'disabled',supportedStack:'static-web-v1'});
 if(path==='/api/auth/register'&&method==='POST')return authenticate(req,env,true);
 if(path==='/api/auth/login'&&method==='POST')return authenticate(req,env,false);
 const who=await identity(req,env,!['GET','HEAD'].includes(method));
 if(method!=='GET')await rateLimit(req,env,'writes',60);
 const terminalResponse=await terminalApi(req,env,who);if(terminalResponse)return terminalResponse;
 const editorResponse=await editorApi(req,env,who);if(editorResponse)return editorResponse;
 const agentResponse=await codingAgentApi(req,env,who);if(agentResponse)return agentResponse;
 const aiResponse=await aiApi(req,env,who);if(aiResponse)return aiResponse;
 const persistedResponse=await persistence(req,env,who);if(persistedResponse)return persistedResponse;
 const tenantResponse=await tenancy(req,env,who);if(tenantResponse)return tenantResponse;
 if(path==='/api/auth/logout'&&method==='POST'){await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(who.sessionHash).run();const headers=new Headers();headers.append('set-cookie','velnavoq_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');headers.append('set-cookie','velnavoq_csrf=; Secure; SameSite=Strict; Path=/; Max-Age=0');return Response.json({ok:true},{headers});}
 if(path==='/api/me'&&method==='GET'){const u=await env.DB.prepare('SELECT email FROM users WHERE id=?').bind(who.userId).first<{email:string}>();const s=await env.DB.prepare('SELECT expires_at FROM sessions WHERE token_hash=?').bind(who.sessionHash).first<{expires_at:number}>();return Response.json({userId:who.userId,email:u?.email,expiresAt:s?.expires_at});}
 const activity=/^\/api\/workspaces\/([^/]+)\/activity$/.exec(path);
 if(activity&&method==='GET'){await role(env,who.userId,activity[1]!);return Response.json((await env.DB.prepare('SELECT a.id,a.project_id,p.name as project_name,a.action,a.digest,a.created_at FROM audit_events a LEFT JOIN projects p ON p.id=a.project_id WHERE a.workspace_id=? ORDER BY a.id DESC LIMIT 100').bind(activity[1]).all()).results);}
 if(path==='/api/workspaces'&&method==='POST'){
 const body=await readBody(req),id=crypto.randomUUID(),name=validateName(body.name);
 await env.DB.batch([env.DB.prepare('INSERT INTO workspaces(id,name,created_at) VALUES(?,?,?)').bind(id,name,Date.now()),env.DB.prepare('INSERT INTO memberships(workspace_id,user_id,role) VALUES(?,?,?)').bind(id,who.userId,'owner')]);return Response.json({id,name},{status:201});}
 if(path==='/api/workspaces'&&method==='GET')return Response.json((await env.DB.prepare('SELECT w.id,w.name,m.role FROM workspaces w JOIN memberships m ON w.id=m.workspace_id WHERE m.user_id=?').bind(who.userId).all()).results);
 const ws=/^\/api\/workspaces\/([^/]+)\/projects$/.exec(path);
 if(ws){const workspaceId=ws[1]!;await role(env,who.userId,workspaceId,method==='GET'?['owner','editor','viewer']:['owner','editor']);
 if(method==='GET')return Response.json((await env.DB.prepare('SELECT id,name,revision,release_digest FROM projects WHERE workspace_id=?').bind(workspaceId).all()).results);
 if(method==='POST'){const b=await readBody(req),name=validateName(b.name),id=crypto.randomUUID();await env.DB.prepare('INSERT INTO projects(id,workspace_id,name,created_at,created_by) VALUES(?,?,?,?,?)').bind(id,workspaceId,name,Date.now(),who.userId).run();return Response.json({id,name,revision:0},{status:201});}}
 const pr=/^\/api\/projects\/([^/]+)(?:\/(proposals|audit|runtime))?$/.exec(path);
 if(pr){const p=await project(env,who.userId,pr[1]!,method==='POST'?['owner','editor']:['owner','editor','viewer']);
 if(!pr[2]&&method==='GET')return Response.json(p);
 if(pr[2]==='runtime')throw new ApiError(503,'isolated_runtime_not_configured');
 if(pr[2]==='audit'&&method==='GET')return Response.json((await env.DB.prepare('SELECT action,digest,created_at FROM audit_events WHERE project_id=? ORDER BY id DESC LIMIT 100').bind(p.id).all()).results);
 if(pr[2]==='proposals'&&method==='GET')return Response.json((await env.DB.prepare('SELECT id,base_revision,digest,status,created_at FROM proposals WHERE project_id=? ORDER BY created_at DESC LIMIT 100').bind(p.id).all()).results);
 if(pr[2]==='proposals'&&method==='POST'){const b=await readBody(req);if(b.baseRevision!==p.revision)throw new ApiError(409,'stale_revision');const bundle=validateBundle(b.bundle),serialized=canonical(bundle),hash=await digest(serialized),id=crypto.randomUUID();await env.DB.prepare('INSERT INTO proposals(id,project_id,base_revision,digest,bundle_json,author_id,created_at) VALUES(?,?,?,?,?,?,?)').bind(id,p.id,p.revision,hash,serialized,who.userId,Date.now()).run();return Response.json({id,digest:hash,baseRevision:p.revision},{status:201});}}
 const decision=/^\/api\/proposals\/([^/]+)(?:\/(approve|reject))?$/.exec(path);
 if(decision){const proposal=await env.DB.prepare('SELECT * FROM proposals WHERE id=?').bind(decision[1]!).first<Proposal>();if(!proposal)throw new ApiError(404,'proposal_not_found');const p=await project(env,who.userId,proposal.project_id,method==='POST'?['owner']:['owner','editor','viewer']);
 if(!decision[2]&&method==='GET')return Response.json({...proposal,bundle:JSON.parse(proposal.bundle_json),agentPatch:await env.DB.prepare('SELECT patch_digest,changes_json,destructive FROM agent_patches WHERE proposal_id=?').bind(proposal.id).first()});
 if(method==='POST'&&decision[2]){const b=await readBody(req);if(b.digest!==proposal.digest||await digest(proposal.bundle_json)!==proposal.digest)throw new ApiError(409,'digest_mismatch');const desired=decision[2]==='approve'?'approved':'rejected';if(desired==='approved')await verifyAgentApproval(env,proposal,b);
 if(proposal.status===desired)return Response.json({status:desired,idempotent:true});if(proposal.status!=='pending')throw new ApiError(409,'proposal_terminal');if(desired==='approved'&&proposal.base_revision!==p.revision)throw new ApiError(409,'stale_revision');
 try{const result=await env.DB.prepare('UPDATE proposals SET status=?,approved_by=?,decided_at=? WHERE id=? AND status=?').bind(desired,who.userId,Date.now(),proposal.id,'pending').run();if(!result.meta.changes)throw new ApiError(409,'proposal_changed');}catch(e){if(e instanceof ApiError)throw e;throw new ApiError(409,'atomic_approval_conflict');}return Response.json({status:desired});}}
 throw new ApiError(404,'not_found');
}
export default {async fetch(req:Request,env:Env):Promise<Response>{
 const requestId=crypto.randomUUID();let res:Response;
 try{res=await route(req,env);}catch(e){if(e instanceof ApiError)res=Response.json({error:e.code,requestId},{status:e.status});else{console.error(JSON.stringify({requestId,error:'internal_error'}));res=Response.json({error:'internal_error',requestId},{status:500});}}
 const h=new Headers(res.headers);h.set('cache-control','no-store');h.set('x-content-type-options','nosniff');h.set('permissions-policy','camera=(), microphone=(), geolocation=(), payment=()');h.set('referrer-policy','no-referrer');h.set('x-request-id',requestId);h.set('content-security-policy',"default-src 'none'; frame-ancestors 'none'");return new Response(res.body,{status:res.status,headers:h});
}};
