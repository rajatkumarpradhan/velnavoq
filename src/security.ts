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
  if(path.length>160||path.startsWith('/')||path.includes('\\')||path.split('/').some(x=>!x||x==='.'||x==='..')||! /^[a-zA-Z0-9_./-]+\.(html|css|js|json|svg|txt)$/.test(path)||path.split('/').some(x=>x.startsWith('.'))||typeof content!=='string')throw new ApiError(400,'invalid_file_path_or_content');
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
 try { const b=JSON.parse(new TextDecoder().decode(bytes));if(!b||typeof b!=='object'||Array.isArray(b))throw 0;return b; }catch{throw new ApiError(400,'invalid_json');}
}
export function checkOrigin(req:Request,origin:string):void { if(req.headers.get('origin')!==origin)throw new ApiError(403,'origin_denied'); }
