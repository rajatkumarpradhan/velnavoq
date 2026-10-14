import {api} from './navigation';
export type PreviewSession={id:string;files:Record<string,string>;expiresAt:number;privateBackend?:boolean;backendDigest?:string|null};
/** Keep the creation receipt even when Stop is pressed while the POST is in flight. */
export async function createPreviewSession(pid:string,jobId:string,signal:AbortSignal,privateBackend=false):Promise<PreviewSession>{
 if(signal.aborted)throw Error('Preview cancelled.');
 const base='/projects/'+pid+'/preview';
 const session=await api<PreviewSession>(base,{method:'POST',body:JSON.stringify({jobId,...(privateBackend?{privateBackend:true}:{})})});
 if(signal.aborted){
  try{await api(base+'/'+session.id+'/stop',{method:'POST',body:'{}'})}
  catch{throw Error('Preview stopped locally, but its session stop could not be saved.')}
  throw Error('Preview cancelled.');
 }
 return session;
}
