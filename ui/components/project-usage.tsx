import {useEffect,useState} from 'react';
import {api,HttpError,useNavigation} from '../navigation';
import {Badge,Button,Empty,Notice,Panel} from './system';
type Row={metric:string;scope:string;window:string;limit:number;used:number;percent:number;label:string;resetsAt:string|null};
type Report={generatedAt:string;limits:Row[]};
const scopeTitle:Record<string,string>={user:'Your account',workspace:'This workspace',project:'This project',global:'Whole service'};
const per=(w:string)=>w==='total'?'current total':'per '+w;
const fmt=(r:Row)=>r.label.startsWith('bytes')?(r.used/1048576).toFixed(1)+' of '+(r.limit/1048576).toFixed(0)+' MB':r.used.toLocaleString()+' of '+r.limit.toLocaleString();
export function ProjectUsage({nav}:{nav:ReturnType<typeof useNavigation>}){const pid=nav.selectedProject?.id;const [report,setReport]=useState<Report|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const read=async()=>{setBusy(true);setError('');try{setReport(await api<Report>(pid?'/projects/'+pid+'/quota':'/quota'))}catch(e){setError(e instanceof HttpError?e.code:'connection_unavailable')}finally{setBusy(false)}};
 useEffect(()=>{setReport(null);void read()},[pid]);
 const rows=report?.limits??[];const hot=rows.filter(r=>r.percent>=80);
 return <><div className="page-title"><div><div className="eyebrow">ACCOUNT / LIMITS</div><h1>Usage and limits</h1><p>Real counters from this service, not estimates. Limits protect the free plan and stop runaway loops. Nothing here is billed.</p></div><Button onClick={()=>void read()} busy={busy}>Refresh</Button></div>
 {error&&<Notice tone="error">Could not load usage ({error}).</Notice>}
 {!report&&!error&&<Notice>Loading usage...</Notice>}
 {report&&<>{hot.length>0?<Notice tone="error">{hot.length} limit{hot.length>1?'s are':' is'} at 80% or more: {hot.map(h=>h.label+' ('+per(h.window)+')').join('; ')}. Waiting for the reset time below, or removing unused items, frees room.</Notice>:<Notice>All limits have room. Counters reset on a fixed clock (minute, hour or UTC day).</Notice>}
 {!pid&&<Notice>Select a project to also see project and workspace limits.</Notice>}
 {(['user','workspace','project','global'] as const).map(s=>{const g=rows.filter(r=>r.scope===s);if(!g.length)return null;return <Panel key={s} title={scopeTitle[s]!} aside={<Badge>{g.length} limits</Badge>}>{g.map(r=><div className="quota-row" key={r.metric}><div className="quota-text"><span>{r.label}</span><small>{per(r.window)}{r.resetsAt?' · resets '+new Date(r.resetsAt).toLocaleString([], {hour:'2-digit',minute:'2-digit',month:'short',day:'numeric'}):''}</small></div><div className="quota-meter"><progress max={100} value={r.percent} aria-label={r.label+' '+per(r.window)+', '+r.percent+' percent used'}/><code>{fmt(r)}</code></div></div>)}</Panel>})}
 <Panel title="What happens at a limit"><p className="body-copy">You get a plain message with the reset time and nothing is lost or deleted. Hitting limits many times in a row pauses costly actions (builds, deployments, AI) for 15 minutes; reading and saving still work. AI has a daily cap for the whole service so the free Workers AI allowance is not exceeded.</p></Panel></>}</>;}
