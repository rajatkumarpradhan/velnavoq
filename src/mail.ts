// Part 29: password-recovery email delivery. Interface plus one provider (Brevo transactional API,
// free tier). No provider is active unless BREVO_API_KEY and MAIL_FROM are both configured as
// Worker secrets/vars. Nothing here creates an account or sends anything on its own.
import {assertMailProviderUrl} from './egress';
import type {Env} from './contracts';
export type MailResult='sent'|'not_configured'|'failed';
export function mailConfigured(env:Env):boolean{return !!env.BREVO_API_KEY&&!!env.MAIL_FROM&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.MAIL_FROM)}
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export async function sendRecoveryMail(env:Env,to:string,link:string,minutes:number,doFetch:typeof fetch=fetch):Promise<MailResult>{
 if(!mailConfigured(env))return 'not_configured';
 const url=assertMailProviderUrl(env.MAIL_ENDPOINT||'https://api.brevo.com/v3/smtp/email');
 if(!await admitMailDelivery(env))return 'failed';
 const text=`Someone asked to reset the password for your Velnavoq account.\n\nOpen this link within ${minutes} minutes to choose a new password:\n${link}\n\nIf you did not ask for this, ignore this email. Your password stays the same.\n\nVelnavoq by Drayvenn Lab`;
 const html=`<p>Someone asked to reset the password for your Velnavoq account.</p><p><a href="${esc(link)}">Choose a new password</a><br><small>This link works once and expires in ${minutes} minutes.</small></p><p>If you did not ask for this, ignore this email. Your password stays the same.</p><p>Velnavoq by Drayvenn Lab</p>`;
 try{
  const r=await doFetch(url.toString(),{method:'POST',headers:{'api-key':env.BREVO_API_KEY!,'content-type':'application/json',accept:'application/json'},body:JSON.stringify({sender:{email:env.MAIL_FROM,name:env.MAIL_FROM_NAME||'Velnavoq'},to:[{email:to}],subject:'Reset your Velnavoq password',textContent:text,htmlContent:html})});
  return r.ok?'sent':'failed';
 }catch{return 'failed'}
}

export async function sendIdentityMail(env:Env,to:string,link:string,kind:'verify'|'recover',doFetch:typeof fetch=fetch):Promise<MailResult>{
 if(!mailConfigured(env))return 'not_configured';
 const url=assertMailProviderUrl(env.MAIL_ENDPOINT||'https://api.brevo.com/v3/smtp/email');
 if(!await admitMailDelivery(env))return 'failed';
 const action=kind==='verify'?'Verify your email':'Reset your app password';
 const text=`${action} for your Velnavoq account or generated app. Open this one-time link within 30 minutes:\n${link}\nIf you did not request this, ignore it.`;
 try{const r=await doFetch(url.toString(),{method:'POST',headers:{'api-key':env.BREVO_API_KEY!,'content-type':'application/json',accept:'application/json'},body:JSON.stringify({sender:{email:env.MAIL_FROM,name:env.MAIL_FROM_NAME||'Velnavoq'},to:[{email:to}],subject:action+' · Velnavoq',textContent:text})});return r.ok?'sent':'failed'}catch{return 'failed'}
}

async function admitMailDelivery(env:Env):Promise<boolean>{try{const day=Math.floor(Date.now()/86400000)*86400000;await env.DB.prepare('DELETE FROM identity_mail_rates WHERE window<?').bind(day-86400000).run();return !!await env.DB.prepare("INSERT INTO identity_mail_rates VALUES('__service__','delivery.day',?,1) ON CONFLICT(namespace,email_hash,window) DO UPDATE SET count=count+1 WHERE count<100 RETURNING count").bind(day).first()}catch{return false}}
