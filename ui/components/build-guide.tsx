import {useEffect,useState} from 'react';
import {api,useNavigation} from '../navigation';
import {Button} from './system';
export function BuildGuide({nav}:{nav:ReturnType<typeof useNavigation>}){
 const [status,setStatus]=useState<{tokens:any[];grants:any[];requests:any[]}|null>(null),[failed,setFailed]=useState(false);
 useEffect(()=>{const c=new AbortController();api<typeof status>('/account-mcp',{signal:c.signal}).then(setStatus).catch(()=>{if(!c.signal.aborted)setFailed(true)});return()=>c.abort()},[nav.user?.userId]);
 const active=status?.tokens.filter(t=>!t.revoked_at&&t.expires_at>Date.now())||[];
 return <section className="connection-bar" aria-label="AI connection"><div><span className="connection-dot"/><strong>{failed?'Connection status unavailable':!status?'Checking connections…':active.length?`${active.length} AI connection(s)`:'Connect your AI to start'}</strong><p>Describe in ChatGPT, Grok or Claude. Review and publish here.</p></div><Button onClick={()=>nav.go('mcp',nav.loc.workspace,'')}>{active.length?'Manage connections':'Connect your AI'}</Button></section>
}
