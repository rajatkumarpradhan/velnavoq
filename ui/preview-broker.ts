/** Runs ONLY in authenticated controller UI. No cookie/CSRF/session value goes to guests or host. */
export class PreviewBroker {
 private csrf='';private active=0;private times:number[]=[];private chain:Promise<unknown>=Promise.resolve();private closed=false;
 constructor(private base:string,private expiresAt:number,private call:(path:string,init:RequestInit)=>Promise<any>){}
 close(){this.closed=true;this.csrf='';}
 async request(message:any){
  const route=message?.route,method=message?.method;
  if(typeof route!=='string'||typeof method!=='string'||!((['auth/me','auth/kdf','auth/login','auth/register','auth/logout'].includes(route)&&method===(route==='auth/me'?'GET':'POST'))||(/^data\/[a-z][a-z0-9_]{0,31}(?:\/[a-f0-9-]{36})?$/.test(route)&&['GET','POST','PUT','DELETE'].includes(method))))throw Error('preview_request_denied');
  if(JSON.stringify(message).length>4500)throw Error('preview_request_denied');
  const now=Date.now();this.times=this.times.filter(t=>t>now-60000);
  if(this.closed||now>=this.expiresAt)throw Error('preview_expired');
  if(this.active>=4||this.times.length>=60)throw Error('preview_bridge_rate_limited');
  this.times.push(now);this.active++;
  const work=this.chain.then(async()=>{if(this.closed||Date.now()>=this.expiresAt)throw Error('preview_expired');const response=await this.call(this.base,{method:'POST',headers:{...(this.csrf?{'x-app-csrf':this.csrf}:{})},body:JSON.stringify({route,method,...(message.payload===undefined?{}:{payload:message.payload})})});if(response.csrf)this.csrf=response.csrf;if(route==='auth/logout')this.csrf='';const {csrf,...safe}=response;return safe});
  this.chain=work.catch(()=>{});try{return await work}finally{this.active--}
 }
}
