import { ApiError, type Bundle } from './contracts';
const enc = new TextEncoder();
export const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b), n=>n.toString(16).padStart(2,'0')).join('');
export const randomToken = () => hex(crypto.getRandomValues(new Uint8Array(32)).buffer);
export const digest = async (v: string) => hex(await crypto.subtle.digest('SHA-256',enc.encode(v)));
export function constantEqual(a:string,b:string):boolean { let x=a.length^b.length; for(let i=0;i<Math.max(a.length,b.length);i++) x|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0); return x===0; }
export async function passwordHash(password:string,salt:string):Promise<string> {
 const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);
 return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(salt),iterations:600000,hash:'SHA-256'},key,256));
}
export function validatePassword(p:unknown):string { if(typeof p!=='string'||p.length<14||p.length>128) throw new ApiError(400,'password_length_14_to_128'); return p; }
export function validateName(n:unknown):string { if(typeof n!=='string'||!n.trim()||n.length>100) throw new ApiError(400,'invalid_name'); return n.trim(); }
export function validateEmail(e:unknown):string { if(typeof e!=='string'||e.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))throw new ApiError(400,'invalid_email'); return e.toLowerCase().trim(); }
export function canonical(v:unknown):string { if(v===null||typeof v!=='object')return JSON.stringify(v); if(Array.isArray(v))return '['+v.map(canonical).join(',')+']'; return '{'+Object.entries(v as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>JSON.stringify(k)+':'+canonical(x)).join(',')+'}'; }
export function validateBundle(raw:unknown):Bundle {
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new ApiError(400,'invalid_bundle');
 const b=raw as Record<string,unknown>;
 if(Object.keys(b).sort().join(',')!=='files,permissions,schema,stack'||b.stack!=='static-web-v1'||!Array.isArray(b.schema)||b.schema.length||!Array.isArray(b.permissions)||b.permissions.length)throw new ApiError(400,'unsupported_bundle_capabilities');
 if(!b.files||typeof b.files!=='object'||Array.isArray(b.files))throw new ApiError(400,'invalid_files');
 const files=b.files as Record<string,unknown>,entries=Object.entries(files);
 if(entries.length<1||entries.length>50||!Object.hasOwn(files,'index.html'))throw new ApiError(400,'invalid_file_count_or_entry');
 let total=0;
 for(const [path,content] of entries){
  if(path.split('/').some(x=>['__proto__','constructor','prototype'].includes(x))||path.length>160||path.startsWith('/')||path.includes('\\')||path.split('/').some(x=>!x||x==='.'||x==='..')||! /^[a-zA-Z0-9_./-]+\.(html|css|js|json|svg|txt)$/.test(path)||path.split('/').some(x=>x.startsWith('.'))||typeof content!=='string')throw new ApiError(400,'invalid_file_path_or_content');
  total+=enc.encode(content).byteLength;
 }
 if(total>500000)throw new ApiError(413,'bundle_too_large');
 return raw as Bundle;
}
export async function readBody(req:Request):Promise<Record<string,unknown>> {
 if(!(req.headers.get('content-type')||'').startsWith('application/json'))throw new ApiError(415,'json_required');
 if(Number(req.headers.get('content-length'))>550000)throw new ApiError(413,'body_too_large');
 const reader=req.body?.getReader(); if(!reader)throw new ApiError(400,'invalid_json'); const chunks:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>550000){await reader.cancel();throw new ApiError(413,'body_too_large');}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
 try { const b=JSON.parse(new TextDecoder('utf-8',{fatal:true,ignoreBOM:false}).decode(bytes));if(!b||typeof b!=='object'||Array.isArray(b))throw 0;validateStructure(b);return b; }catch(e){if(e instanceof ApiError)throw e;throw new ApiError(400,'invalid_json');}
}
export function checkOrigin(req:Request,origin:string):void { if(req.headers.get('origin')!==origin)throw new ApiError(403,'origin_denied'); }

/** Iterative validation before recursive canonicalization, secret checks or schema walks. */
export function validateStructure(value:unknown):void {
 const pending:{value:unknown;depth:number}[]=[{value,depth:0}];let nodes=0;
 while(pending.length){const item=pending.pop()!;if(++nodes>20000||item.depth>32)throw new ApiError(413,'json_complexity_limit');
 if(item.value&&typeof item.value==='object')for(const [key,v] of Object.entries(item.value)){
 if(['__proto__','constructor','prototype'].includes(key))throw new ApiError(400,'json_reserved_key');
 pending.push({value:v,depth:item.depth+1});}}
}
/** A duplicate credential cookie must never select an attacker-chosen first value. */
export function sessionToken(req:Request):string {
 const matches=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith('velnavoq_session='));
 if(matches.length!==1)throw new ApiError(401,'authentication_required');const token=matches[0]!.slice(17);
 if(!/^[0-9a-f]{64}$/.test(token))throw new ApiError(401,'authentication_required');return token;
}

/** Public target configuration is operator-owned; no user URL or arbitrary IP target. */
export function publicTarget(target:URL,control:URL):boolean {
 const h=target.hostname.toLowerCase();
 return target.protocol==='https:'&&h!==control.hostname.toLowerCase()&&h.includes('.')&&
 /^[a-z0-9.-]+$/.test(h)&&! /^\d+(?:\.\d+){3}$/.test(h)&&
 !['localhost','metadata.google.internal'].includes(h)&&! /\.(?:localhost|local|internal|test|invalid)$/.test(h)&&
 !target.port&&!target.username&&!target.password&&target.pathname==='/'&&!target.search&&!target.hash;
                                                                             }
