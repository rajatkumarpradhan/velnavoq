import {rejectEnvironmentLeak} from './project-environment';
import {ApiError,type Env,type Identity,type Project} from './contracts';
import {AIEngine,AIError} from './ai';
import {WorkersAIProvider} from './ai-adapters';
import {D1Budget,D1Audit} from './ai-storage';
import {EnginePlanner} from './coding-agent-planner';
import {snapshot,context,validateChanges} from './coding-agent';
import {canonical,digest,readBody} from './security';
import {project} from './auth';

/** Server-selected provider. Model output creates review-only proposals, never effects. */
export async function generate(req:Request,env:Env,who:Identity,p:Project,missingCode:string):Promise<Response>{
 await project(env,who.userId,p.id,['owner','editor']);
 if(env.QUOTA_FREEZE_AI==='true')throw new ApiError(503,'ai_paused');
 if(env.AI_REPAIR_ENABLED!=='true'||!env.AI)throw new ApiError(503,missingCode);
 const body=await readBody(req);
 const instructions=body.instructions??body.prompt;
 if(typeof instructions!=='string')throw new ApiError(400,'agent_instructions_denied');
 const rows=p.revision?(await env.DB.prepare('SELECT path,content FROM file_versions WHERE project_id=? AND version=?').bind(p.id,p.revision).all()).results:[];
 const s=await snapshot(p.id,p.revision,Object.fromEntries(rows.map((f:any)=>[f.path,f.content])));
 if(body.baseRevision!==p.revision||body.sourceDigest!==s.sourceDigest)throw new ApiError(409,'stale_agent_snapshot');
 const c=await context(s,instructions);
 const budget=await env.DB.prepare('SELECT token_limit,charged_tokens FROM ai_budgets WHERE project_id=?').bind(p.id).first<any>();
 if(!budget||budget.token_limit-budget.charged_tokens<18048)throw new ApiError(409,'agent_project_token_budget_required');
 const planner=new EnginePlanner(new AIEngine([new WorkersAIProvider(env.AI)],new D1Budget(env.DB),new D1Audit(env.DB)),'@cf/qwen/qwen2.5-coder-32b-instruct',p.id,{maxInputTokens:16000,maxOutputTokens:2048,maxFileChanges:10,timeoutMs:20000});
 let raw:unknown;
 try{raw=await planner.plan(c,{attempt:1,error:null},req.signal)}catch(e){if(e instanceof AIError)throw new ApiError(e.code==='rate_limited'?429:503,'agent_ai_'+e.code);throw e}
 const patch=await validateChanges(s,raw);
 await rejectEnvironmentLeak(env,p.id,canonical(patch.bundle));
 const fresh=await project(env,who.userId,p.id,['owner','editor']);
 if(fresh.revision!==s.revision)throw new ApiError(409,'stale_agent_snapshot');
 const id=crypto.randomUUID(),bundle=canonical(patch.bundle),hash=await digest(bundle);
 await env.DB.batch([
  env.DB.prepare('INSERT INTO proposals(id,project_id,base_revision,digest,bundle_json,author_id,created_at) VALUES(?,?,?,?,?,?,?)').bind(id,p.id,p.revision,hash,bundle,who.userId,Date.now()),
  env.DB.prepare('INSERT INTO agent_patches(proposal_id,patch_digest,source_digest,changes_json,destructive) VALUES(?,?,?,?,?)').bind(id,patch.patchDigest,s.sourceDigest,canonical(patch.changes),patch.destructive?1:0)
 ]);
 return Response.json({id,digest:hash,patchDigest:patch.patchDigest,changes:patch.changes,requiresOwnerApproval:true,applied:false},{status:201});
}
