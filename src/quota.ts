import {ApiError,type Env,type Identity} from './contracts';
/**
 * Part 24: abuse, quota and cost control. One registry (LIMITS) is the single source of truth for every
 * number; the API, the usage panel, the user messages and docs/ABUSE-CONTROL.md all read from it.
 * Free-only: nothing here assumes a paid plan. Limits are conservative caps, not a billing calculator.
 */
export type Scope='user'|'workspace'|'project'|'global'|'account';
export type Windowed='minute'|'hour'|'day';
export interface Limit{scope:Scope;window:Windowed|'total';limit:number;label:string;threat:string}
const MIB=1024*1024;
export const LIMITS={
 'exports.day':{scope:'project',window:'day',limit:20,label:'project exports',threat:'storage and network abuse'},
 'imports.day':{scope:'workspace',window:'day',limit:10,label:'project imports',threat:'storage abuse'},
 'recovery.sweeps.hour':{scope:'project',window:'hour',limit:30,label:'job recovery checks',threat:'CPU abuse'},
 'requests.minute':{scope:'user',window:'minute',limit:300,label:'requests',threat:'network abuse'},
 'workspaces.total':{scope:'user',window:'total',limit:5,label:'workspaces you own',threat:'user quota'},
 'storage.bytes.user':{scope:'user',window:'total',limit:100*MIB,label:'bytes of stored source and build output across your workspaces',threat:'storage abuse'},
 'ai.tokens.day.user':{scope:'user',window:'day',limit:60000,label:'AI tokens',threat:'denial-of-wallet'},
 'jobs.active.user':{scope:'user',window:'total',limit:4,label:'jobs running at once across all your projects',threat:'CPU abuse'},
 'projects.total':{scope:'workspace',window:'total',limit:10,label:'projects in this workspace',threat:'workspace quota'},
 'storage.bytes.workspace':{scope:'workspace',window:'total',limit:50*MIB,label:'bytes of stored source and build output in this workspace',threat:'storage abuse'},
 'ai.tokens.day.workspace':{scope:'workspace',window:'day',limit:60000,label:'AI tokens',threat:'denial-of-wallet'},
 'storage.bytes.project':{scope:'project',window:'total',limit:10*MIB,label:'bytes of stored source history and build output in this project',threat:'storage abuse'},
 'jobs.active.project':{scope:'project',window:'total',limit:2,label:'jobs running at once in this project',threat:'infinite builds, CPU and memory abuse'},
 'proposals.day':{scope:'project',window:'day',limit:100,label:'change proposals',threat:'storage abuse'},
 'builds.hour':{scope:'project',window:'hour',limit:10,label:'builds',threat:'infinite builds'},
 'builds.day':{scope:'project',window:'day',limit:30,label:'builds',threat:'infinite builds'},
 'terminal.hour':{scope:'project',window:'hour',limit:120,label:'terminal runs',threat:'CPU abuse, package-install abuse'},
 'previews.hour':{scope:'project',window:'hour',limit:30,label:'preview starts',threat:'CPU and network abuse'},
 'repair.day':{scope:'project',window:'day',limit:10,label:'AI repair runs',threat:'infinite AI loops'},
 'agent.hour':{scope:'project',window:'hour',limit:20,label:'AI coding agent runs',threat:'infinite AI loops'},
 'ai.requests.minute':{scope:'project',window:'minute',limit:10,label:'AI requests',threat:'infinite AI loops'},
 'ai.tokens.day.project':{scope:'project',window:'day',limit:40000,label:'AI tokens',threat:'denial-of-wallet'},
 'deploys.hour':{scope:'project',window:'hour',limit:4,label:'deployments',threat:'deployment spam'},
 'deploys.day':{scope:'project',window:'day',limit:10,label:'deployments',threat:'deployment spam'},
 'editor.saves.hour':{scope:'project',window:'hour',limit:600,label:'editor saves',threat:'storage abuse'},
 'versions.day':{scope:'project',window:'day',limit:100,label:'version snapshots',threat:'storage abuse'},
 'environment.writes.hour':{scope:'project',window:'hour',limit:60,label:'environment or secret changes',threat:'credential abuse'},
 'environment.entries':{scope:'project',window:'total',limit:50,label:'environment entries',threat:'storage and credential abuse'},
 'mcp.calls.minute':{scope:'project',window:'minute',limit:60,label:'MCP tool calls',threat:'MCP tool abuse'},
 'mcp.admin.day':{scope:'project',window:'day',limit:30,label:'MCP client, token or consent changes',threat:'MCP and credential abuse'},
 'ai.tokens.day.global':{scope:'global',window:'day',limit:120000,label:'AI tokens across the whole service',threat:'denial-of-wallet: sized to stay under the free Workers AI allowance of 10,000 neurons/day, based on one reported sample (see ABUSE-CONTROL.md)'},
 'login.failed.hour':{scope:'account',window:'hour',limit:10,label:'failed sign-ins for this account',threat:'credential abuse'}
} as const satisfies Record<string,Limit>;
export type Metric=keyof typeof LIMITS;
export const SECONDS={minute:60,hour:3600,day:86400} as const;
export const STRIKE_LIMIT=25,STRIKE_WINDOW_MS=10*60000,COOLDOWN_MS=15*60000;
export interface QuotaDetail{metric:string;scope:Scope;limit:number;used:number;window:string;resetsAt:string|null;retryAfterSeconds:number|null;message:string}
export class QuotaError extends ApiError{constructor(status:number,code:string,public detail:QuotaDetail){super(status,code)}}
/** Plain-language messages. Never expose ids, other users or internals. */
export function messageFor(metric:string,used:number,limit:number,windowName:string,retry:number|null):string{
 const l=LIMITS[metric as Metric];const what=l?.label??metric;
 if(metric==='login.failed.hour')return 'Too many failed sign-in attempts. Sign-in for this account is paused for about '+Math.ceil((retry??3600)/60)+' minutes. Nothing was changed.';
 if(metric==='ai.tokens.day.global')return 'AI is paused for everyone today to stay inside the free usage allowance. It resumes in about '+Math.ceil((retry??0)/3600)+' hours. Your work is saved.';
 if(windowName==='total')return 'You have reached the limit of '+limit+' '+what+'. Remove one you no longer need, then try again.';
 const wait=retry===null?'':retry<90?' Try again in '+retry+' seconds.':retry<5400?' Try again in about '+Math.ceil(retry/60)+' minutes.':' It resets in about '+Math.ceil(retry/3600)+' hours.';
 return 'You have used '+Math.min(used,limit)+' of '+limit+' '+what+' per '+windowName+'.'+wait+' Nothing was lost.';
}
function windowStart(w:Windowed,now:number){const s=SECONDS[w]*1000;return Math.floor(now/s)*s}
function detail(metric:Metric,used:number,now:number):QuotaDetail{const l:Limit=LIMITS[metric];let resets:number|null=null,retry:number|null=null;if(l.window!=='total'){resets=windowStart(l.window,now)+SECONDS[l.window]*1000;retry=Math.max(1,Math.ceil((resets-now)/1000))}
 return {metric,scope:l.scope,limit:l.limit,used,window:l.window,resetsAt:resets?new Date(resets).toISOString():null,retryAfterSeconds:retry,message:messageFor(metric,used,l.limit,l.window,retry)}}
