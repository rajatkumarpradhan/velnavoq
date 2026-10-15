import {managedAppAccounts} from './managed-app-accounts';
import {assertPrivateBuildPreview} from './private-build-access';
import {ApiError,type Env,type Identity} from './contracts';
import {project} from './auth';
import {canonical,digest,readBody} from './security';
import {validateAppSchema} from './app-schema';
import {privateAppRequest} from './private-app-runtime';
/** Only these exact statements are translated to separate controller preview tables.
 * Published data is on another Worker/DB and never participates in this transport. */
export function previewDatabase(db:D1Database):D1Database {
 return {prepare(sql:string){return db.prepare(sql.replace(/\btarget_(app_users|app_sessions|app_rows|app_auth_config|app_roles|backend_rates|backend_rows)\b/g,'preview_$1'))},batch(statements:D1PreparedStatement[]){return db.batch(statements)}} as D1Database;
}
export async function clearExpiredPreviewData(env:Env){
 await env.DB.batch([
  env.DB.prepare("DELETE FROM preview_backend_rows WHERE project_id IN (SELECT id FROM previews WHERE expires_at<=? OR status IN ('stopped','expired','timed_out'))").bind(Date.now()),
  env.DB.prepare("DELETE FROM preview_app_users WHERE project_id IN (SELECT id FROM previews WHERE expires_at<=? OR status IN ('stopped','expired','timed_out'))").bind(Date.now()),
  env.DB.prepare("DELETE FROM preview_backend_rates WHERE window<?").bind(Math.floor(Date.now()/60000)-60)
 ]);
}
export async function reviewedPreviewSchema(env:Env,pid:string){
 // Approval doesn't install a published backend. Pending proposals are never selected.
 const row=await env.DB.prepare("SELECT config_json,digest FROM backend_proposals WHERE project_id=? AND status='approved' ORDER BY decided_at DESC,id DESC LIMIT 1").bind(pid).first<{config_json:string;digest:string}>();
 if(!row)return null;
 const raw=JSON.parse(row.config_json);if(![2,3].includes(raw.version))return null;const schema=validateAppSchema(raw);
 if(await digest(canonical(schema))!==row.digest)throw new ApiError(409,'preview_schema_review_mismatch');
 return {config:canonical(schema),digest:row.digest};
}
export async function privatePreviewApi(req:Request,env:Env,who:Identity):Promise<Response|null>{
 const m=/^\/api\/projects\/([^/]+)\/preview\/([^/]+)\/app$/.exec(new URL(req.url).pathname);if(!m)return null;
 await project(env,who.userId,m[1]!,['owner','editor']);
 if(req.method!=='POST')throw new ApiError(405,'preview_transport_post_required');
 // The controller router validates platform session/Origin/CSRF before entering here.
 const preview=await env.DB.prepare('SELECT v.*,j.revision FROM previews v JOIN build_jobs j ON j.id=v.job_id WHERE v.id=? AND v.project_id=? AND v.user_id=?').bind(m[2],m[1],who.userId).first<any>();
 if(!preview)throw new ApiError(404,'preview_not_found');await assertPrivateBuildPreview(env,preview.id);
 if(preview.expires_at<=Date.now()||['stopped','expired','timed_out'].includes(preview.status)){await clearExpiredPreviewData(env);throw new ApiError(410,'preview_expired');}
 const p=await project(env,who.userId,m[1]!,['owner','editor']);if(p.revision!==preview.revision)throw new ApiError(409,'stale_preview_build');
 if(!preview.backend_config_json)throw new ApiError(409,'preview_approved_private_schema_required');
 const approved=await env.DB.prepare("SELECT id FROM backend_proposals WHERE project_id=? AND digest=? AND status='approved'").bind(p.id,preview.backend_digest).first();
 const schema=validateAppSchema(JSON.parse(preview.backend_config_json));if(!approved||await digest(canonical(schema))!==preview.backend_digest)throw new ApiError(409,'preview_schema_review_mismatch');
 const b=await readBody(req);if(Object.keys(b).some(x=>!['route','method','payload'].includes(x)))throw new ApiError(400,'preview_request_denied');
 const route=b.route,method=typeof b.method==='string'?b.method:'';if(b.route==='owner/accounts'){await project(env,who.userId,m[1]!,['owner']);if(schema.version!==3||b.method!=='POST')throw new ApiError(403,'managed_backend_required');const payload=b.payload as any;if(!payload||typeof payload!=='object')throw new ApiError(400,'app_role_request_invalid');if(payload.operation==='setRole'&&payload.acknowledge!=='recognized-account-id-not-email-grant-managed-admin')throw new ApiError(400,'app_role_consent_required');return Response.json(await managedAppAccounts(previewDatabase(env.DB),preview.id,String(payload.operation),typeof payload.userId==='string'?payload.userId:null,typeof payload.role==='string'?payload.role:null))}
 const valid=typeof route==='string'&&((['auth/me','auth/kdf','auth/register','auth/login','auth/logout'].includes(route)&&method===(route==='auth/me'?'GET':'POST'))||(/^data\/[a-z][a-z0-9_]{0,31}(?:\/[a-f0-9-]{36})?$/.test(route)&&['GET','POST','PUT','DELETE'].includes(method)));
 if(!valid||new TextEncoder().encode(canonical(b)).length>4500)throw new ApiError(400,'preview_request_denied');
 const name='__Secure-vln_'+preview.id.replace(/-/g,'');const cookies=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(name+'='));
 const headers=new Headers({'origin':new URL(req.url).origin,'content-type':'application/json'});
 if(cookies.length)headers.set('cookie',cookies.join('; '));
 if(req.headers.has('x-app-csrf'))headers.set('x-app-csrf',req.headers.get('x-app-csrf')!);
 if(req.headers.has('cf-connecting-ip'))headers.set('cf-connecting-ip',req.headers.get('cf-connecting-ip')!);
 const body=method==='POST'||method==='PUT'?JSON.stringify(b.payload??{}):undefined;
 const call=new Request(req.url,{method,headers,...(body===undefined?{}:{body})});
 return privateAppRequest(call,previewDatabase(env.DB),preview.id,route,schema,{}, {cookiePath:new URL(req.url).pathname,sessionSeconds:Math.max(1,Math.floor((preview.expires_at-Date.now())/1000)),mailDisabled:true,accountLimit:10,rowLimit:200});
}
