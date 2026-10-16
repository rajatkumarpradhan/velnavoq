/** A durable requirements handoff, deliberately separate from execution and consent. */
import {ApiError,type Env,type Identity} from './contracts';
import {project} from './auth';
import {readBody} from './security';
export async function latestBuildRequest(env:Env,projectId:string){
 return env.DB.prepare('SELECT id,instructions,base_revision,created_at FROM project_build_requests WHERE project_id=? ORDER BY created_at DESC,id DESC LIMIT 1').bind(projectId).first();
}
export async function buildRequestsApi(req:Request,env:Env,who:Identity):Promise<Response|null>{
 const match=/^\/api\/projects\/([^/]+)\/build-requests$/.exec(new URL(req.url).pathname);if(!match)return null;
 const p=await project(env,who.userId,match[1]!,req.method==='GET'?['owner','editor','viewer']:['owner','editor']);
 if(req.method==='GET')return Response.json({requests:(await env.DB.prepare('SELECT id,instructions,base_revision,created_at FROM project_build_requests WHERE project_id=? ORDER BY created_at DESC,id DESC LIMIT 40').bind(p.id).all()).results,executionStarted:false});
 if(req.method!=='POST')throw new ApiError(405,'method_denied');
 const b=await readBody(req);if(typeof b.instructions!=='string'||!b.instructions.trim()||b.instructions.length>4000||typeof b.requestId!=='string'||!/^[a-f0-9-]{36}$/.test(b.requestId))throw new ApiError(400,'build_request_invalid');
 const instructions=b.instructions.trim();
 const existing=await env.DB.prepare('SELECT project_id,instructions,base_revision FROM project_build_requests WHERE id=?').bind(b.requestId).first<any>();
 if(existing){if(existing.project_id!==p.id||existing.instructions!==instructions||existing.base_revision!==b.baseRevision)throw new ApiError(409,'build_request_id_conflict');return Response.json({id:b.requestId,saved:true,executionStarted:false,idempotent:true});}
 if(b.baseRevision!==p.revision)throw new ApiError(409,'stale_revision');
 const saved=await env.DB.prepare('INSERT INTO project_build_requests(id,project_id,author_id,instructions,base_revision,created_at) SELECT ?,?,?,?,?,? WHERE (SELECT revision FROM projects WHERE id=?)=? AND (SELECT count(*) FROM project_build_requests WHERE project_id=?)<100').bind(b.requestId,p.id,who.userId,instructions,p.revision,Date.now(),p.id,p.revision,p.id).run();
 if(!saved.meta.changes)throw new ApiError(409,'build_request_admission_changed');
 return Response.json({id:b.requestId,saved:true,executionStarted:false},{status:201});
}