async function deny(env:Env,metric:Metric,scopeId:string,userId:string|null,used:number,now:number):Promise<never>{
 const l:Limit=LIMITS[metric];
 try{await env.DB.prepare('INSERT INTO quota_denials(scope,scope_id,metric,user_id,created_at) VALUES(?,?,?,?,?)').bind(l.scope,scopeId,metric,userId,now).run();
  if(userId&&metric!=='login.failed.hour'){const n=await env.DB.prepare('SELECT count(*) AS n FROM quota_denials WHERE user_id=? AND created_at>?').bind(userId,now-STRIKE_WINDOW_MS).first<{n:number}>();
   if((n?.n??0)>=STRIKE_LIMIT)await env.DB.prepare("INSERT INTO abuse_cooldowns(user_id,until,reason,created_at) VALUES(?,?,'repeated_limit_hits',?) ON CONFLICT(user_id) DO UPDATE SET until=excluded.until,reason=excluded.reason").bind(userId,now+COOLDOWN_MS,now).run()}}catch{/* denial logging must never turn a denial into a 500 */}
 const d=detail(metric,used,now);throw new QuotaError(l.window==='total'?403:429,'quota_exceeded',d);
}
/** Atomically add `amount`; the UPDATE only applies while the total stays within the limit. Fails closed on any D1 error. */
export async function consume(env:Env,metric:Metric,scopeId:string,amount=1,userId:string|null=null,now=Date.now()):Promise<number>{
 const l:Limit=LIMITS[metric];if(l.window==='total')throw new Error('gauge_metric_is_not_consumable');
 if(!Number.isInteger(amount)||amount<=0)throw new ApiError(400,'invalid_quota_amount');
 if(amount>l.limit)return deny(env,metric,scopeId,userId,0,now);
 const ws=windowStart(l.window,now);
 const row=await env.DB.prepare('INSERT INTO usage_counters(scope,scope_id,metric,window_start,count) VALUES(?,?,?,?,?) ON CONFLICT(scope,scope_id,metric,window_start) DO UPDATE SET count=count+excluded.count WHERE count+excluded.count<=? RETURNING count').bind(l.scope,scopeId,metric,ws,amount,l.limit).first<{count:number}>();
 if(row)return row.count;
 const cur=await env.DB.prepare('SELECT count FROM usage_counters WHERE scope=? AND scope_id=? AND metric=? AND window_start=?').bind(l.scope,scopeId,metric,ws).first<{count:number}>();
 return deny(env,metric,scopeId,userId,cur?.count??l.limit,now);
}
/** Give back unused reservation (for example AI tokens reserved but not spent). Never goes below zero. */
export async function refund(env:Env,metric:Metric,scopeId:string,amount:number,now=Date.now()):Promise<void>{
 const l:Limit=LIMITS[metric];if(l.window==='total'||amount<=0)return;
 await env.DB.prepare('UPDATE usage_counters SET count=max(0,count-?) WHERE scope=? AND scope_id=? AND metric=? AND window_start=?').bind(Math.floor(amount),l.scope,scopeId,metric,windowStart(l.window,now)).run();
}
export async function readCount(env:Env,metric:Metric,scopeId:string,now=Date.now()):Promise<number>{
 const l:Limit=LIMITS[metric];if(l.window==='total')return 0;
 return (await env.DB.prepare('SELECT count FROM usage_counters WHERE scope=? AND scope_id=? AND metric=? AND window_start=?').bind(l.scope,scopeId,metric,windowStart(l.window,now)).first<{count:number}>())?.count??0;
}
/* Gauges: current stored amounts, counted from the real tables so they cannot drift. */
export async function projectStorage(env:Env,projectId:string):Promise<number>{
 const r=await env.DB.prepare('SELECT (SELECT COALESCE(SUM(byte_size),0) FROM file_versions WHERE project_id=?1)+(SELECT COALESCE(SUM(bytes),0) FROM build_artifacts WHERE job_id IN(SELECT id FROM build_jobs WHERE project_id=?1))+(SELECT COALESCE(SUM(byte_size),0) FROM ship_artifacts WHERE project_id=?1) AS n').bind(projectId).first<{n:number}>();return r?.n??0}
