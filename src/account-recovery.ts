// Part 28: account recovery. Single-use, hashed, 30-minute password reset tokens.
// Free-only stack: no email provider is connected, so delivery writes to a local
// development outbox table (recovery_outbox). Production email delivery is NOT RUN.
// The request endpoint always answers identically whether or not the account exists.
import {ApiError,type Env} from './contracts';
import {checkOrigin,digest,passwordHash,randomToken,readBody,validateEmail,validateNewPassword} from './security';
import {rateLimit} from './auth';
import {clearSignInFailures} from './quota';import {assertIdentityOrigin,verifierHash,setKdf} from './client-auth';import {mailConfigured,sendRecoveryMail} from './mail';
const TOKEN_TTL=1800;
export async function accountRecoveryApi(req:Request,env:Env,ctx?:ExecutionContext):Promise<Response|null>{
 const url=new URL(req.url),path=url.pathname,method=req.method;
 if(!path.startsWith('/api/auth/recovery'))return null;
 // Password auth is local-only in this build; recovery inherits that boundary.
 const originKind=assertIdentityOrigin(env,req);
 checkOrigin(req,env.APP_ORIGIN);
 if(path==='/api/auth/recovery/request'&&method==='POST'){
  await rateLimit(req,env,'recovery-request',5);
  const b=await readBody(req);
  if(Object.keys(b).sort().join(',')!=='email')throw new ApiError(400,'recovery_request_fields_denied');
  const email=validateEmail(b.email),now=Math.floor(Date.now()/1000);
  const u=await env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first<{id:string}>();
  if(u){
   const accountKey=await digest('recovery:'+email),ws=Math.floor(Date.now()/3600000)*3600000;
   const used=(await env.DB.prepare("SELECT count FROM usage_counters WHERE scope='account' AND scope_id=? AND metric='recovery.request.hour' AND window_start=?").bind(accountKey,ws).first<{count:number}>())?.count||0;
   if(used>=3)throw new ApiError(429,'rate_limited');
   await env.DB.prepare("INSERT INTO usage_counters(scope,scope_id,metric,window_start,count) VALUES('account',?,?,?,1) ON CONFLICT(scope,scope_id,metric,window_start) DO UPDATE SET count=count+1").bind(accountKey,'recovery.request.hour',ws).run();
   const token=randomToken();
   await env.DB.batch([env.DB.prepare('DELETE FROM recovery_requests WHERE user_id=?').bind(u.id),env.DB.prepare('INSERT INTO recovery_requests(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)').bind(await digest(token),u.id,now+TOKEN_TTL,now),...(originKind==='local'?[env.DB.prepare('INSERT INTO recovery_outbox(user_id,email,token,created_at) VALUES(?,?,?,?)').bind(u.id,email,token,Date.now())]:[])]);
   if(originKind==='public'){const job=sendRecoveryMail(env,email,env.APP_ORIGIN+'/#signin?reset='+token,TOKEN_TTL/60).catch(()=>'failed');if(ctx)ctx.waitUntil(job);else await job;}
  }
  // Identical answer either way: no account enumeration.
  return Response.json({ok:true,delivery:originKind==='local'?'local_outbox':mailConfigured(env)?'email':'email_not_configured',expiresInSeconds:TOKEN_TTL});
 }
 if(path==='/api/auth/recovery/reset'&&method==='POST'){
  await rateLimit(req,env,'recovery-reset',10);
  const b=await readBody(req);
  const clientKdf='verifier' in b;
  if(Object.keys(b).sort().join(',')!==(clientKdf?'salt,token,verifier':'newPassword,token'))throw new ApiError(400,'recovery_reset_fields_denied');
  if(!clientKdf&&originKind!=='local')throw new ApiError(400,'recovery_reset_fields_denied');
  if(typeof b.token!=='string'||!/^[0-9a-f]{64}$/.test(b.token))throw new ApiError(400,'invalid_or_expired_reset_token');
  if(clientKdf&&(typeof b.verifier!=='string'||!/^[0-9a-f]{64}$/.test(b.verifier)||typeof b.salt!=='string'||!/^[0-9a-f]{64}$/.test(b.salt)))throw new ApiError(400,'invalid_verifier');
  const next=clientKdf?'':validateNewPassword(b.newPassword),hash=await digest(b.token),now=Math.floor(Date.now()/1000);
  const row=await env.DB.prepare('SELECT user_id,expires_at FROM recovery_requests WHERE token_hash=?').bind(hash).first<{user_id:string;expires_at:number}>();
  if(!row||row.expires_at<=now)throw new ApiError(400,'invalid_or_expired_reset_token');
  const u=await env.DB.prepare('SELECT password_hash FROM users WHERE id=?').bind(row.user_id).first<{password_hash:string}>();
  if(!u)throw new ApiError(400,'invalid_or_expired_reset_token');
  const salt=clientKdf?(b.salt as string):randomToken(),newHash=clientKdf?await verifierHash(salt,b.verifier as string):await passwordHash(next,salt);
  // Guard trigger makes the reset atomic: a concurrent password change aborts the whole batch.
  // MFA enrollment is intentionally preserved: recovery never bypasses a live second factor.
  try{await env.DB.batch([env.DB.prepare('UPDATE users SET password_hash=?,password_salt=? WHERE id=? AND password_hash=?').bind(newHash,salt,row.user_id,u.password_hash),env.DB.prepare('INSERT INTO password_change_guard(user_id,expected_hash) VALUES(?,?)').bind(row.user_id,newHash),env.DB.prepare('DELETE FROM password_change_guard WHERE user_id=?').bind(row.user_id),env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(row.user_id),setKdf(env,row.user_id,clientKdf),env.DB.prepare('DELETE FROM mfa_pending WHERE user_id=?').bind(row.user_id),env.DB.prepare('DELETE FROM recovery_requests WHERE user_id=?').bind(row.user_id)]);}catch{throw new ApiError(409,'recovery_reset_conflict');}
  await clearSignInFailures(env,await digest('login:'+(await env.DB.prepare('SELECT email FROM users WHERE id=?').bind(row.user_id).first<{email:string}>())!.email));
  return Response.json({reset:true,reauthenticationRequired:true});
 }
 throw new ApiError(404,'not_found');
}
