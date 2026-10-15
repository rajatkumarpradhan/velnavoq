import {useEffect,useState} from 'react';
import {api,useNavigation} from '../navigation';
import {Button} from './system';
import {liveAuthorizations} from '../connector-flow';
export function BuildGuide({nav}:{nav:ReturnType<typeof useNavigation>}){
 const [status,setStatus]=useState<{tokens:any[];grants:any[];requests:any[]}|null>(null),[failed,setFailed]=useState(false);
 useEffect(()=>{const c=new AbortController();let inFlight=false;
 const load=()=>{if(inFlight||c.signal.aborted)return;inFlight=true;api<typeof status>('/account-mcp',{signal:c.signal}).then(x=>{if(!c.signal.aborted){setStatus(x);setFailed(false)}}).catch(()=>{if(!c.signal.aborted)setFailed(true)}).finally(()=>{inFlight=false})};
 const refresh=()=>{if(document.visibilityState==='visible')load()};load();addEventListener('focus',refresh);addEventListener('velnavoq:approvals-changed',refresh);document.addEventListener('visibilitychange',refresh);
 return()=>{c.abort();removeEventListener('focus',refresh);removeEventListener('velnavoq:approvals-changed',refresh);document.removeEventListener('visibilitychange',refresh)}},[nav.user?.userId]);
 const active=liveAuthorizations(status);
 return <section className="connection-bar" aria-label="AI connection"><div><span className="connection-dot"/><strong>{failed?'Connection status unavailable':!status?'Checking connections…':active.length?`${active.length} saved AI authorization${active.length===1?'':'s'}`:'Connect your AI to start'}</strong><p>Describe in ChatGPT, Grok or Claude. Review and publish here.</p></div><Button onClick={()=>nav.go('mcp',nav.loc.workspace,'')}>{failed?'Check connections':active.length?'Manage connections':'Connect your AI'}</Button></section>
}
