import {savedAppApi} from './saved-app';
import {buildRequestsApi} from './build-requests';
import {accountEmailChangeApi} from './account-email-change';
import {privateBuildApi} from './private-build';
import {safeBackendError} from './backend-contract';
import {platformEmailApi} from './platform-email-api';
import {platformReadiness} from './platform-readiness';
import {approvalInbox} from './approval-inbox';
import {publicMcpPath,publicCors} from './public-mcp-http';
import {accountPublic,accountManage,accountEndpoint} from './account-mcp';
import {backendApi} from './project-backend';
import {observabilityApi,observeRequest} from './observability';
import {deploymentApi} from './deployment';
import {versioningApi} from './versioning';import {recoveryApi} from './recovery';
import {environmentApi,rejectEnvironmentLeak} from './project-environment';
import {humanApproval,review} from './human-approval';import {oauthClient} from './oauth-client';
import {mcpEndpoint} from './mcp-api';import {oauthPublic,mcpManage} from './mcp-auth';
import {repairApi} from './repair-api';
import {previewApi} from './preview-api';
import {buildApi} from './build-api';
import {terminalApi} from './terminal-api';
import {editorApi} from './editor-api';
import {codingAgentApi,verifyAgentApproval} from './coding-agent-api';
import {aiApi} from './ai-api';
import {persistence} from './persistence';
import {tenancy} from './tenancy';
import {quotaApi,enforceRoute,QuotaError,sweep,LIMITS,checkGauge} from './quota';import {ApiError,type Env,type Proposal} from './contracts';
import {authenticate,identity,issueSession,renewSession,project,rateLimit,role,IDLE_SECONDS} from './auth';
import {mfaApi,verifyMfaChallenge} from './mfa';
import {accountRecoveryApi} from './account-recovery';import {clientAuthenticate,kdfParams} from './client-auth';
import {canonical,digest,readBody,validateBundle,validateName} from './security';
async function route(req:Request,env:Env,ctx:ExecutionContext):Promise<Response>{
 const url=new URL(req.url),path=url.pathname,method=req.method;
 if(method==='OPTIONS'&&publicMcpPath(path))return new Response(null,{status:204});
 if(!['GET','HEAD','POST','PUT','PATCH','DELETE'].includes(method))throw new ApiError(405,'method_denied');
 if(url.href.length>8192)throw new ApiError(414,'request_target_too_long');
 // Bound every read, including public metadata and telemetry-triggering failures.
 if(['GET','HEAD'].includes(method))await rateLimit(req,env,'reads',240);
 else await rateLimit(req,env,'incoming-writes',120);
 const accountOAuth=await accountPublic(req,env);if(accountOAuth)return accountOAuth;if(path.startsWith('/.well-known/')&&!/^\/\.well-known\/(?:oauth-protected-resource\/mcp\/projects|oauth-authorization-server\/oauth\/projects)\/[^/]+$/.test(path))throw new ApiError(404,'not_found');const accountRpc=await accountEndpoint(req,env);if(accountRpc)return accountRpc;if(path==='/oauth/callback'){const callback=await oauthClient(req,env);if(callback)return callback;}const oauth=await oauthPublic(req,env);if(oauth)return oauth;if(path.startsWith('/.well-known/'))throw new ApiError(404,'not_found');const mcp=await mcpEndpoint(req,env);if(mcp)return mcp;
 if(path==='/api/health'&&method==='GET')return Response.json({service:'velnavoq-control',status:'ok',runtime:'disabled',supportedStack:'static-web-v1'});
 if(path==='/api/auth/kdf'&&method==='POST')return kdfParams(req,env);
 if((path==='/api/auth/register'||path==='/api/auth/login')&&method==='POST'){const peek=await readBody(req.clone());if('verifier' in peek)return clientAuthenticate(req,env,path.endsWith('register'));return authenticate(req,env,path.endsWith('register'))}
 if(path==='/api/auth/mfa/verify'&&method==='POST'){const verified=await verifyMfaChallenge(req,env);return issueSession(env,verified.userId);}
 const emailChange=await accountEmailChangeApi(req,env);if(emailChange)return emailChange;
 const emailIdentity=await platformEmailApi(req,env);if(emailIdentity)return emailIdentity;
 const accountRecovery=await accountRecoveryApi(req,env,ctx);if(accountRecovery)return accountRecovery;
 const who=await identity(req,env,!['GET','HEAD'].includes(method));
 const inbox=await approvalInbox(req,env,who);if(inbox)return inbox;const accountManagement=await accountManage(req,env,who);if(accountManagement)return accountManagement;const mfa=await mfaApi(req,env,who);if(mfa)return mfa;const scope=/^\/api\/projects\/([^/]+)/.exec(path);if(scope){await project(env,who.userId,scope[1]!);env.OBS_PROJECT_ID=scope[1]!;}const observed=await observabilityApi(req,env,who);if(observed)return observed;
 if(method!=='GET')await rateLimit(req,env,'writes',60);{const qr=await quotaApi(req,env,who);if(qr)return qr;if(Math.random()<0.02)ctx.waitUntil(sweep(env).catch(()=>{}));await enforceRoute(env,who,method,path,/\/proposals$/.test(path)&&method==='POST'?(await req.clone().text()).length:0);}
 if(!['GET','HEAD'].includes(method)&&!path.includes('/environment')&&req.headers.get('content-type')?.startsWith('application/json')){let target=/^\/api\/projects\/([^/]+)/.exec(path)?.[1];const proposalId=/^\/api\/proposals\/([^/]+)/.exec(path)?.[1];if(proposalId)target=(await env.DB.prepare('SELECT project_id FROM proposals WHERE id=?').bind(proposalId).first<{project_id:string}>())?.project_id;if(target){await project(env,who.userId,target);await rejectEnvironmentLeak(env,target,canonical(await readBody(req.clone())))}}const brief=await buildRequestsApi(req,env,who);if(brief)return brief;const savedApp=await savedAppApi(req,env,who);if(savedApp)return savedApp;const privateBuild=await privateBuildApi(req,env,who);if(privateBuild)return privateBuild;const backend=await backendApi(req,env,who);if(backend)return backend;const shipping=await deploymentApi(req,env,who,ctx);if(shipping)return shipping;const versioning=await versioningApi(req,env,who);if(versioning)return versioning;const projectRecovery=await recoveryApi(req,env,who);if(projectRecovery)return projectRecovery;const environment=await environmentApi(req,env,who);if(environment)return environment;const clientFlow=await oauthClient(req,env,who);if(clientFlow)return clientFlow;const human=await humanApproval(req,env,who);if(human)return human;const mcpManagement=await mcpManage(req,env,who);if(mcpManagement)return mcpManagement;
 const repairResponse=await repairApi(req,env,who);if(repairResponse)return repairResponse;
 const previewResponse=await previewApi(req,env,who);if(previewResponse)return previewResponse;
 const buildResponse=await buildApi(req,env,who);if(buildResponse)return buildResponse;
 const terminalResponse=await terminalApi(req,env,who);if(terminalResponse)return terminalResponse;
 const editorResponse=await editorApi(req,env,who);if(editorResponse)return editorResponse;
 const agentResponse=await codingAgentApi(req,env,who);if(agentResponse)return agentResponse;
 const aiResponse=await aiApi(req,env,who);if(aiResponse)return aiResponse;
 const persistedResponse=await persistence(req,env,who);if(persistedResponse)return persistedResponse;
 const tenantResponse=await tenancy(req,env,who);if(tenantResponse)return tenantResponse;
 if(path==='/api/auth/renew'&&method==='POST')return renewSession(req,env,who);
 if(path==='/api/auth/logout'&&method==='POST'){await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(who.sessionHash).run();const headers=new Headers();headers.append('set-cookie','__Host-velnavoq_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');headers.append('set-cookie','__Host-velnavoq_csrf=; Secure; SameSite=Lax; Path=/; Max-Age=0');return Response.json({ok:true},{headers});}
 if(path==='/api/platform-readiness'&&method==='GET')return Response.json(platformReadiness(env),{headers:{'cache-control':'no-store'}});
 if(path==='/api/me'&&method==='GET'){const u=await env.DB.prepare('SELECT email FROM users WHERE id=?').bind(who.userId).first<{email:string}>();const s=await env.DB.prepare('SELECT expires_at FROM sessions WHERE token_hash=?').bind(who.sessionHash).first<{expires_at:number}>();return Response.json({userId:who.userId,email:u?.email,expiresAt:s?.expires_at,idleTimeoutSeconds:IDLE_SECONDS});}
 const activity=/^\/api\/workspaces\/([^/]+)\/activity$/.exec(path);
 if(activity&&method==='GET'){await role(env,who.userId,activity[1]!);return Response.json((await env.DB.prepare('SELECT a.id,a.project_id,p.name as project_name,a.action,a.digest,a.created_at FROM audit_events a LEFT JOIN projects p ON p.id=a.project_id WHERE a.workspace_id=? ORDER BY a.id DESC LIMIT 100').bind(activity[1]).all()).results);}
 if(path==='/api/workspaces'&&method==='POST'){
 const body=await readBody(req),id=crypto.randomUUID(),name=validateName(body.name);
 // The quota preflight is advisory; admission must also be inside the serialized D1 batch.
 const saved=await env.DB.batch([env.DB.prepare("INSERT INTO workspaces(id,name,created_at) SELECT ?,?,? WHERE (SELECT count(*) FROM memberships WHERE user_id=? AND role='owner')<?").bind(id,name,Date.now(),who.userId,LIMITS['workspaces.total'].limit),env.DB.prepare("INSERT INTO memberships(workspace_id,user_id,role) SELECT ?,?,'owner' WHERE EXISTS(SELECT 1 FROM workspaces WHERE id=?)").bind(id,who.userId,id)]);
 if(!saved[0]!.meta.changes){await checkGauge(env,'workspaces.total',who.userId,1);throw new ApiError(409,'workspace_admission_changed');}return Response.json({id,name},{status:201});}
 if(path==='/api/workspaces'&&method==='GET')return Response.json((await env.DB.prepare('SELECT w.id,w.name,m.role FROM workspaces w JOIN memberships m ON w.id=m.workspace_id WHERE m.user_id=?').bind(who.userId).all()).results);
 const ws=/^\/api\/workspaces\/([^/]+)\/projects$/.exec(path);
 if(ws){const workspaceId=ws[1]!;await role(env,who.userId,workspaceId,method==='GET'?['owner','editor','viewer']:['owner','editor']);
 if(method==='GET')return Response.json((await env.DB.prepare('SELECT id,name,revision,release_digest FROM projects WHERE workspace_id=?').bind(workspaceId).all()).results);
 if(method==='POST'){const b=await readBody(req),name=validateName(b.name),id=crypto.randomUUID();const saved=await env.DB.batch([env.DB.prepare('INSERT INTO projects(id,workspace_id,name,created_at,created_by) SELECT ?,?,?,?,? WHERE (SELECT count(*) FROM projects WHERE workspace_id=?)<?').bind(id,workspaceId,name,Date.now(),who.userId,workspaceId,LIMITS['projects.total'].limit),env.DB.prepare('INSERT INTO ai_budgets(project_id,token_limit) SELECT ?,? WHERE EXISTS(SELECT 1 FROM projects WHERE id=?)').bind(id,40000,id)]);
 if(!saved[0]!.meta.changes){await checkGauge(env,'projects.total',workspaceId,1);throw new ApiError(409,'project_admission_changed');}return Response.json({id,name,revision:0},{status:201});}}
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
 if(proposal.status===desired)return Response.json({status:desired,idempotent:true});if(proposal.status!=='pending')throw new ApiError(409,'proposal_terminal');if(desired==='approved'&&proposal.base_revision!==p.revision)throw new ApiError(409,'stale_revision');const manifest=await review(env,proposal);if(b.reviewDigest!==manifest.reviewDigest||b.baseRevision!==proposal.base_revision||desired==='approved'&&(b.acceptRisk!==manifest.risk||manifest.risk==='high'&&b.approveDestructive!==true))throw new ApiError(409,'exact_review_required');
 try{const results=await env.DB.batch([env.DB.prepare('UPDATE proposals SET status=?,approved_by=?,decided_at=? WHERE id=? AND status=?').bind(desired,who.userId,Date.now(),proposal.id,'pending'),env.DB.prepare('INSERT INTO human_review_audit(proposal_id,project_id,actor_id,decision,proposal_digest,review_digest,base_revision,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(proposal.id,p.id,who.userId,decision[2],proposal.digest,manifest.reviewDigest,proposal.base_revision,Date.now())]);if(!results[0]!.meta.changes)throw new ApiError(409,'proposal_changed');}catch(e){if(e instanceof ApiError)throw e;throw new ApiError(409,'atomic_approval_conflict');}return Response.json({status:desired});}}
 throw new ApiError(404,'not_found');
}
export default {async fetch(req:Request,env:Env,ctx:ExecutionContext):Promise<Response>{
 const requestId=crypto.randomUUID(),started=Date.now();env={...env,OBS_REQUEST_ID:requestId};let res:Response;
 try{res=await route(req,env,ctx);}catch(e){if(e instanceof QuotaError){const h=new Headers();if(e.detail.retryAfterSeconds)h.set('retry-after',String(e.detail.retryAfterSeconds));res=Response.json({error:e.code,...e.detail,requestId},{status:e.status,headers:h});}else if(e instanceof ApiError)res=Response.json({error:e.code,...safeBackendError(e),requestId},{status:e.status});else{res=Response.json({error:'internal_error',requestId},{status:500});}}
 res=publicCors(req,res);const stored=await observeRequest(env,req,res,started);const h=new Headers(res.headers);if(!stored)h.set('x-observability-status','unavailable');h.set('cache-control','no-store');h.set('x-content-type-options','nosniff');h.set('cross-origin-opener-policy','same-origin');h.set('cross-origin-resource-policy','same-origin');h.set('origin-agent-cluster','?1');h.set('permissions-policy','camera=(), microphone=(), geolocation=(), payment=()');h.set('referrer-policy','no-referrer');if(new URL(req.url).protocol==='https:')h.set('strict-transport-security','max-age=31536000; includeSubDomains');h.set('x-request-id',requestId);h.set('content-security-policy',"default-src 'none'; frame-ancestors 'none'");return new Response(res.body,{status:res.status,headers:h});
}};
