import {ApiError,type Env} from './contracts';
import {readBody,validateEmail} from './security';
import {confirmMailIdentity,requestMailIdentity,mailIdentityStatus} from './email-identity';
import {mailConfigured,sendIdentityMail} from './mail';
export type TargetMailConfig=Pick<Env,'BREVO_API_KEY'|'MAIL_FROM'|'MAIL_FROM_NAME'|'MAIL_ENDPOINT'|'EMAIL_IDENTITY_ENABLED'> & {APP_ORIGIN?:string};
export function targetMailReady(config:TargetMailConfig,req:Request){return config.EMAIL_IDENTITY_ENABLED==='true'&&config.APP_ORIGIN===new URL(req.url).origin&&new URL(req.url).protocol==='https:'&&mailConfigured(config as Env);}
export async function targetMailApi(req:Request,db:D1Database,pid:string,route:string,config:TargetMailConfig,session?:{user_id:string;email:string}):Promise<Response|null>{
 if(!route.startsWith('auth/email/')&&!route.startsWith('auth/recovery/'))return null;
 if(route==='auth/email/capabilities'&&req.method==='GET')return Response.json({available:targetMailReady(config,req),verificationRequired:false},{headers:{'cache-control':'no-store'}});
 if(!targetMailReady(config,req))throw new ApiError(503,'app_email_not_configured');
 const json=(x:unknown)=>Response.json(x,{headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
 const body=req.method==='POST'?await readBody(req):{};
 if(route==='auth/recovery/request'&&req.method==='POST'){
  if(Object.keys(body).join(',')!=='email')throw new ApiError(400,'app_mail_fields_denied');const email=validateEmail(body.email);
  const u=await db.prepare('SELECT id FROM target_app_users WHERE project_id=? AND email=?').bind(pid,email).first<{id:string}>();
  return json(await requestMailIdentity(db,pid,'recover',email,u?.id??null,new URL(req.url).origin,(to,link,kind)=>sendIdentityMail({...config,DB:db} as Env,to,link,kind)));
 }
 if(route==='auth/recovery/reset'&&req.method==='POST'){
  if(Object.keys(body).sort().join(',')!=='salt,token,verifier'||typeof body.salt!=='string'||typeof body.verifier!=='string')throw new ApiError(400,'app_mail_fields_denied');return json(await confirmMailIdentity(db,pid,'recover',body.token,{salt:body.salt,verifier:body.verifier}));
 }
 if(route==='auth/email/confirm'&&req.method==='POST'){
  if(Object.keys(body).join(',')!=='token')throw new ApiError(400,'app_mail_fields_denied');return json(await confirmMailIdentity(db,pid,'verify',body.token));
 }
 if(!session)return null;
 if(route==='auth/email/status'&&req.method==='GET')return json(await mailIdentityStatus(db,pid,session.user_id,session.email));
 if(route==='auth/email/request'&&req.method==='POST'){
  if(Object.keys(body).length)throw new ApiError(400,'app_mail_fields_denied');return json(await requestMailIdentity(db,pid,'verify',session.email,session.user_id,new URL(req.url).origin,(to,link,kind)=>sendIdentityMail({...config,DB:db} as Env,to,link,kind)));
 }
 throw new ApiError(404,'not_found');
}
