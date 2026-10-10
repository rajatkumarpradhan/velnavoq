import {assertSignInAllowed,recordSignInFailure,clearSignInFailures} from './quota';import {ApiError,type Env,type Identity,type Project,type Role} from './contracts';
import {checkOrigin,constantEqual,digest,passwordHash,randomToken,readBody,validateEmail,validatePassword,validateNewPassword,sessionToken} from './security';
export const SESSION_SECONDS=365*86400;const lifetime=SESSION_SECONDS,idle=0,idleRefresh=60;
export const IDLE_SECONDS=idle;
export async function rateLimit(req:Request,env:Env,scope:string,limit=10):Promise<void>{
 const address=req.headers.get('CF-Connecting-IP');if(!address&&new URL(env.APP_ORIGIN).hostname!=='localhost')throw new ApiError(503,'trusted_client_ip_missing');
 if(address&&(address.length>45||! /^[0-9a-fA-F:.]+$/.test(address)))throw new ApiError(503,'trusted_client_ip_invalid');
 const key=await digest(scope+':'+(address||'local'));const window=Math.floor(Date.now()/60000);
 await env.DB.prepare('DELETE FROM rate_limits WHERE window<?').bind(window-2).run();
 const row=await env.DB.prepare('INSERT INTO rate_limits(key_hash,window,count) VALUES(?,?,1) ON CONFLICT(key_hash) DO UPDATE SET count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END,window=excluded.window RETURNING count').bind(key,window).first<{count:number}>();
 if(!row||row.count>limit)throw new ApiError(429,'rate_limited');
}
export async function identity(req:Request,env:Env,write=false):Promise<Identity>{
 const token=sessionToken(req);let sessionHash=await digest(token);
 const now=Math.floor(Date.now()/1000);
 const alias=await env.DB.prepare('SELECT new_hash FROM session_rotation_aliases WHERE old_hash=? AND expires_at>?').bind(sessionHash,now).first<{new_hash:string}>();if(alias)sessionHash=alias.new_hash;
 const s=await env.DB.prepare('SELECT user_id,csrf_hash,last_seen_at,created_at FROM sessions WHERE token_hash=? AND expires_at>?').bind(sessionHash,now).first<{user_id:string;csrf_hash:string;last_seen_at:number;created_at:number}>();
 if(!s)throw new ApiError(401,'session_expired_or_revoked');
 const lastSeen=s.last_seen_at||s.created_at;
 
 if(now-lastSeen>=idleRefresh)await env.DB.prepare('UPDATE sessions SET last_seen_at=? WHERE token_hash=?').bind(now,sessionHash).run();
 if(write){checkOrigin(req,env.APP_ORIGIN);if(!constantEqual(await digest(req.headers.get('x-csrf-token')||''),s.csrf_hash))throw new ApiError(403,'csrf_denied');}
 return {userId:s.user_id,sessionHash,csrfHash:s.csrf_hash};
}
export async function role(env:Env,userId:string,workspaceId:string,allowed:Role[]=['owner','editor','viewer']):Promise<Role>{
 const m=await env.DB.prepare('SELECT role FROM memberships WHERE workspace_id=? AND user_id=?').bind(workspaceId,userId).first<{role:Role}>();
 if(!m||!allowed.includes(m.role))throw new ApiError(404,'workspace_not_found');return m.role;
}
export async function project(env:Env,userId:string,id:string,allowed:Role[]=['owner','editor','viewer']):Promise<Project>{
 const p=await env.DB.prepare('SELECT * FROM projects WHERE id=?').bind(id).first<Project>();if(!p)throw new ApiError(404,'project_not_found');await role(env,userId,p.workspace_id,allowed);return p;
}
export async function authenticate(req:Request,env:Env,register:boolean):Promise<Response>{
 checkOrigin(req,env.APP_ORIGIN);
 // Password auth is evaluated locally only: production identity/Free CPU is not verified.
 const app=new URL(env.APP_ORIGIN);if(app.hostname!=='localhost'||new URL(req.url).hostname!=='localhost')throw new ApiError(503,'production_identity_not_configured');
 await rateLimit(req,env,'auth');
 if(register&&env.REGISTRATION_ENABLED!=='true')throw new ApiError(403,'registration_closed');
 const b=await readBody(req),email=validateEmail(b.email),password=register?validateNewPassword(b.password):validatePassword(b.password);let userId:string;
 if(register){userId=crypto.randomUUID();const salt=randomToken(),hash=await passwordHash(password,salt);try{await env.DB.prepare('INSERT INTO users(id,email,password_hash,password_salt,created_at) VALUES(?,?,?,?,?)').bind(userId,email,hash,salt,Date.now()).run();}catch{throw new ApiError(409,'account_not_created');}}
 else{const accountKey=await digest('login:'+email);await assertSignInAllowed(env,accountKey);const u=await env.DB.prepare('SELECT id,password_hash,password_salt FROM users WHERE email=?').bind(email).first<{id:string;password_hash:string;password_salt:string}>();
 const hash=await passwordHash(password,u?.password_salt||'authentication-timing-padding');if(!u||!constantEqual(hash,u.password_hash)){await recordSignInFailure(env,accountKey);throw new ApiError(401,'invalid_credentials');}await clearSignInFailures(env,accountKey);userId=u.id;}
 // Part 28: a correct password on an MFA-enabled account yields a second-factor challenge, not a session.
 if(!register){const {mfaActive,createMfaChallenge}=await import('./mfa');if(await mfaActive(env,userId)){const challenge=await createMfaChallenge(env,userId);return Response.json({error:'mfa_required',mfaToken:challenge.mfaToken,expiresAt:challenge.expiresAt},{status:401});}}
 let oldHash:string|null=null;if(!register&&req.headers.has('cookie')){try{oldHash=await digest(sessionToken(req))}catch{/* malformed/legacy credential cannot select a session to terminate */}}
 return issueSession(env,userId,oldHash);
}