export async function workspaceStorage(env:Env,workspaceId:string):Promise<number>{
 const r=await env.DB.prepare('SELECT COALESCE(SUM((SELECT COALESCE(SUM(byte_size),0) FROM file_versions WHERE project_id=p.id)+(SELECT COALESCE(SUM(bytes),0) FROM build_artifacts WHERE job_id IN(SELECT id FROM build_jobs WHERE project_id=p.id))+(SELECT COALESCE(SUM(byte_size),0) FROM ship_artifacts WHERE project_id=p.id)),0) AS n FROM projects p WHERE p.workspace_id=?').bind(workspaceId).first<{n:number}>();return r?.n??0}
export async function userStorage(env:Env,userId:string):Promise<number>{
 const r=await env.DB.prepare("SELECT COALESCE(SUM((SELECT COALESCE(SUM(byte_size),0) FROM file_versions WHERE project_id=p.id)+(SELECT COALESCE(SUM(bytes),0) FROM build_artifacts WHERE job_id IN(SELECT id FROM build_jobs WHERE project_id=p.id))+(SELECT COALESCE(SUM(byte_size),0) FROM ship_artifacts WHERE project_id=p.id)),0) AS n FROM projects p WHERE p.workspace_id IN(SELECT workspace_id FROM memberships WHERE user_id=? AND role='owner')").bind(userId).first<{n:number}>();return r?.n??0}
