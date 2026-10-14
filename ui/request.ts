/** Bounded reads and writes. Never retries a mutation whose outcome is unknown. */
export const REQUEST_TIMEOUT_MS=20000;
export class RequestTimeout extends Error { constructor(){super('request_timeout');this.name='RequestTimeout'} }
export async function requestJson(path:string,init:RequestInit={},timeoutMs=REQUEST_TIMEOUT_MS):Promise<{status:number;ok:boolean;body:any}>{
 const controller=new AbortController();let timedOut=false;
 const abort=()=>controller.abort(init.signal?.reason);
 if(init.signal?.aborted)abort();else init.signal?.addEventListener('abort',abort,{once:true});
 const timer=setTimeout(()=>{timedOut=true;controller.abort()},timeoutMs);
 try{
  const response=await fetch(path,{...init,signal:controller.signal});
  let body:any;try{body=await response.json()}catch(e){if(controller.signal.aborted)throw e;throw new Error('invalid_server_response')}
  return {status:response.status,ok:response.ok,body};
 }catch(e){if(timedOut)throw new RequestTimeout();throw e}
 finally{clearTimeout(timer);init.signal?.removeEventListener('abort',abort)}
}
