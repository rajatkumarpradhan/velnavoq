import {useEffect,useState} from 'react';
import {api,useNavigation} from '../navigation';
import {Button} from './system';
import {liveAuthorizations} from '../connector-flow';
import {registeredProvider} from '../connection-status';
export function BuildGuide({nav,projectClients=[]}:{nav:ReturnType<typeof useNavigation>;projectClients?:any[]}){
 const [status,setStatus]=useState<{tokens:any[];grants:any[];requests:any[]}|null>(null),[failed,setFailed]=useState(false);
 useEffect(()=>{const c=new AbortController();let inFlight=false;
 const load=()=>{if(inFlight||c.signal.aborted)return;inFlight=true;api<typeof status>('/account-mcp',{signal:c.signal}).then(x=>{if(!c.signal.aborted){setStatus(x);setFailed(false)}}).catch(()=>{if(!c.signal.aborted)setFailed(true)}).finally(()=>{inFlight=false})};
 const refresh=()=>{if(document.visibilityState==='visible')load()};load();addEventListener('focus',refresh);addEventListener('velnavoq:approvals-changed',refresh);document.addEventListener('visibilitychange',refresh);
 return()=>{c.abort();removeEventListener('focus',refresh);removeEventListener('velnavoq:approvals-changed',refresh);document.removeEventListener('visibilitychange',refresh)}},[nav.user?.userId]);
 const accountActive=liveAuthorizations(status);
 const active=accountActive.length?accountActive:projectClients.filter(c=>c.active_access);
 const providers=Array.from(new Set(active.map(t=>registeredProvider(t.redirect_uri||'')).filter(Boolean))) as string[];
 const home=(p:string)=>p==='Grok'?'https://grok.com/':p==='Claude'?'https://claude.ai/':'https://chatgpt.com/';
 return <section className="connection-bar" aria-label="AI connection"><div><span className="connection-dot"/><strong>{failed?'Connection status unavailable':!status?'Checking connections…':active.length?`${active.length} saved AI authorization${active.length===1?'':'s'}`:'Connect your AI to start'}</strong><p>{active.length?'Continue in your assistant. Your app and preview stay here.':'Use your own ChatGPT, Grok or Claude to build.'}</p></div><div className="connected-actions">{!failed&&providers.map(p=><a key={p} className="button primary" href={home(p)} target="_blank" rel="noopener noreferrer">Continue in {p} →</a>)}<Button onClick={()=>nav.go('mcp',nav.loc.workspace,'')}>{failed?'Check connections':active.length?'Manage connections':'Connect your AI'}</Button></div></section>
}
