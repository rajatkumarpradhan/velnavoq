export const MAX_TIMEOUT=2147483647;
export function sessionDelay(expiresAt:number,now=Date.now()){if(!Number.isFinite(expiresAt))return null;return Math.min(MAX_TIMEOUT,Math.max(0,expiresAt*1000-now))}
export function scheduleSessionExpiry(expiresAt:number,onExpire:()=>void){let timer:ReturnType<typeof setTimeout>|undefined,stopped=false;const arm=()=>{if(stopped)return;const delay=sessionDelay(expiresAt);if(delay===null)return;if(delay===0){onExpire();return}timer=setTimeout(arm,delay)};arm();return()=>{stopped=true;if(timer!==undefined)clearTimeout(timer)}}