/** Issue the session + CSRF cookie pair. Optionally terminate one supplied prior session of the same user. */
export async function issueSession(env:Env,userId:string,oldHash:string|null=null):Promise<Response>{
 const token=randomToken(),csrf=randomToken(),now=Math.floor(Date.now()/1000);
 const create=env.DB.prepare('INSERT INTO sessions(token_hash,user_id,csrf_hash,expires_at,created_at,last_seen_at) VALUES(?,?,?,?,?,?)').bind(await digest(token),userId,await digest(csrf),now+lifetime,now,now);
 if(oldHash)await env.DB.batch([env.DB.prepare('DELETE FROM sessions WHERE token_hash=? AND user_id=?').bind(oldHash,userId),create]);else await create.run();
 const headers=new Headers();headers.append('set-cookie',`__Host-velnavoq_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${lifetime}`);headers.append('set-cookie',`__Host-velnavoq_csrf=${csrf}; Secure; SameSite=Lax; Path=/; Max-Age=${lifetime}`);return Response.json({userId,csrfToken:csrf,expiresAt:now+lifetime,idleExpiresAt:null},{headers});
}

/** Local reference identity only. Exact old/new password, transactional session termination. */
export async function changePassword(req:Request,env:Env,who:Identity):Promise<Response>{
 const {identityOrigin,verifierHash,setKdf,userKdf,KDF_VERSION}=await import('./client-auth');
 const origin=identityOrigin(env,req);if(!origin)throw new ApiError(503,'production_identity_not_configured');
 await rateLimit(req,env,'password-change',5);const b=await readBody(req);
 const clientKdf='currentVerifier' in b;
 if(!clientKdf&&origin!=='local')throw new ApiError(503,'production_identity_not_configured');
 let salt:string,hash:string,u:{password_hash:string;password_salt:string}|null;
 if(clientKdf){
  if(Object.keys(b).sort().join(',')!=='currentVerifier,newSalt,newVerifier')throw new ApiError(400,'password_change_fields_denied');
  for(const k of ['currentVerifier','newSalt','newVerifier'])if(typeof b[k]!=='string'||!/^[0-9a-f]{64}$/.test(b[k] as string))throw new ApiError(400,'invalid_verifier');
  u=await env.DB.prepare('SELECT password_hash,password_salt FROM users WHERE id=?').bind(who.userId).first();
  if(!u||await userKdf(env,who.userId)!==KDF_VERSION||!constantEqual(await verifierHash(u.password_salt,b.currentVerifier as string),u.password_hash))throw new ApiError(401,'invalid_credentials');
  if(b.currentVerifier===b.newVerifier)throw new ApiError(400,'new_password_must_differ');
  salt=b.newSalt as string;hash=await verifierHash(salt,b.newVerifier as string);
 }else{
  if(Object.keys(b).sort().join(',')!=='currentPassword,newPassword')throw new ApiError(400,'password_change_fields_denied');
  const current=validatePassword(b.currentPassword),next=validateNewPassword(b.newPassword);
  u=await env.DB.prepare('SELECT password_hash,password_salt FROM users WHERE id=?').bind(who.userId).first();
  if(!u||!constantEqual(await passwordHash(current,u.password_salt),u.password_hash))throw new ApiError(401,'invalid_credentials');
  if(constantEqual(current,next))throw new ApiError(400,'new_password_must_differ');
  salt=randomToken();hash=await passwordHash(next,salt);
 }
 // Optimistic old-hash guard makes concurrent password changes fail atomically.
 await env.DB.batch([env.DB.prepare('UPDATE users SET password_hash=?,password_salt=? WHERE id=? AND password_hash=?').bind(hash,salt,who.userId,u.password_hash),setKdf(env,who.userId,clientKdf),env.DB.prepare('INSERT INTO password_change_guard(user_id,expected_hash) VALUES(?,?)').bind(who.userId,hash),env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(who.userId),env.DB.prepare('DELETE FROM password_change_guard WHERE user_id=?').bind(who.userId)]);
 const headers=new Headers();for(const name of ['__Host-velnavoq_session','__Host-velnavoq_csrf'])headers.append('set-cookie',name+'=; Secure; SameSite=Lax; Path=/; Max-Age=0'+(name.endsWith('session')?'; HttpOnly':''));
 return Response.json({changed:true,reauthenticationRequired:true},{headers});
}