/** Jobs still inside their own deadline. Expired rows never count, so a crashed job cannot lock a project forever. */
export async function activeJobs(env:Env,by:{projectId:string}|{userId:string},now=Date.now()):Promise<number>{
 const col='projectId' in by?'project_id':'user_id',key='projectId' in by?by.projectId:by.userId;
 const shipCol='projectId' in by?'project_id':'requested_by';
 const r=await env.DB.prepare(`SELECT (SELECT count(*) FROM build_jobs WHERE ${col}=?1 AND status='running' AND deadline_at>?2)+(SELECT count(*) FROM terminal_jobs WHERE ${col}=?1 AND status='running' AND deadline_at>?2)+(SELECT count(*) FROM ship_jobs WHERE ${shipCol}=?1 AND status IN('queued','building','deploying','checking') AND deadline_at>?2) AS n`).bind(key,now).first<{n:number}>();return r?.n??0}
function gauge(metric:Metric,used:number,adding:number,now:number){const l:Limit=LIMITS[metric];if(used+adding>l.limit)throw new QuotaError(403,'quota_exceeded',detail(metric,used,now))}
export async function gaugeValue(env:Env,metric:Metric,scopeId:string,now=Date.now()):Promise<number>{
 if(metric==='workspaces.total')return (await env.DB.prepare("SELECT count(*) AS n FROM memberships WHERE user_id=? AND role='owner'").bind(scopeId).first<{n:number}>())?.n??0;
 if(metric==='projects.total')return (await env.DB.prepare('SELECT count(*) AS n FROM projects WHERE workspace_id=?').bind(scopeId).first<{n:number}>())?.n??0;
 if(metric==='environment.entries')return (await env.DB.prepare('SELECT count(*) AS n FROM project_environment_entries WHERE project_id=?').bind(scopeId).first<{n:number}>())?.n??0;
 if(metric==='storage.bytes.project')return projectStorage(env,scopeId);
 if(metric==='storage.bytes.workspace')return workspaceStorage(env,scopeId);
 if(metric==='storage.bytes.user')return userStorage(env,scopeId);
 if(metric==='jobs.active.project')return activeJobs(env,{projectId:scopeId},now);
 if(metric==='jobs.active.user')return activeJobs(env,{userId:scopeId},now);
 throw new Error('not_a_gauge');
}
export async function checkGauge(env:Env,metric:Metric,scopeId:string,adding=1,now=Date.now()):Promise<void>{gauge(metric,await gaugeValue(env,metric,scopeId,now),adding,now)}
export async function assertNoCooldown(env:Env,userId:string,now=Date.now()):Promise<void>{
 const r=await env.DB.prepare('SELECT until FROM abuse_cooldowns WHERE user_id=?').bind(userId).first<{until:number}>();
 if(r&&r.until>now){const retry=Math.ceil((r.until-now)/1000);throw new QuotaError(429,'cooldown_active',{metric:'cooldown',scope:'user',limit:STRIKE_LIMIT,used:STRIKE_LIMIT,window:'minute',resetsAt:new Date(r.until).toISOString(),retryAfterSeconds:retry,message:'You hit limits many times in a row, so costly actions are paused for about '+Math.ceil(retry/60)+' minutes. Reading and saving your work still works.'})}
 if(r)await env.DB.prepare('DELETE FROM abuse_cooldowns WHERE user_id=? AND until<=?').bind(userId,now).run();
}
/* AI cost control: global, user and workspace daily token caps wrap the existing per-project D1 budget (ai_reserve trigger). */
export async function reserveAiTokens(env:Env,projectId:string,tokens:number,now=Date.now()):Promise<()=>Promise<void>>{
 if(env.QUOTA_FREEZE_AI==='true')throw new QuotaError(503,'ai_paused',{metric:'ai.freeze',scope:'global',limit:0,used:0,window:'day',resetsAt:null,retryAfterSeconds:null,message:'AI is paused by the operator to protect the free usage allowance. Your work is saved. Try again later.'});
 const p=await env.DB.prepare('SELECT p.workspace_id AS w,(SELECT user_id FROM memberships WHERE workspace_id=p.workspace_id AND role=\'owner\' ORDER BY user_id LIMIT 1) AS u FROM projects p WHERE p.id=?').bind(projectId).first<{w:string;u:string|null}>();
 if(!p)throw new ApiError(404,'project_not_found');
 const taken:Array<[Metric,string]>=[];
 try{for(const [m,id] of [['ai.tokens.day.global','all'],['ai.tokens.day.user',p.u??'none'],['ai.tokens.day.workspace',p.w],['ai.tokens.day.project',projectId]] as Array<[Metric,string]>){await consume(env,m,id,tokens,null,now);taken.push([m,id])}}
 catch(e){for(const [m,id] of taken)await refund(env,m,id,tokens,now);throw e}
 return async()=>{for(const [m,id] of taken)await refund(env,m,id,tokens,now)};
}
/** After settlement, give back the unused part of the reservation to every daily counter. */
export async function settleAiTokens(env:Env,projectId:string,reserved:number,actual:number|undefined,now=Date.now()):Promise<void>{
 if(actual===undefined||actual>=reserved)return;const p=await env.DB.prepare('SELECT p.workspace_id AS w,(SELECT user_id FROM memberships WHERE workspace_id=p.workspace_id AND role=\'owner\' ORDER BY user_id LIMIT 1) AS u FROM projects p WHERE p.id=?').bind(projectId).first<{w:string;u:string|null}>();if(!p)return;
 for(const [m,id] of [['ai.tokens.day.global','all'],['ai.tokens.day.user',p.u??'none'],['ai.tokens.day.workspace',p.w],['ai.tokens.day.project',projectId]] as Array<[Metric,string]>)await refund(env,m,id,reserved-actual,now);
}
/* Credential abuse: failed sign-ins are counted per hashed account key, whether or not the account exists (no enumeration). */
export async function assertSignInAllowed(env:Env,accountKey:string,now=Date.now()):Promise<void>{
 const used=await readCount(env,'login.failed.hour',accountKey,now);if(used>=LIMITS['login.failed.hour'].limit)throw new QuotaError(429,'account_locked_temporarily',detail('login.failed.hour',used,now));}
