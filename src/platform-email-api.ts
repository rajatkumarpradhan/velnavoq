import {ApiError,type Env} from './contracts';
import {identity,rateLimit} from './auth';
import {assertIdentityOrigin} from './client-auth';
import {checkOrigin,readBody} from './security';
import {confirmMailIdentity,mailIdentityStatus,requestMailIdentity} from './email-identity';
import {mailConfigured,sendIdentityMail} from './mail';
/** Opt-in additive API. No existing account gating or registration changes. */
export async function platformEmailApi(req:Request,env:Env):Promise<Response|null>{
 const path=new URL(req.url).pathname;if(!path.startsWith('/api/auth/email/'))return null;
 if(env.EMAIL_IDENTITY_ENABLED!=='true')throw new ApiError(503,'email_identity_not_enabled');
 assertIdentityOrigin(env,req);checkOrigin(req,env.APP_ORIGIN);await rateLimit(req,env,'email-identity',10);
 if(path==='/api/auth/email/confirm'&&req.method==='POST'){const b=await readBody(req);if(Object.keys(b).join(',')!=='token')throw new ApiError(400,'email_identity_fields_denied');return Response.json(await confirmMailIdentity(env.DB,'platform','verify',b.token));}
 const who=await identity(req,env,req.method!=='GET');const u=await env.DB.prepare('SELECT email FROM users WHERE id=?').bind(who.userId).first<{email:string}>();if(!u)throw new ApiError(401,'session_expired_or_revoked');
 if(path==='/api/auth/email/status'&&req.method==='GET')return Response.json({...await mailIdentityStatus(env.DB,'platform',who.userId,u.email),deliveryConfigured:mailConfigured(env),verificationRequired:false});
 if(path==='/api/auth/email/request'&&req.method==='POST'){if(!mailConfigured(env))throw new ApiError(503,'email_delivery_not_configured');const b=await readBody(req);if(Object.keys(b).length)throw new ApiError(400,'email_identity_fields_denied');return Response.json(await requestMailIdentity(env.DB,'platform','verify',u.email,who.userId,new URL(env.APP_ORIGIN).origin,(to,link,kind)=>sendIdentityMail(env,to,link,kind)));}
 throw new ApiError(404,'not_found');
}
