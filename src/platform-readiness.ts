import type {Env} from './contracts';
import {SESSION_SECONDS} from './auth';
/** Configuration evidence only. Never implies deployment health or client compatibility. */
export function platformReadiness(env:Env) {
 const blockers:string[]=[];
 let origin:string|null=null,target:string|null=null;
 try {const u=new URL(env.APP_ORIGIN);if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw Error();origin=u.origin;} catch {blockers.push('control_origin_invalid');}
 const local=origin!==null&&['localhost','127.0.0.1','[::1]'].includes(new URL(origin).hostname);
 if(origin&&!local&&!origin.startsWith('https:'))blockers.push('control_https_required');
 try {const u=new URL(env.DEPLOY_ORIGIN||'');if(u.origin===origin||u.pathname!=='/'||u.search||u.hash||u.username||u.password||!(env.DEPLOY_MODE==='public'&&u.protocol==='https:'||env.DEPLOY_MODE==='local'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname)))throw Error();target=u.origin;} catch {blockers.push('release_target_invalid_or_missing');}
 if(!env.DEPLOY_TARGET)blockers.push('release_binding_missing');
 const publishing=!!target&&!!env.DEPLOY_TARGET&&!!origin&&!blockers.includes('control_https_required');
 return {
  evidence:'configuration-only',mcp:{endpoint:origin?origin+'/mcp':null,transport:'streamable-http',authentication:'oauth2-pkce',externalClientsVerified:false},
  sessions:{persistent:true,lifetimeDays:SESSION_SECONDS/86400,idleSignout:false,revocable:true},
  publishing:{configured:publishing,target:publishing?target:null,healthVerified:false},
  backend:{kind:'fixed-typed-d1',operations:['public-read','public-create','owner-admin'],privateAppUsers:false,arbitraryServerCode:false,sensitiveDataSupported:false},
  repair:{configured:!!env.AI&&env.AI_REPAIR_ENABLED==='true',paidFallback:false},
  preview:{serverSupported:true,browserHostVerified:false},blockers,
 };
}
