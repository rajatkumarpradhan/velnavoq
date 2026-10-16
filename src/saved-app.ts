import {ApiError,type Env,type Identity} from './contracts';
import {project} from './auth';
import {canonical,digest,readBody} from './security';
import {sandboxSource} from './mcp-sandbox';
import {privateBuildSchema} from './private-build';
import {validateAppSchema} from './app-schema';
import {privateAppRequest} from './private-app-runtime';
import {managedAppAccounts} from './managed-app-accounts';
import {deploymentBuild} from './deployment-build';
/** A separate durable namespace, never a session id and never the published target DB.
 * Only the trusted controller can reach this transport after platform auth/Origin/CSRF.
 * Generated code stays on the isolated host with the existing narrow broker API. */
export function savedAppDatabase(db:D1Database):D1Database {
 return {prepare(sql:string){return db.prepare(sql.replace(/\btarget_(app_users|app_sessions|app_rows|app_auth_config|app_roles|backend_rates|backend_rows)\b/g,'saved_$1'))},batch(statements:D1PreparedStatement[]){return db.batch(statements)}} as D1Database;
}
async function approvedSavedApp(env:Env,pid:string,owner:string){
 const p=await project(env,owner,pid,['owner']);const s=await sandboxSource(env,pid);
 const q=await env.DB.prepare("SELECT q.*,b.config_json,b.digest schema_digest,s.bundle_json FROM private_build_packages q JOIN backend_proposals b ON b.id=q.backend_proposal JOIN proposals s ON s.id=q.source_proposal WHERE q.project_id=? AND q.owner_id=? AND q.status='approved' AND b.status='approved' AND s.status='approved' AND q.base_revision=? ORDER BY q.decided_at DESC,q.id DESC LIMIT 1").bind(pid,owner,s.revision-1).first<any>();
 if(!q)throw new ApiError(409,'saved_app_current_approved_build_required');
 const b=await privateBuildSchema(env,pid);if(!b||b.digest!==q.schema_digest)throw new ApiError(409,'saved_app_schema_changed');
 const schema=validateAppSchema(JSON.parse(q.config_json));if(await digest(canonical(schema))!==q.schema_digest||canonical(JSON.parse(q.bundle_json).files)!==canonical(s.files))throw new ApiError(409,'saved_app_snapshot_changed');
 return {p,s,schema,schemaDigest:q.schema_digest as string,packageId:q.id as string};
}
export async function savedAppApi(req:Request,env:Env,who:Identity):Promise<Response|null>{
 const u=new URL(req.url),m=/^\/api\/projects\/([^/]+)\/saved-app\/(open|app|accounts)$/.exec(u.pathname);if(!m)return null;
 // No connected-AI token can use this API. Owner opens already-approved source; this is
 // not an extension of MCP scopes and does not publish or install a public backend.
 if(req.method!=='POST')throw new ApiError(405,'saved_app_post_required');
 const {p,s,schema,schemaDigest,packageId}=await approvedSavedApp(env,m[1]!,who.userId);
 if(m[2]==='accounts'){if(schema.version!==3)throw new ApiError(403,'managed_backend_required');const b=await readBody(req);if(b.operation==='setRole'&&b.acknowledge!=='recognized-account-id-not-email-grant-managed-admin')throw new ApiError(400,'app_role_consent_required');const result=await managedAppAccounts(savedAppDatabase(env.DB),p.id,String(b.operation),typeof b.userId==='string'?b.userId:null,typeof b.role==='string'?b.role:null);if(b.operation==='setRole')await env.DB.prepare('INSERT INTO audit_events(actor_id,workspace_id,project_id,action,created_at) VALUES(?,?,?,?,?)').bind(who.userId,p.workspace_id,p.id,'saved_app_role_changed',Date.now()).run();return Response.json(result,{headers:{'cache-control':'no-store'}});}
 if(m[2]==='open'){
  await deploymentBuild({stack:'static-web-v1',files:s.files,schema:[],permissions:[]});
  return Response.json({id:p.id,packageId,revision:s.revision,sourceDigest:s.sourceDigest,schemaDigest,files:s.files,privateBackend:true,dataMode:'saved-private',expiresAt:Date.now()+86400000,published:false,url:new URL(env.APP_ORIGIN).origin+'/#app?'+new URLSearchParams({workspace:p.workspace_id,project:p.id}),limits:{nonSensitiveOnly:true,ownerPlatformSessionRequired:true,appAccounts:100,rowsPerUser:1000,rowsPerProject:20000,emailDelivery:false,publicSharing:false,arbitraryServerCode:false}}, {headers:{'cache-control':'no-store'}});
 }
 if(u.searchParams.get('revision')!==String(s.revision)||u.searchParams.get('schema')!==schemaDigest)throw new ApiError(409,'saved_app_reopen_current_version');
 const b=await readBody(req),route=b.route,method=b.method;
 if(Object.keys(b).some(x=>!['route','method','payload'].includes(x))||typeof route!=='string'||typeof method!=='string'||!((['auth/me','auth/kdf','auth/register','auth/login','auth/logout'].includes(route)&&method===(route==='auth/me'?'GET':'POST'))||(/^data\/[a-z][a-z0-9_]{0,31}(?:\/[a-f0-9-]{36})?$/.test(route)&&['GET','POST','PUT','DELETE'].includes(method)))||new TextEncoder().encode(canonical(b)).length>4500)throw new ApiError(400,'saved_app_request_denied');
 const cookie='__Secure-vln_'+p.id.replace(/-/g,'');const cookies=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(cookie+'='));
 const headers=new Headers({'origin':u.origin,'content-type':'application/json'});if(cookies.length)headers.set('cookie',cookies.join('; '));for(const key of ['x-app-csrf','cf-connecting-ip'])if(req.headers.has(key))headers.set(key,req.headers.get(key)!);
 const body=method==='POST'||method==='PUT'?JSON.stringify(b.payload??{}):undefined;
 // Revision/schema pin this controller transport, not the inner data-list query.
 // Forwarding them would make managed public reads reject otherwise valid requests.
 const runtimeUrl=new URL(req.url);runtimeUrl.search='';
 return privateAppRequest(new Request(runtimeUrl,{method,headers,...(body===undefined?{}:{body})}),savedAppDatabase(env.DB),p.id,route,schema,{}, {cookiePath:u.pathname,sessionSeconds:30*86400,mailDisabled:true,accountLimit:100,rowLimit:1000});
}
