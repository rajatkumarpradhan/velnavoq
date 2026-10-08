import {ApiError,type Env,type Identity,type Project,type Role} from './contracts';
import {checkOrigin,constantEqual,digest,passwordHash,randomToken,readBody,validateEmail,validatePassword} from './security';
const lifetime=86400;
export async function rateLimit(req:Request,env:Env,scope:string,limit=10):Promise<void>{
 const address=req.headers.get('CF-Connecting-IP');if(!address&&new URL(env.APP_ORIGIN).hostname!=='localhost')throw new ApiError(503,'trusted_client_ip_missing');
 const key=await digest(scope+':'+(address||'local'));const window=Math.floor(Date.now()/60000);
 const row=await env.DB.prepare('INSERT INTO rate_limits(key_hash,window,count) VALUES(?,?,1) ON CONFLICT(key_hash) DO UPDATE SET count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END,window=excluded.window RETURNING count').bind(key,window).first<{count:number}>();
 if(!row||row.count>limit)throw new ApiError(429,'rate_limited');
}
export async function identity(req:Request,env:Env,write=false):Promise<Identity>{
 const cookie=req.headers.get('cookie')||'';const token=cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith('velnavoq_session='))?.split('=')[1];
 if(!token||! /^[0-9a-f]{64}$/.test(token))throw new ApiError(401,'authentication_required');const sessionHash=await digest(token);
 const s=await env.DB.prepare('SELECT user_id,csrf_hash FROM sessions WHERE token_hash=? AND expires_at>?').bind(sessionHash,Math.floor(Date.now()/1000)).first<{user_id:string;csrf_hash:string}>();
 if(!s)throw new ApiError(401,'session_expired_or_revoked');
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
 checkOrigin(req,env.APP_ORIGIN);await rateLimit(req,env,'auth');
 if(register&&env.REGISTRATION_ENABLED!=='true')throw new ApiError(403,'registration_closed');
 const b=await readBody(req),email=validateEmail(b.email),password=validatePassword(b.password);let userId:string;
 if(register){userId=crypto.randomUUID();const salt=randomToken(),hash=await passwordHash(password,salt);try{await env.DB.prepare('INSERT INTO users(id,email,password_hash,password_salt,created_at) VALUES(?,?,?,?,?)').bind(userId,email,hash,salt,Date.now()).run();}catch{throw new ApiError(409,'account_not_created');}}
 else{const u=await env.DB.prepare('SELECT id,password_hash,password_salt FROM users WHERE email=?').bind(email).first<{id:string;password_hash:string;password_salt:string}>();
 const hash=await passwordHash(password,u?.password_salt||'authentication-timing-padding');if(!u||!constantEqual(hash,u.password_hash))throw new ApiError(401,'invalid_credentials');userId=u.id;}
 const token=randomToken(),csrf=randomToken(),now=Math.floor(Date.now()/1000);
 await env.DB.prepare('INSERT INTO sessions(token_hash,user_id,csrf_hash,expires_at,created_at) VALUES(?,?,?,?,?)').bind(await digest(token),userId,await digest(csrf),now+lifetime,now).run();
 return Response.json({userId,csrfToken:csrf,expiresAt:now+lifetime},{headers:{'set-cookie':`velnavoq_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${lifetime}`}});
}
