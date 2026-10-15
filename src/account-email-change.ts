import {ApiError,type Env,type Identity} from './contracts';
import {identity,rateLimit} from './auth';
import {assertIdentityOrigin,userKdf,verifierHash} from './client-auth';
import {checkOrigin,constantEqual,digest,randomToken,readBody,validateEmail} from './security';
import {mailConfigured,sendIdentityMail,type MailResult} from './mail';
type Deliver=(to:string,link:string)=>Promise<MailResult>;
const TTL=1800000,HEX=/^[a-f0-9]{64}$/;
/** Requires current password and a recent (including MFA, if enrolled) sign-in.
 * Email proof promotes the same immutable user id. No OAuth identity or grant changes. */
export async function requestAccountEmail(env:Env,who:Identity,email:unknown,verifier:unknown,deliver:Deliver){
 const next=validateEmail(email);if(typeof verifier!=='string'||!HEX.test(verifier))throw new ApiError(400,'invalid_verifier');
 const u=await env.DB.prepare('SELECT email,password_salt,password_hash FROM users WHERE id=?').bind(who.userId).first<any>();
 const session=await env.DB.prepare('SELECT created_at FROM sessions WHERE token_hash=? AND user_id=?').bind(who.sessionHash,who.userId).first<any>();
 if(!u||!session||session.created_at<Math.floor(Date.now()/1000)-600)throw new ApiError(403,'email_change_recent_signin_required');
 if(await userKdf(env,who.userId)!=='client-v1'||!constantEqual(await verifierHash(u.password_salt,verifier),u.password_hash))throw new ApiError(401,'invalid_credentials');
 if(next===u.email)throw new ApiError(400,'email_change_same_address');
 if(await env.DB.prepare('SELECT id FROM users WHERE email=?').bind(next).first())throw new ApiError(409,'email_change_unavailable');
 const hour=Math.floor(Date.now()/3600000)*3600000,limit=await env.DB.prepare("INSERT INTO identity_mail_rates VALUES('account-email-change',?,?,1) ON CONFLICT(namespace,email_hash,window) DO UPDATE SET count=count+1 WHERE count<3 RETURNING count").bind(await digest(who.userId),hour).first();if(!limit)throw new ApiError(429,'mail_rate_limited');
 const raw=randomToken(),hash=await digest(raw),now=Date.now();await env.DB.batch([env.DB.prepare('DELETE FROM account_email_changes WHERE user_id=? OR expires_at<=?').bind(who.userId,now),env.DB.prepare('INSERT INTO account_email_changes VALUES(?,?,?,?,?,?,?,?,NULL)').bind(hash,who.userId,u.email,next,u.password_hash,who.sessionHash,now+TTL,now)]);
 let result:MailResult;try{result=await deliver(next,new URL(env.APP_ORIGIN).origin+'/#sessions?emailChange='+raw)}catch{result='failed'}
 if(result!=='sent'){await env.DB.prepare('DELETE FROM account_email_changes WHERE token_hash=?').bind(hash).run();throw new ApiError(503,'email_change_delivery_failed');}
 return {verificationSent:true,emailUnchanged:true,expiresInSeconds:TTL/1000};
}
export async function confirmAccountEmail(env:Env,who:Identity,token:unknown){
 if(typeof token!=='string'||!HEX.test(token))throw new ApiError(400,'email_change_token_invalid');
 const hash=await digest(token),claim=randomToken(),now=Date.now();
 const r=await env.DB.prepare('SELECT * FROM account_email_changes WHERE token_hash=? AND user_id=? AND session_hash=? AND expires_at>? AND claim IS NULL').bind(hash,who.userId,who.sessionHash,now).first<any>();if(!r)throw new ApiError(400,'email_change_token_invalid');
 const pred='EXISTS(SELECT 1 FROM account_email_changes e WHERE e.token_hash=? AND e.claim=?)',args=[hash,claim];
 let result:D1Result[];try{result=await env.DB.batch([
 env.DB.prepare('UPDATE account_email_changes SET claim=? WHERE token_hash=? AND claim IS NULL AND expires_at>? AND EXISTS(SELECT 1 FROM users u WHERE u.id=account_email_changes.user_id AND u.email=account_email_changes.old_email AND u.password_hash=account_email_changes.password_hash) AND NOT EXISTS(SELECT 1 FROM users WHERE email=account_email_changes.new_email)').bind(claim,hash,now),
 env.DB.prepare(`UPDATE users SET email=? WHERE id=? AND email=? AND password_hash=? AND ${pred}`).bind(r.new_email,who.userId,r.old_email,r.password_hash,...args),
 env.DB.prepare(`INSERT INTO identity_email_verified SELECT 'platform',?,?,? WHERE ${pred} ON CONFLICT(namespace,user_id) DO UPDATE SET email=excluded.email,verified_at=excluded.verified_at`).bind(who.userId,r.new_email,now,...args),
 env.DB.prepare(`DELETE FROM recovery_requests WHERE user_id=? AND ${pred}`).bind(who.userId,...args),
 env.DB.prepare(`DELETE FROM identity_mail_tokens WHERE namespace='platform' AND user_id=? AND ${pred}`).bind(who.userId,...args),
 env.DB.prepare(`INSERT INTO account_email_change_audit(user_id,action,created_at) SELECT ?,'verified_email_changed',? WHERE ${pred}`).bind(who.userId,now,...args)
 ]);}catch{throw new ApiError(409,'email_change_unavailable');}
 if(!result[0]?.meta.changes||!result[1]?.meta.changes)throw new ApiError(400,'email_change_token_invalid');
 return {changed:true,email:r.new_email,sameAccount:true,projectsAndGrantsUnchanged:true};
}
export async function accountEmailChangeApi(req:Request,env:Env):Promise<Response|null>{
 const path=new URL(req.url).pathname;if(!path.startsWith('/api/auth/email/change/'))return null;
 assertIdentityOrigin(env,req);checkOrigin(req,env.APP_ORIGIN);await rateLimit(req,env,'account-email-change',5);
 const who=await identity(req,env,req.method!=='GET');
 if(path.endsWith('/status')&&req.method==='GET'){const u=await env.DB.prepare('SELECT email FROM users WHERE id=?').bind(who.userId).first<any>();return Response.json({email:u?.email,available:env.EMAIL_IDENTITY_ENABLED==='true'&&mailConfigured(env),verificationRequired:true,blocker:mailConfigured(env)?null:'email_delivery_not_configured',accountUnchanged:true});}
 if(env.EMAIL_IDENTITY_ENABLED!=='true'||!mailConfigured(env))throw new ApiError(503,'email_delivery_not_configured');
 const b=await readBody(req);
 if(path.endsWith('/request')&&req.method==='POST'){if(Object.keys(b).sort().join(',')!=='email,verifier')throw new ApiError(400,'email_change_fields_denied');return Response.json(await requestAccountEmail(env,who,b.email,b.verifier,(to,link)=>sendIdentityMail(env,to,link,'verify')));}
 if(path.endsWith('/confirm')&&req.method==='POST'){if(Object.keys(b).join(',')!=='token')throw new ApiError(400,'email_change_fields_denied');return Response.json(await confirmAccountEmail(env,who,b.token));}
 if(path.endsWith('/cancel')&&req.method==='POST'){if(Object.keys(b).length)throw new ApiError(400,'email_change_fields_denied');await env.DB.prepare('DELETE FROM account_email_changes WHERE user_id=?').bind(who.userId).run();return Response.json({canceled:true,emailUnchanged:true});}
 throw new ApiError(404,'not_found');
}