export async function renewSession(req:Request,env:Env,who:Identity){const now=Math.floor(Date.now()/1000),csrf=req.headers.get('x-csrf-token')!,raw=randomToken(),hash=await digest(raw);const row=await env.DB.prepare('SELECT created_at,expires_at FROM sessions WHERE token_hash=?').bind(who.sessionHash).first<{created_at:number;expires_at:number}>();if(!row)throw new ApiError(401,'session_expired_or_revoked');if(now-row.created_at<86400)return Response.json({expiresAt:row.expires_at,rotated:false});let result:D1Result[];try{result=await env.DB.batch([env.DB.prepare('DELETE FROM session_rotation_aliases WHERE expires_at<?').bind(now),env.DB.prepare('UPDATE sessions SET token_hash=?,created_at=?,last_seen_at=?,expires_at=? WHERE token_hash=? AND created_at=?').bind(hash,now,now,now+lifetime,who.sessionHash,row.created_at),env.DB.prepare('INSERT INTO session_rotation_aliases(old_hash,new_hash,expires_at) VALUES(?,?,?)').bind(who.sessionHash,hash,now+30),env.DB.prepare("UPDATE oauth_client_flows SET session_hash=? WHERE session_hash=? AND user_id=? AND status='pending'").bind(hash,who.sessionHash,who.userId)])}catch{throw new ApiError(409,'session_rotation_changed')}if(!result[1]!.meta.changes)throw new ApiError(409,'session_rotation_changed');const h=new Headers();h.append('set-cookie',`__Host-velnavoq_session=${raw}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${lifetime}`);h.append('set-cookie',`__Host-velnavoq_csrf=${csrf}; Secure; SameSite=Lax; Path=/; Max-Age=${lifetime}`);return Response.json({expiresAt:now+lifetime,rotated:true},{headers:h});}
