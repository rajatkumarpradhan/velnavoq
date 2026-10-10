// Part 25: project export, verified restore into a new project, and stuck-job recovery.
// Extends Part 14 versioning (restore/rollback of one project's own history) and Part 15 deployment rollback.
// Not included in an export, on purpose: secret values, environment values, sessions, tokens, AI logs, build artifacts (rebuildable).
import {ApiError,type Env,type Identity} from './contracts';
import {project,role} from './auth';
import {canonical,digest,validateBundle} from './security';
import {consume,checkGauge,userStorage,workspaceStorage} from './quota';
export const EXPORT_FORMAT='velnavoq-project-export-v1';
export const MAX_IMPORT_BYTES=8*1024*1024,MAX_VERSIONS=200;
export interface ExportVersion{revision:number;digest:string;bundle:string;createdAt:number}
export interface ProjectExport{format:typeof EXPORT_FORMAT;exportedAt:string;project:{name:string;revision:number};versions:ExportVersion[];manifest:{versionCount:number;fileCount:number;totalBytes:number;digest:string};excluded:string[]}
const EXCLUDED=['secret values','environment variable values','sessions and tokens','AI request logs','build artifacts (rebuild after restore)','deployments and releases (redeploy after restore)'];
async function manifestDigest(versions:ExportVersion[]){return digest(canonical(versions.map(v=>({revision:v.revision,digest:v.digest,createdAt:v.createdAt}))))}
export async function buildExport(env:Env,projectId:string,now=Date.now()):Promise<ProjectExport>{
 const p=await env.DB.prepare('SELECT name,revision FROM projects WHERE id=?').bind(projectId).first<{name:string;revision:number}>();if(!p)throw new ApiError(404,'project_not_found');
 const rows=(await env.DB.prepare('SELECT revision,digest,bundle_json,created_at FROM source_revisions WHERE project_id=? ORDER BY revision').bind(projectId).all<{revision:number;digest:string;bundle_json:string;created_at:number}>()).results;
 const versions=rows.map(r=>({revision:r.revision,digest:r.digest,bundle:r.bundle_json,createdAt:r.created_at}));let files=0,bytes=0;
 for(const v of versions){const f=(JSON.parse(v.bundle) as {files:Record<string,string>}).files;files+=Object.keys(f).length;for(const c of Object.values(f))bytes+=new TextEncoder().encode(c).length}
 return {format:EXPORT_FORMAT,exportedAt:new Date(now).toISOString(),project:{name:p.name,revision:p.revision},versions,manifest:{versionCount:versions.length,fileCount:files,totalBytes:bytes,digest:await manifestDigest(versions)},excluded:EXCLUDED};
}
/** Verify an export without touching the database. Throws ApiError(400|413) with a plain code. */
export async function verifyExport(raw:unknown):Promise<ProjectExport>{
 const x=raw as ProjectExport;
 if(!x||typeof x!=='object'||x.format!==EXPORT_FORMAT)throw new ApiError(400,'unsupported_export_format');
 if(!x.project||typeof x.project.name!=='string'||!Array.isArray(x.versions)||!x.manifest)throw new ApiError(400,'invalid_export');
 if(x.versions.length>MAX_VERSIONS)throw new ApiError(413,'export_too_many_versions');
 let last=0,files=0,bytes=0;
 for(const v of x.versions){
  if(!v||!Number.isInteger(v.revision)||v.revision!==last+1||typeof v.bundle!=='string'||typeof v.digest!=='string'||!Number.isInteger(v.createdAt))throw new ApiError(400,'invalid_export_version');last=v.revision;
  if(await digest(v.bundle)!==v.digest)throw new ApiError(400,'export_digest_mismatch');
  let parsed:unknown;try{parsed=JSON.parse(v.bundle)}catch{throw new ApiError(400,'invalid_export_version')}
  const b=validateBundle(parsed);files+=Object.keys(b.files).length;for(const c of Object.values(b.files))bytes+=new TextEncoder().encode(c).length;
 }
 if(x.manifest.versionCount!==x.versions.length||x.manifest.fileCount!==files||x.manifest.totalBytes!==bytes||x.manifest.digest!==await manifestDigest(x.versions))throw new ApiError(400,'export_manifest_mismatch');
 return x;
}
export function cleanName(n:string){const c=n.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,70);return (c||'Restored project')+' (restored)'}
/** Restore into a NEW project in the workspace. Never overwrites an existing project. All-or-nothing (one D1 batch). */
export async function restoreExport(env:Env,who:Identity,workspaceId:string,x:ProjectExport,now=Date.now()):Promise<{projectId:string;name:string;revision:number;versions:number}>{
 await checkGauge(env,'projects.total',workspaceId,1,now);
 await checkGauge(env,'storage.bytes.workspace',workspaceId,x.manifest.totalBytes,now);
 await checkGauge(env,'storage.bytes.user',who.userId,x.manifest.totalBytes,now);
 void userStorage;void workspaceStorage;
 const id=crypto.randomUUID(),name=cleanName(x.project.name),top=x.versions.length;
 const st=[env.DB.prepare('INSERT INTO projects(id,workspace_id,name,created_at,created_by) VALUES(?,?,?,?,?)').bind(id,workspaceId,name,now,who.userId),env.DB.prepare('INSERT INTO ai_budgets(project_id,token_limit) VALUES(?,?)').bind(id,40000)];
 for(const v of x.versions){const pid=crypto.randomUUID();
  st.push(env.DB.prepare('INSERT INTO proposals(id,project_id,base_revision,digest,bundle_json,author_id,created_at) VALUES(?,?,?,?,?,?,?)').bind(pid,id,v.revision-1,v.digest,v.bundle,who.userId,now));
  // The existing approval triggers write source_revisions, approvals, file_versions and bump projects.revision, so a restored history is built exactly like a live one.
  st.push(env.DB.prepare("UPDATE proposals SET status='approved',approved_by=?,decided_at=? WHERE id=?").bind(who.userId,v.createdAt,pid));}
 st.push(env.DB.prepare('INSERT INTO audit_events(actor_id,workspace_id,project_id,action,digest,created_at) VALUES(?,?,?,?,?,?)').bind(who.userId,workspaceId,id,'project_restored_from_export',x.manifest.digest,now));
 await env.DB.batch(st);return {projectId:id,name,revision:top,versions:x.versions.length};
}
/** Failed-job recovery: a job whose runner vanished stays 'running' and would block the one-job-at-a-time rule. Close it as timed_out so work can resume. */
export async function recoverStuckJobs(env:Env,projectId:string,now=Date.now()){
 const cnt=async(t:string)=>(await env.DB.prepare(`SELECT count(*) AS n FROM ${t} WHERE project_id=? AND status='running' AND deadline_at<=?`).bind(projectId,now).first<{n:number}>())?.n??0;
 const b=await cnt('build_jobs'),t=await cnt('terminal_jobs');
 await env.DB.batch([env.DB.prepare("UPDATE build_jobs SET status='timed_out',finished_at=? WHERE project_id=? AND status='running' AND deadline_at<=?").bind(now,projectId,now),env.DB.prepare("UPDATE terminal_jobs SET status='timed_out',finished_at=? WHERE project_id=? AND status='running' AND deadline_at<=?").bind(now,projectId,now)]);
 const stuck=(await env.DB.prepare("SELECT id FROM ship_jobs WHERE project_id=? AND status IN('queued','building','deploying','checking') AND deadline_at<=?").bind(projectId,now).all<{id:string}>()).results;let ship=0;
 for(const j of stuck){const r=await env.DB.batch([env.DB.prepare("UPDATE ship_jobs SET status='timed_out',reason='recovered_after_deadline',finished_at=? WHERE id=? AND status IN('queued','building','deploying','checking') AND deadline_at<=?").bind(now,j.id,now),env.DB.prepare("INSERT INTO ship_events SELECT ?,coalesce(max(seq),0)+1,'timed_out',? FROM ship_events WHERE job_id=? HAVING EXISTS(SELECT 1 FROM ship_jobs WHERE id=? AND status='timed_out')").bind(j.id,now,j.id,j.id)]);ship+=r[0]!.meta.changes?1:0}
 return {build:b,terminal:t,deployment:ship};
}
export async function recoveryStatus(env:Env,projectId:string,now=Date.now()){
 const one=async<T>(sql:string,...a:unknown[])=>(await env.DB.prepare(sql).bind(...a).first<T>());
 const versions=(await one<{n:number}>('SELECT count(*) AS n FROM source_revisions WHERE project_id=?',projectId))?.n??0;
 const stuck=(await one<{n:number}>("SELECT (SELECT count(*) FROM build_jobs WHERE project_id=?1 AND status='running' AND deadline_at<=?2)+(SELECT count(*) FROM terminal_jobs WHERE project_id=?1 AND status='running' AND deadline_at<=?2)+(SELECT count(*) FROM ship_jobs WHERE project_id=?1 AND status IN('queued','building','deploying','checking') AND deadline_at<=?2) AS n",projectId,now))?.n??0;
 const failed=(await one<{n:number}>("SELECT (SELECT count(*) FROM build_jobs WHERE project_id=?1 AND status IN('failed','timed_out'))+(SELECT count(*) FROM ship_jobs WHERE project_id=?1 AND status IN('failed','timed_out','blocked')) AS n",projectId))?.n??0;
 const cur=await one<{release_id:string;version:number}>('SELECT c.release_id,r.version FROM ship_current c JOIN ship_releases r ON r.id=c.release_id WHERE c.project_id=?',projectId);
 const older=(await one<{n:number}>('SELECT count(*) AS n FROM ship_releases WHERE project_id=? AND id<>coalesce((SELECT release_id FROM ship_current WHERE project_id=?),\'\')',projectId,projectId))?.n??0;
 return {sourceVersions:versions,stuckJobs:stuck,failedJobs:failed,liveRelease:cur?{releaseId:cur.release_id,version:cur.version}:null,rollbackTargets:older,
  steps:[versions?'Download an export from this page to keep a copy outside the app.':'No saved versions yet, so there is nothing to export.',stuck?'Run "Recover stuck jobs" to free a job that stopped answering.':'No stuck jobs.',older?'You can roll back the live deployment to an earlier release.':'No earlier release to roll back to.']};
}
const J={'content-type':'application/json','cache-control':'no-store'};
export async function recoveryApi(req:Request,env:Env,who:Identity):Promise<Response|null>{
 const u=new URL(req.url),m=/^\/api\/projects\/([^/]+)\/(export|recovery)(?:\/(jobs))?$/.exec(u.pathname),w=/^\/api\/workspaces\/([^/]+)\/import$/.exec(u.pathname);
 if(m){const p=await project(env,who.userId,m[1]!,req.method==='GET'?['owner','editor','viewer']:['owner','editor']);
  if(m[2]==='export'&&req.method==='GET'){if(who.userId)await consume(env,'exports.day',p.id,1,who.userId);const x=await buildExport(env,p.id);return new Response(JSON.stringify(x),{headers:{...J,'content-disposition':'attachment; filename="project-export.json"'}})}
  if(m[2]==='recovery'&&!m[3]&&req.method==='GET')return Response.json(await recoveryStatus(env,p.id));
  if(m[2]==='recovery'&&m[3]==='jobs'&&req.method==='POST'){await consume(env,'recovery.sweeps.hour',p.id,1,who.userId);return Response.json(await recoverStuckJobs(env,p.id))}
  throw new ApiError(405,'method_not_allowed');}
 if(w){if(req.method!=='POST')throw new ApiError(405,'method_not_allowed');await role(env,who.userId,w[1]!,['owner']);await consume(env,'imports.day',w[1]!,1,who.userId);
  const text=await req.text();if(text.length>MAX_IMPORT_BYTES)throw new ApiError(413,'import_too_large');let raw:unknown;try{raw=JSON.parse(text)}catch{throw new ApiError(400,'invalid_json')}
  const x=await verifyExport(raw);return Response.json(await restoreExport(env,who,w[1]!,x),{status:201})}
 return null;
}
