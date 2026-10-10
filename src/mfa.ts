// Part 28: TOTP multi-factor authentication (RFC 6238) with one-time recovery codes.
// Secrets are AES-GCM encrypted with the operator SECRET_STORE_KEY, AAD-bound to the user.
// Enrollment and verification fail closed when key custody is not configured.
import {ApiError,type Env,type Identity} from './contracts';
import {constantEqual,digest,hex,randomToken,readBody,validatePassword,passwordHash} from './security';
import {rateLimit} from './auth';
const STEP=30,DIGITS=6,WINDOW=1,PENDING_TTL=300,MAX_ATTEMPTS=5,RECOVERY_COUNT=8;
const enc=new TextEncoder();
const B32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32Encode(bytes:Uint8Array):string{let bits=0,value=0,out='';for(const b of bytes){value=(value<<8)|b;bits+=8;while(bits>=5){out+=B32[(value>>>(bits-5))&31]!;bits-=5}}if(bits)out+=B32[(value<<(5-bits))&31]!;return out}
export function base32Decode(text:string):Uint8Array{let bits=0,value=0;const out:number[]=[];for(const c of text.toUpperCase().replace(/=+$/,'')){const i=B32.indexOf(c);if(i<0)throw new ApiError(400,'invalid_mfa_code');value=(value<<5)|i;bits+=5;if(bits>=8){out.push((value>>>(bits-8))&255);bits-=8}}return new Uint8Array(out)}
/** HMAC-SHA1 TOTP code at a unix-seconds timestamp. */
export async function totp(secret:Uint8Array,atSeconds:number,stepOffset=0):Promise<string>{
 const counter=Math.floor(atSeconds/STEP)+stepOffset,buf=new ArrayBuffer(8),view=new DataView(buf);view.setUint32(0,Math.floor(counter/0x100000000));view.setUint32(4,counter>>>0);
 const key=await crypto.subtle.importKey('raw',secret as unknown as ArrayBuffer,{name:'HMAC',hash:'SHA-1'},false,['sign']);
 const mac=new Uint8Array(await crypto.subtle.sign('HMAC',key,buf)),offset=mac[mac.length-1]!&15;
 const code=((mac[offset]!&127)<<24|mac[offset+1]!<<16|mac[offset+2]!<<8|mac[offset+3]!)%10**DIGITS;
 return String(code).padStart(DIGITS,'0');
}
async function cryptMfa(env:Env,userId:string,text:string,decrypt=false):Promise<string>{
 try{
  if(!env.SECRET_STORE_KEY||!/^[0-9a-f]{64}$/.test(env.SECRET_STORE_KEY)||!env.SECRET_STORE_KEY_VERSION||!/^[A-Za-z0-9_-]{1,32}$/.test(env.SECRET_STORE_KEY_VERSION))throw 0;
  const raw=Uint8Array.from(env.SECRET_STORE_KEY.match(/../g)!,x=>parseInt(x,16)),key=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt']),additionalData=enc.encode('mfa-totp-secret:'+userId+':'+env.SECRET_STORE_KEY_VERSION);
  if(decrypt){const bytes=Uint8Array.from(atob(text),x=>x.charCodeAt(0));return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(0,12),additionalData},key,bytes.slice(12)))}
  const iv=crypto.getRandomValues(new Uint8Array(12)),cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData},key,enc.encode(text))),out=new Uint8Array(12+cipher.length);out.set(iv);out.set(cipher,12);return btoa(String.fromCharCode(...out));
 }catch{throw new ApiError(503,'mfa_secret_storage_unavailable')}
}
export async function mfaActive(env:Env,userId:string):Promise<boolean>{
 return !!(await env.DB.prepare("SELECT 1 FROM mfa_enrollments WHERE user_id=? AND status='active'").bind(userId).first());
}
async function loadSecret(env:Env,userId:string,status:'pending'|'active'):Promise<Uint8Array>{
 const row=await env.DB.prepare('SELECT secret_enc FROM mfa_enrollments WHERE user_id=? AND status=?').bind(userId,status).first<{secret_enc:string}>();
 if(!row)throw new ApiError(409,status==='pending'?'mfa_enrollment_not_started':'mfa_not_enabled');
 return base32Decode(await cryptMfa(env,userId,row.secret_enc,true));
}
function validateCode(raw:unknown):string{
 if(typeof raw!=='string')throw new ApiError(400,'invalid_mfa_code');
 const code=raw.replace(/[\s-]/g,'');if(!/^\d{6}$/.test(code))throw new ApiError(400,'invalid_mfa_code');return code;
}
/** Accept a fresh TOTP code; a code from an already-used timestep is replay and is denied. */
async function verifyTotp(env:Env,userId:string,secret:Uint8Array,code:string,record=true):Promise<boolean>{
 const now=Math.floor(Date.now()/1000);
 for(let w=-WINDOW;w<=WINDOW;w++)if(constantEqual(await totp(secret,now,w),code)){
  const step=Math.floor(now/STEP)+w;
  if(record){
   const row=await env.DB.prepare('SELECT last_step FROM mfa_enrollments WHERE user_id=?').bind(userId).first<{last_step:number}>();
   if(row&&step<=row.last_step)return false;
   await env.DB.prepare('UPDATE mfa_enrollments SET last_step=? WHERE user_id=?').bind(step,userId).run();
  }
  return true;
 }
 return false;
}
/** A recovery code is single-use and burned on success. */
async function useRecoveryCode(env:Env,userId:string,raw:unknown):Promise<boolean>{
 if(typeof raw!=='string'||!/^[0-9a-f]{4}-[0-9a-f]{4}$/.test(raw))return false;
 const hash=await digest(raw),hit=await env.DB.prepare('DELETE FROM mfa_recovery_codes WHERE user_id=? AND code_hash=?').bind(userId,hash).run();
 return !!hit.meta.changes;
}
async function issueRecoveryCodes(env:Env,userId:string):Promise<string[]>{
 await env.DB.prepare('DELETE FROM mfa_recovery_codes WHERE user_id=?').bind(userId).run();
 const codes:string[]=[];const now=Date.now();
 for(let i=0;i<RECOVERY_COUNT;i++){const code=hex(crypto.getRandomValues(new Uint8Array(4)).buffer).slice(0,8);const formatted=code.slice(0,4)+'-'+code.slice(4);codes.push(formatted);await env.DB.prepare('INSERT INTO mfa_recovery_codes(user_id,code_hash,created_at) VALUES(?,?,?)').bind(userId,await digest(formatted),now).run()}
 return codes;
}
/** Create the short-lived second-factor challenge after a correct password. */
export async function createMfaChallenge(env:Env,userId:string):Promise<{mfaToken:string;expiresAt:number}>{
 await env.DB.prepare('DELETE FROM mfa_pending WHERE user_id=? OR expires_at<?').bind(userId,Math.floor(Date.now()/1000)).run();
 const token=randomToken(),now=Math.floor(Date.now()/1000);
 await env.DB.prepare('INSERT INTO mfa_pending(token_hash,user_id,attempts,expires_at,created_at) VALUES(?,?,0,?,?)').bind(await digest(token),userId,now+PENDING_TTL,now).run();
 return {mfaToken:token,expiresAt:now+PENDING_TTL};
}
export interface MfaVerified{userId:string;method:'totp'|'recovery_code'}
/** Verify a second-factor challenge. Fails closed, bounded attempts, burns the challenge on success. */
export async function verifyMfaChallenge(req:Request,env:Env):Promise<MfaVerified>{
 await rateLimit(req,env,'mfa-verify',10);
 const b=await readBody(req);
 if(typeof b.mfaToken!=='string'||!/^[0-9a-f]{64}$/.test(b.mfaToken))throw new ApiError(401,'invalid_mfa_challenge');
 const hash=await digest(b.mfaToken),now=Math.floor(Date.now()/1000);
 const pending=await env.DB.prepare('SELECT user_id,attempts,expires_at FROM mfa_pending WHERE token_hash=?').bind(hash).first<{user_id:string;attempts:number;expires_at:number}>();
 if(!pending||pending.expires_at<=now)throw new ApiError(401,'invalid_mfa_challenge');
 let method:MfaVerified['method']|null=null;
 if(typeof b.recoveryCode==='string'&&await useRecoveryCode(env,pending.user_id,b.recoveryCode))method='recovery_code';
 else if(b.code!==undefined){const code=validateCode(b.code);const secret=await loadSecret(env,pending.user_id,'active');if(await verifyTotp(env,pending.user_id,secret,code))method='totp'}
 if(!method){
  const attempts=pending.attempts+1;
  if(attempts>=MAX_ATTEMPTS)await env.DB.prepare('DELETE FROM mfa_pending WHERE token_hash=?').bind(hash).run();
  else await env.DB.prepare('UPDATE mfa_pending SET attempts=? WHERE token_hash=?').bind(attempts,hash).run();
  throw new ApiError(401,attempts>=MAX_ATTEMPTS?'mfa_attempts_exhausted':'invalid_mfa_code');
 }
 await env.DB.prepare('DELETE FROM mfa_pending WHERE token_hash=?').bind(hash).run();
 return {userId:pending.user_id,method};
}
export async function mfaApi(req:Request,env:Env,who:Identity):Promise<Response|null>{
 const path=new URL(req.url).pathname,method=req.method;
 if(!path.startsWith('/api/auth/mfa'))return null;
 if(path==='/api/auth/mfa'&&method==='GET'){
  const row=await env.DB.prepare('SELECT status,activated_at FROM mfa_enrollments WHERE user_id=?').bind(who.userId).first<{status:string;activated_at:number|null}>();
  const remaining=(await env.DB.prepare('SELECT COUNT(*) AS n FROM mfa_recovery_codes WHERE user_id=?').bind(who.userId).first<{n:number}>())?.n||0;
  return Response.json({enabled:row?.status==='active',pendingEnrollment:row?.status==='pending',activatedAt:row?.activated_at||null,recoveryCodesRemaining:row?.status==='active'?remaining:0});
 }
 if(path==='/api/auth/mfa/enroll'&&method==='POST'){
  await rateLimit(req,env,'mfa-manage',10);
  if(await mfaActive(env,who.userId))throw new ApiError(409,'mfa_already_enabled');
  const secret=crypto.getRandomValues(new Uint8Array(20)),encoded=base32Encode(secret),now=Date.now();
  const cipher=await cryptMfa(env,who.userId,encoded);
  await env.DB.prepare("INSERT INTO mfa_enrollments(user_id,secret_enc,key_version,status,last_step,created_at,activated_at) VALUES(?,?,?,'pending',-1,?,NULL) ON CONFLICT(user_id) DO UPDATE SET secret_enc=excluded.secret_enc,key_version=excluded.key_version,status='pending',last_step=-1,created_at=excluded.created_at,activated_at=NULL").bind(who.userId,cipher,env.SECRET_STORE_KEY_VERSION!,now).run();
  const email=(await env.DB.prepare('SELECT email FROM users WHERE id=?').bind(who.userId).first<{email:string}>())?.email||'account';
  return Response.json({secret:encoded,otpauthUrl:'otpauth://totp/Velnavoq:'+encodeURIComponent(email)+'?secret='+encoded+'&issuer=Velnavoq&digits=6&period=30',recoveryCodesIssued:false},{status:201});
 }
 if(path==='/api/auth/mfa/activate'&&method==='POST'){
  await rateLimit(req,env,'mfa-manage',10);
  const b=await readBody(req),code=validateCode(b.code),secret=await loadSecret(env,who.userId,'pending');
  if(!(await verifyTotp(env,who.userId,secret,code,false)))throw new ApiError(401,'invalid_mfa_code');
  await env.DB.prepare("UPDATE mfa_enrollments SET status='active',activated_at=?,last_step=? WHERE user_id=? AND status='pending'").bind(Date.now(),Math.floor(Date.now()/1000/STEP),who.userId).run();
  const recoveryCodes=await issueRecoveryCodes(env,who.userId);
  return Response.json({enabled:true,recoveryCodes});
 }
 if(path==='/api/auth/mfa/disable'&&method==='POST'){
  await rateLimit(req,env,'mfa-manage',10);
  const b=await readBody(req);
  const keys=Object.keys(b).sort().join(',');
  const clientKdf='verifier' in b;
  if(!(clientKdf?['code,verifier','recoveryCode,verifier']:['code,password','password,recoveryCode']).includes(keys))throw new ApiError(400,'mfa_disable_fields_denied');
  const u=await env.DB.prepare('SELECT password_hash,password_salt FROM users WHERE id=?').bind(who.userId).first<{password_hash:string;password_salt:string}>();
  if(clientKdf){if(typeof b.verifier!=='string'||!/^[0-9a-f]{64}$/.test(b.verifier))throw new ApiError(400,'invalid_verifier');const {verifierHash,userKdf}=await import('./client-auth');if(!u||await userKdf(env,who.userId)!=='client-v1'||!constantEqual(await verifierHash(u.password_salt,b.verifier),u.password_hash))throw new ApiError(401,'invalid_credentials')}
  else{const password=validatePassword(b.password);if(!u||!constantEqual(await passwordHash(password,u.password_salt),u.password_hash))throw new ApiError(401,'invalid_credentials')}
  if(!await mfaActive(env,who.userId))throw new ApiError(409,'mfa_not_enabled');
  let ok=false;
  if(typeof b.recoveryCode==='string')ok=await useRecoveryCode(env,who.userId,b.recoveryCode);
  else{const code=validateCode(b.code),secret=await loadSecret(env,who.userId,'active');ok=await verifyTotp(env,who.userId,secret,code)}
  if(!ok)throw new ApiError(401,'invalid_mfa_code');
  // Factor removal terminates every other session; the current session survives with its fresh proof.
  await env.DB.batch([env.DB.prepare('DELETE FROM mfa_enrollments WHERE user_id=?').bind(who.userId),env.DB.prepare('DELETE FROM mfa_recovery_codes WHERE user_id=?').bind(who.userId),env.DB.prepare('DELETE FROM mfa_pending WHERE user_id=?').bind(who.userId),env.DB.prepare('DELETE FROM sessions WHERE user_id=? AND token_hash<>?').bind(who.userId,who.sessionHash)]);
  return Response.json({enabled:false});
 }
 if(path==='/api/auth/mfa/recovery-codes'&&method==='POST'){
  await rateLimit(req,env,'mfa-manage',10);
  const b=await readBody(req),code=validateCode(b.code),secret=await loadSecret(env,who.userId,'active');
  if(!(await verifyTotp(env,who.userId,secret,code)))throw new ApiError(401,'invalid_mfa_code');
  return Response.json({recoveryCodes:await issueRecoveryCodes(env,who.userId)});
 }
 throw new ApiError(404,'not_found');
}
