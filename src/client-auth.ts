// Part 29: public sign-up / sign-in. The browser stretches the password (PBKDF2-SHA256, 600k) and sends only
// the 256-bit verifier; the server stores SHA-256(salt:verifier). No password KDF runs in the Worker, which
// is what makes this fit the Workers Free 10 ms CPU limit. Offline guessing costs the attacker the same
// 600k PBKDF2 per guess as before. Server-side blocklist checks move to the client (documented trade-off).
import {ApiError,type Env} from './contracts';
import {checkOrigin,constantEqual,digest,randomToken,readBody,validateEmail} from './security';
import {issueSession,rateLimit} from './auth';
import {assertSignInAllowed,recordSignInFailure,clearSignInFailures} from './quota';
export const KDF_ITERATIONS=600000,KDF_VERSION='client-v1';
const HEX64=/^[0-9a-f]{64}$/;
/** True when the request targets the configured public origin (https) or the local reference origin. */
export function identityOrigin(env:Env,req:Request):'local'|'public'|null{
 let app:URL;try{app=new URL(env.APP_ORIGIN)}catch{return null}const host=new URL(req.url).hostname;
 if(app.hostname==='localhost'&&host==='localhost')return 'local';
 if(app.protocol==='https:'&&host===app.hostname&&!app.port)return 'public';return null;
}
export function assertIdentityOrigin(env:Env,req:Request):'local'|'public'{const o=identityOrigin(env,req);if(!o)throw new ApiError(503,'production_identity_not_configured');return o}
export const verifierHash=(salt:string,verifier:string)=>digest('velnavoq-verifier-v1:'+salt+':'+verifier);
async function pepper(env:Env):Promise<string>{
 const row=await env.DB.prepare("SELECT value FROM auth_config WHERE key='kdf_pepper'").first<{value:string}>();if(row)return row.value;
 await env.DB.prepare("INSERT OR IGNORE INTO auth_config(key,value) VALUES('kdf_pepper',?)").bind(randomToken()).run();
 return (await env.DB.prepare("SELECT value FROM auth_config WHERE key='kdf_pepper'").first<{value:string}>())!.value;
}
/** POST /api/auth/kdf {email} -> salt + cost. Unknown emails get a stable pseudo-salt so existence is not revealed. */
export async function kdfParams(req:Request,env:Env):Promise<Response>{
 checkOrigin(req,env.APP_ORIGIN);assertIdentityOrigin(env,req);await rateLimit(req,env,'auth-kdf',30);
 const b=await readBody(req);if(Object.keys(b).join(',')!=='email')throw new ApiError(400,'kdf_fields_denied');const email=validateEmail(b.email);
 const u=await env.DB.prepare("SELECT u.password_salt,COALESCE(k.kdf,'server-pbkdf2-v1') kdf FROM users u LEFT JOIN user_kdf k ON k.user_id=u.id WHERE u.email=?").bind(email).first<{password_salt:string;kdf:string}>();
 const salt=u&&u.kdf===KDF_VERSION?u.password_salt:await digest('fake-salt:'+await pepper(env)+':'+email);
 return Response.json({salt,iterations:KDF_ITERATIONS,hash:'SHA-256',version:KDF_VERSION});
}
function allowed(env:Env,email:string):boolean{if(env.REGISTRATION_ENABLED==='true')return true;return (env.SIGNUP_ALLOWLIST||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean).includes(email)}
export async function clientAuthenticate(req:Request,env:Env,register:boolean):Promise<Response>{
 checkOrigin(req,env.APP_ORIGIN);assertIdentityOrigin(env,req);await rateLimit(req,env,'auth');
 const b=await readBody(req);
 if(Object.keys(b).sort().join(',')!==(register?'email,salt,verifier':'email,verifier'))throw new ApiError(400,'auth_fields_denied');
 const email=validateEmail(b.email);if(typeof b.verifier!=='string'||!HEX64.test(b.verifier))throw new ApiError(400,'invalid_verifier');
 let userId:string;
 if(register){
  if(!allowed(env,email))throw new ApiError(403,'registration_closed');
  if(typeof b.salt!=='string'||!HEX64.test(b.salt))throw new ApiError(400,'invalid_salt');
  userId=crypto.randomUUID();
  try{await env.DB.batch([env.DB.prepare('INSERT INTO users(id,email,password_hash,password_salt,created_at) VALUES(?,?,?,?,?)').bind(userId,email,await verifierHash(b.salt,b.verifier),b.salt,Date.now()),env.DB.prepare('INSERT INTO user_kdf(user_id,kdf) VALUES(?,?)').bind(userId,KDF_VERSION)]);}catch{throw new ApiError(409,'account_not_created')}
 }else{
  const key=await digest('login:'+email);await assertSignInAllowed(env,key);
  const u=await env.DB.prepare("SELECT u.id,u.password_hash,u.password_salt,COALESCE(k.kdf,'server-pbkdf2-v1') kdf FROM users u LEFT JOIN user_kdf k ON k.user_id=u.id WHERE u.email=?").bind(email).first<{id:string;password_hash:string;password_salt:string;kdf:string}>();
  const ok=!!u&&u.kdf===KDF_VERSION&&constantEqual(await verifierHash(u.password_salt,b.verifier),u.password_hash);
  if(!ok||!u){await recordSignInFailure(env,key);throw new ApiError(401,'invalid_credentials')}
  await clearSignInFailures(env,key);userId=u.id;
 }
 if(!register){const {mfaActive,createMfaChallenge}=await import('./mfa');if(await mfaActive(env,userId)){const c=await createMfaChallenge(env,userId);return Response.json({error:'mfa_required',mfaToken:c.mfaToken,expiresAt:c.expiresAt},{status:401})}}
 let oldHash:string|null=null;if(!register&&req.headers.has('cookie')){try{const {sessionToken}=await import('./security');oldHash=await digest(sessionToken(req))}catch{/* no usable prior session */}}
 return issueSession(env,userId,oldHash);
}
export const setKdf=(env:Env,userId:string,client:boolean)=>client?env.DB.prepare('INSERT INTO user_kdf(user_id,kdf) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET kdf=excluded.kdf').bind(userId,KDF_VERSION):env.DB.prepare('DELETE FROM user_kdf WHERE user_id=?').bind(userId);
export async function userKdf(env:Env,userId:string):Promise<string>{return (await env.DB.prepare('SELECT kdf FROM user_kdf WHERE user_id=?').bind(userId).first<{kdf:string}>())?.kdf||'server-pbkdf2-v1'}