export async function recordSignInFailure(env:Env,accountKey:string,now=Date.now()):Promise<void>{
 const ws=windowStart('hour',now);await env.DB.prepare('INSERT INTO usage_counters(scope,scope_id,metric,window_start,count) VALUES(?,?,?,?,1) ON CONFLICT(scope,scope_id,metric,window_start) DO UPDATE SET count=count+1').bind('account',accountKey,'login.failed.hour',ws).run()}
export async function clearSignInFailures(env:Env,accountKey:string):Promise<void>{await env.DB.prepare("DELETE FROM usage_counters WHERE scope='account' AND scope_id=? AND metric='login.failed.hour'").bind(accountKey).run()}
/* Route rules: which request spends what. Only the request that STARTS costly work is counted, not its follow-up events. */
interface Rule{method:string;re:RegExp;spend:Array<{metric:Metric;target:'project'|'user'}>;gauges?:Array<{metric:Metric;target:'project'|'user'|'workspaceOfProject'}>;adds?:'proposal'}
const P='^\\/api\\/projects\\/([^/]+)';
export const RULES:Rule[]=[
 {method:'POST',re:new RegExp(P+'\\/build$'),spend:[{metric:'builds.hour',target:'project'},{metric:'builds.day',target:'project'}],gauges:[{metric:'jobs.active.project',target:'project'},{metric:'jobs.active.user',target:'user'}]},
 {method:'POST',re:new RegExp(P+'\\/terminal$'),spend:[{metric:'terminal.hour',target:'project'}],gauges:[{metric:'jobs.active.project',target:'project'},{metric:'jobs.active.user',target:'user'}]},
 {method:'POST',re:new RegExp(P+'\\/preview$'),spend:[{metric:'previews.hour',target:'project'}]},
 {method:'POST',re:new RegExp(P+'\\/repair$'),spend:[{metric:'repair.day',target:'project'}]},
 {method:'POST',re:new RegExp(P+'\\/agent\\/run$'),spend:[{metric:'agent.hour',target:'project'}]},
 {method:'POST',re:new RegExp(P+'\\/ai\\/requests$'),spend:[{metric:'ai.requests.minute',target:'project'}]},
 {method:'POST',re:new RegExp(P+'\\/deployment\\/jobs$'),spend:[{metric:'deploys.hour',target:'project'},{metric:'deploys.day',target:'project'}],gauges:[{metric:'jobs.active.project',target:'project'},{metric:'jobs.active.user',target:'user'}]},
 {method:'POST',re:new RegExp(P+'\\/deployment\\/rollback$'),spend:[{metric:'deploys.hour',target:'project'},{metric:'deploys.day',target:'project'}],gauges:[{metric:'jobs.active.project',target:'project'}]},
 {method:'POST',re:new RegExp(P+'\\/proposals$'),spend:[{metric:'proposals.day',target:'project'}],gauges:[{metric:'storage.bytes.project',target:'project'},{metric:'storage.bytes.workspace',target:'workspaceOfProject'},{metric:'storage.bytes.user',target:'user'}],adds:'proposal'},
 {method:'POST',re:new RegExp(P+'\\/editor\\/save$'),spend:[{metric:'editor.saves.hour',target:'project'}],gauges:[{metric:'storage.bytes.project',target:'project'}]},
 {method:'POST',re:new RegExp(P+'\\/versioning\\/snapshot$'),spend:[{metric:'versions.day',target:'project'}]},
 {method:'POST',re:new RegExp(P+'\\/environment\\/entries$'),spend:[{metric:'environment.writes.hour',target:'project'}],gauges:[{metric:'environment.entries',target:'project'}]},
 {method:'PUT',re:new RegExp(P+'\\/environment\\/entries\\/[^/]+$'),spend:[{metric:'environment.writes.hour',target:'project'}]},
 {method:'DELETE',re:new RegExp(P+'\\/environment\\/entries\\/[^/]+$'),spend:[{metric:'environment.writes.hour',target:'project'}]},
 {method:'POST',re:new RegExp(P+'\\/mcp\\/(clients|tokens)$'),spend:[{metric:'mcp.admin.day',target:'project'}]},
 {method:'POST',re:new RegExp(P+'\\/mcp\\/consents\\/[^/]+\\/(approve|deny)$'),spend:[{metric:'mcp.admin.day',target:'project'}]}
];
export function matchRule(method:string,path:string):{rule:Rule;projectId:string}|null{for(const rule of RULES){if(rule.method!==method)continue;const m=rule.re.exec(path);if(m)return {rule,projectId:m[1]!}}return null}
/** Called once per authenticated request, after identity and project membership are proven and before any work is done. */
export async function enforceRoute(env:Env,who:Identity,method:string,path:string,bodyBytes=0,now=Date.now()):Promise<void>{
 await consume(env,'requests.minute',who.userId,1,who.userId,now);
 if(method==='POST'&&path==='/api/workspaces'){await assertNoCooldown(env,who.userId,now);await checkGauge(env,'workspaces.total',who.userId,1,now);return}
 const ws=/^\/api\/workspaces\/([^/]+)\/projects$/.exec(path);
 if(method==='POST'&&ws){await assertNoCooldown(env,who.userId,now);await checkGauge(env,'projects.total',ws[1]!,1,now);return}
 const hit=matchRule(method,path);if(!hit)return;
 await assertNoCooldown(env,who.userId,now);
 const {rule,projectId}=hit;
 for(const g of rule.gauges??[]){const adding=g.metric.startsWith('storage')&&rule.adds==='proposal'?bodyBytes:g.metric.startsWith('jobs')?1:0;
  const id=g.target==='project'?projectId:g.target==='user'?who.userId:(await env.DB.prepare('SELECT workspace_id AS w FROM projects WHERE id=?').bind(projectId).first<{w:string}>())?.w??'';
  await checkGauge(env,g.metric,id,adding,now)}
 for(const s of rule.spend)await consume(env,s.metric,s.target==='project'?projectId:who.userId,1,who.userId,now);
}
/** Housekeeping: windows older than two days and old denial rows are deleted. Cheap, indexed, bounded. */
export async function sweep(env:Env,now=Date.now()):Promise<void>{
 await env.DB.batch([env.DB.prepare('DELETE FROM usage_counters WHERE window_start<?').bind(now-2*86400000),env.DB.prepare('DELETE FROM quota_denials WHERE created_at<?').bind(now-7*86400000)])}
