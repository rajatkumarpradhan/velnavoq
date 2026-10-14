import {api,HttpError} from './navigation';

const cancelled=()=>Error('Preview cancelled.');
const checkCancellation=(signal:AbortSignal)=>{if(signal.aborted)throw cancelled()};
type WorkerResult={status:string;exitCode:number;durationMs:number};

export async function ensurePreviewBuild(pid:string,signal:AbortSignal,progress:(s:string)=>void){
 const base='/projects/'+pid;
 checkCancellation(signal);
 progress('Checking saved website...');
 const c=await api<{snapshot:{revision:number;sourceDigest:string}}>(base+'/agent/context',{signal});
 checkCancellation(signal);
 if(!c.snapshot.revision)throw Error('Approve your website files first.');
 const history=await api<{jobs:{id:string;status:string;revision:number;source_digest:string;finished_at:number}[]}>(base+'/build',{signal});
 checkCancellation(signal);
 const found=history.jobs.find(j=>j.status==='succeeded'&&j.revision===c.snapshot.revision&&j.source_digest===c.snapshot.sourceDigest&&j.finished_at>Date.now()-3600000);
 if(found){progress('Opening saved preview...');return found.id}
 progress('Preparing your website...');
 // Do not abort a reservation response: its ID is needed to cancel the server job.
 const job=await api<{id:string;runtimeId:string;files:Record<string,string>}>(base+'/build',{method:'POST',body:JSON.stringify({command:'build static-web-v1',baseRevision:c.snapshot.revision,sourceDigest:c.snapshot.sourceDigest})});
 const cancel=()=>api(base+'/build/'+job.id+'/cancel',{method:'POST',body:JSON.stringify({runtimeId:job.runtimeId})});
 if(signal.aborted){await cancel();throw cancelled()}
 await new Promise<void>((resolve,reject)=>{
  let worker:Worker|undefined,timer:ReturnType<typeof setTimeout>|undefined,settled=false;
  const events:{seq:number;stream:string;text:string}[]=[];
  const started=performance.now();
  const cleanup=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);worker?.terminate()};
  const finish=async(result:WorkerResult,isCancelled=false)=>{
   if(settled)return;
   settled=true;cleanup();
   // Cancellation must not depend on uploading logs: logs can be rejected.
   if(isCancelled){try{await cancel();reject(cancelled())}catch{reject(Error('Preview stopped locally, but its build cancellation could not be saved.'))}return}
   try{
    for(let i=0;i<events.length;i+=50)await api(base+'/build/'+job.id+'/events',{method:'POST',body:JSON.stringify({runtimeId:job.runtimeId,events:events.slice(i,i+50)})});
    await api(base+'/build/'+job.id+'/finish',{method:'POST',body:JSON.stringify({runtimeId:job.runtimeId,...result})});
    if(result.status!=='succeeded')reject(Error('Website check failed. Ask your AI to fix the build errors, then tap Preview again.'));
    else resolve();
   }catch(e){try{await cancel()}catch{}reject(e)}
  };
  const abort=()=>void finish({status:'cancelled',exitCode:130,durationMs:Math.round(performance.now()-started)},true);
  try{
   worker=new Worker(new URL('./components/build-worker.ts',import.meta.url),{type:'module'});
   timer=setTimeout(()=>void finish({status:'timed_out',exitCode:124,durationMs:Math.round(performance.now()-started)}),15000);
   signal.addEventListener('abort',abort,{once:true});
   worker.onerror=()=>void finish({status:'failed',exitCode:1,durationMs:Math.round(performance.now()-started)});
   worker.onmessage=e=>{if(e.data.kind==='log')events.push({seq:events.length+1,stream:'stdout',text:e.data.text});else if(e.data.kind==='result')void finish(e.data.result)};
   if(signal.aborted){abort();return}
   worker.postMessage({files:job.files});
  }catch(e){if(!settled){settled=true;cleanup();void cancel().then(()=>reject(e),()=>reject(Error('Preview stopped locally, but its build cancellation could not be saved.')))}}
 });
 checkCancellation(signal);
 progress('Opening your preview...');return job.id;
}
export function previewError(e:unknown){if(!(e instanceof HttpError))return (e as Error).message;const messages:Record<string,string>={stale_build_snapshot:'Your files changed. Tap Preview again.',stale_preview_build:'Your files changed. Tap Preview again.',one_active_job_per_user:'Another build is running. Wait for it to finish, then try again.',artifact_expired:'This preview expired. Tap Preview again.',rate_limited:'Too many requests. Wait a minute and try again.'};return messages[e.code]||'Could not prepare preview: '+e.code;}
