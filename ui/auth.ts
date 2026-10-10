// Browser-side password stretching (Part 29). The server never sees the password, only this verifier.
const enc=new TextEncoder();
const hex=(b:ArrayBuffer)=>Array.from(new Uint8Array(b),n=>n.toString(16).padStart(2,'0')).join('');
export const MIN_ITERATIONS=600000;
export const newSalt=()=>hex(crypto.getRandomValues(new Uint8Array(32)).buffer);
export async function derive(password:string,salt:string,iterations=MIN_ITERATIONS):Promise<string>{
 if(iterations<MIN_ITERATIONS)throw new Error('kdf_downgrade_refused');
 const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);
 return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(salt),iterations,hash:'SHA-256'},key,256));
}
export async function newPasswordProblem(p:string):Promise<string>{
 if(p.length<14)return 'Use at least 14 characters.';if(p.length>128)return 'Use at most 128 characters.';
 const {blockedPasswords}=await import('../src/password-blocklist');if(blockedPasswords.has(p))return 'That password is too common. Pick another.';return '';
}
export async function post(path:string,body:object):Promise<{status:number;body:any}>{
 const r=await fetch('/api'+path,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 return {status:r.status,body:await r.json().catch(()=>({}))};
}
const messages:Record<string,string>={invalid_credentials:'Email or password is not right.',registration_closed:'Sign-ups are closed right now. Velnavoq is invite-only while it is being tested.',account_not_created:'That email cannot be used. Try signing in instead.',rate_limited:'Too many tries. Wait a minute and try again.',invalid_email:'Enter a valid email address.',account_locked_temporarily:'Too many wrong passwords. Try again in 15 minutes.',invalid_mfa_code:'That code did not work. Try the next code or a recovery code.',invalid_or_expired_reset_token:'That reset link is invalid or has expired. Ask for a new one.',production_identity_not_configured:'Sign-in is not switched on for this address yet.',connection_unavailable:'Could not reach the server. Check your connection.',origin_denied:'This page is opened from a different address than the app expects.'};
export const friendly=(code:string)=>messages[code]||('Something went wrong ('+code+').');

/** Verifier for the signed-in user's current password (used for sensitive changes). */
export async function currentVerifier(password:string):Promise<string>{
 const me=await (await fetch('/api/me',{credentials:'same-origin'})).json();const k=await post('/auth/kdf',{email:me.email});if(k.status>=400)throw new Error(k.body.error||'request_failed');return derive(password,k.body.salt,k.body.iterations);
}