/** Read-only usage report for the panel. Shows only the caller's own scope; no other user's data. */
export async function report(env:Env,userId:string,projectId?:string,now=Date.now()){
 const rows:Array<{metric:string;scope:Scope;window:string;limit:number;used:number;percent:number;label:string;resetsAt:string|null}>=[];
 const ws=projectId?(await env.DB.prepare('SELECT workspace_id AS w FROM projects WHERE id=?').bind(projectId).first<{w:string}>())?.w:undefined;
 const gauges:Record<string,()=>Promise<number>>={'workspaces.total':()=>gaugeValue(env,'workspaces.total',userId),'storage.bytes.user':()=>userStorage(env,userId),'jobs.active.user':()=>activeJobs(env,{userId},now)};
 if(projectId){gauges['storage.bytes.project']=()=>projectStorage(env,projectId);gauges['jobs.active.project']=()=>activeJobs(env,{projectId},now);gauges['environment.entries']=()=>gaugeValue(env,'environment.entries',projectId);if(ws){gauges['projects.total']=()=>gaugeValue(env,'projects.total',ws);gauges['storage.bytes.workspace']=()=>workspaceStorage(env,ws)}}
 for(const [metric,l] of Object.entries(LIMITS) as Array<[Metric,Limit]>){
  let id:string|undefined;if(l.scope==='user')id=userId;else if(l.scope==='project')id=projectId;else if(l.scope==='workspace')id=ws;else if(l.scope==='global')id='all';else continue;if(!id)continue;
  if(metric==='ai.tokens.day.user'){const o=(await env.DB.prepare("SELECT 1 AS x FROM memberships WHERE user_id=? AND role='owner' LIMIT 1").bind(userId).first());if(!o)continue}
  const used=l.window==='total'?await (gauges[metric]?.()??Promise.resolve(0)):await readCount(env,metric,id,now);
  const resets=l.window==='total'?null:new Date(windowStart(l.window,now)+SECONDS[l.window]*1000).toISOString();
  rows.push({metric,scope:l.scope,window:l.window,limit:l.limit,used,percent:Math.min(100,Math.round(used/l.limit*100)),label:l.label,resetsAt:resets})}
 return {generatedAt:new Date(now).toISOString(),limits:rows};
}
export async function quotaApi(req:Request,env:Env,who:Identity):Promise<Response|null>{
 const path=new URL(req.url).pathname;
 if(req.method!=='GET')return null;
 if(path==='/api/quota')return Response.json(await report(env,who.userId));
 const m=/^\/api\/projects\/([^/]+)\/quota$/.exec(path);if(m)return Response.json(await report(env,who.userId,m[1]!));
 return null;
}
