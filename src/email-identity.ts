import {ApiError} from './contracts';
import {digest,randomToken} from './security';
export type MailIdentityKind='verify'|'recover';
export type Delivery=(email:string,link:string,kind:MailIdentityKind)=>Promise<'sent'|'failed'|'not_configured'>;
const TTL=1800,HEX=/^[a-f0-9]{64}$/;
/** No raw token returned to clients/logs/Store. Delivery must be scoped to the trusted shell origin. */
export async function requestMailIdentity(db:D1Database,namespace:string,kind:MailIdentityKind,email:string,userId:string|null,origin:string,deliver:Delivery){
 if(namespace!=='platform'&&!/^[a-f0-9-]{36}$/.test(namespace))throw new ApiError(400,'mail_namespace_denied');
 const url=new URL(origin);if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new ApiError(503,'mail_identity_origin_not_configured');
 const now=Date.now(),hour=Math.floor(now/3600000)*3600000,day=Math.floor(now/86400000)*86400000;
 await db.prepare('DELETE FROM identity_mail_rates WHERE window<?').bind(day-86400000).run();
 // Global budget prevents multiplying addresses/projects to exceed the free transactional envelope.
 const global=await db.prepare("INSERT INTO identity_mail_rates VALUES('__service__','mail.day',?,1) ON CONFLICT(namespace,email_hash,window) DO UPDATE SET count=count+1 WHERE count<100 RETURNING count").bind(day).first();
 if(!global)throw new ApiError(429,'mail_admission_exhausted');
 const admitted=await db.prepare('INSERT INTO identity_mail_rates VALUES(?,?,?,1) ON CONFLICT(namespace,email_hash,window) DO UPDATE SET count=count+1 WHERE count<3 RETURNING count').bind(namespace,await digest('identity-mail:'+email),hour).first();
 if(!admitted)throw new ApiError(429,'mail_rate_limited');
 await db.prepare('DELETE FROM identity_mail_tokens WHERE expires_at<=?').bind(now).run();
 if(userId){const raw=randomToken(),hash=await digest(raw);await db.batch([db.prepare('DELETE FROM identity_mail_tokens WHERE namespace=? AND user_id=? AND kind=?').bind(namespace,userId,kind),db.prepare('INSERT INTO identity_mail_tokens VALUES(?,?,?,?,?,?,?,NULL)').bind(namespace,kind,hash,userId,email,now+TTL*1000,now)]);
 const base=namespace==='platform'?url.origin+'/':url.origin+'/a/'+namespace+'/';
 let result:'sent'|'failed'|'not_configured';try{result=await deliver(email,base+(namespace==='platform'?'#signin?verify=':'#'+kind+'=')+raw,kind)}catch{result='failed'}
 if(result!=='sent')await db.prepare('DELETE FROM identity_mail_tokens WHERE namespace=? AND kind=? AND token_hash=?').bind(namespace,kind,hash).run();
 }
 // Same response for unknown accounts and provider outcomes; operational mail health is checked separately.
 return {accepted:true,expiresInSeconds:TTL};
}
export async function confirmMailIdentity(db:D1Database,namespace:string,kind:MailIdentityKind,raw:unknown,credentials?:{salt:string;verifier:string}){
 if(typeof raw!=='string'||!HEX.test(raw))throw new ApiError(400,'mail_token_invalid');
 if(kind==='recover'&&(namespace==='platform'||!credentials||!HEX.test(credentials.salt)||!HEX.test(credentials.verifier)))throw new ApiError(400,'mail_recovery_fields_denied');
 const hash=await digest(raw),now=Date.now(),claim=randomToken();
 const row=await db.prepare('SELECT user_id,email FROM identity_mail_tokens WHERE namespace=? AND kind=? AND token_hash=? AND claim IS NULL AND expires_at>?').bind(namespace,kind,hash,now).first<{user_id:string;email:string}>();
 if(!row)throw new ApiError(400,'mail_token_invalid');
 const exists=namespace==='platform'
  ?await db.prepare('SELECT id FROM users WHERE id=? AND email=?').bind(row.user_id,row.email).first()
  :await db.prepare('SELECT id FROM target_app_users WHERE project_id=? AND id=? AND email=?').bind(namespace,row.user_id,row.email).first();
 if(!exists)throw new ApiError(400,'mail_token_invalid');
 const predicate='EXISTS(SELECT 1 FROM identity_mail_tokens WHERE namespace=? AND kind=? AND token_hash=? AND claim=?)';
 const args=[namespace,kind,hash,claim];
 const stmts=[db.prepare('UPDATE identity_mail_tokens SET claim=? WHERE namespace=? AND kind=? AND token_hash=? AND claim IS NULL AND expires_at>?').bind(claim,namespace,kind,hash,now)];
 if(kind==='verify')stmts.push(db.prepare(`INSERT INTO identity_email_verified SELECT ?,?,?,? WHERE ${predicate} ON CONFLICT(namespace,user_id) DO UPDATE SET email=excluded.email,verified_at=excluded.verified_at`).bind(namespace,row.user_id,row.email,now,...args));
 else{
  const newHash=await digest('app-password:'+namespace+':'+credentials!.salt+':'+credentials!.verifier);
  stmts.push(db.prepare(`UPDATE target_app_users SET password_salt=?,password_hash=? WHERE project_id=? AND id=? AND email=? AND ${predicate}`).bind(credentials!.salt,newHash,namespace,row.user_id,row.email,...args));
  stmts.push(db.prepare(`DELETE FROM target_app_sessions WHERE project_id=? AND user_id=? AND ${predicate}`).bind(namespace,row.user_id,...args));
  // Successful recovery also proves email possession; verified record isn't a permission grant.
  stmts.push(db.prepare(`INSERT INTO identity_email_verified SELECT ?,?,?,? WHERE ${predicate} ON CONFLICT(namespace,user_id) DO UPDATE SET email=excluded.email,verified_at=excluded.verified_at`).bind(namespace,row.user_id,row.email,now,...args));
 }
 const results=await db.batch(stmts);if(!results[0]!.meta.changes)throw new ApiError(400,'mail_token_invalid');
 // Used tokens remain hashed until bounded expiry sweep so replay always fails.
 return kind==='verify'?{verified:true}:{reset:true,reauthenticationRequired:true};
}
export async function mailIdentityStatus(db:D1Database,namespace:string,userId:string,email:string){const r=await db.prepare('SELECT verified_at FROM identity_email_verified WHERE namespace=? AND user_id=? AND email=?').bind(namespace,userId,email).first<{verified_at:number}>();return {emailVerified:!!r,verifiedAt:r?.verified_at??null};}
