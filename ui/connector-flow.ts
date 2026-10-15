import {authorizationActive} from './connection-status';
// Only backend-issued, unrevoked access is ready. Registrations/consents never count.
export function liveAuthorizations(data:any,now=Date.now()):any[]{return (data?.tokens||[]).filter((t:any)=>authorizationActive(t,now))}
export function connectionScreen(data:any,hash:string,now=Date.now()){
 const q=new URLSearchParams(hash.split('?')[1]||'');if(q.has('accountConsent'))return 'consent';
 const screen=q.get('screen');if(screen==='access')return 'access';if(screen==='setup')return 'setup';
 const ready=liveAuthorizations(data,now).length>0;
 return ready?'connected':screen==='connected'?'waiting':'setup';
}
export function connectorSignIn(){return '#signin?next=mcp'}
export function signedInDestination(hash:string){return new URLSearchParams(hash.split('?')[1]||'').get('next')==='mcp'?'mcp':'dashboard'}
