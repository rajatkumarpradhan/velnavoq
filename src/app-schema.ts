import {ApiError} from './contracts';
import {hasSecret} from './coding-agent';
import {canonical,validateStructure} from './security';
export type AppSchema={version:2;dataClass:'non-sensitive';auth:{type:'email-password';sessions:'persistent'};tables:{name:string;fields:Record<string,'string'|'number'|'boolean'>;permissions:{read:'owner';create:'owner';update:'owner';delete:'owner'}}[]};
const ident=(x:unknown)=>typeof x==='string'&&/^[a-z][a-z0-9_]{0,31}$/.test(x)&&!['constructor','prototype','__proto__','id','project_id','user_id','owner_id'].includes(x);
export function validateAppSchema(raw:unknown):AppSchema{
 validateStructure(raw);const b=raw as AppSchema;
 if(!b||Object.keys(b).sort().join(',')!=='auth,dataClass,tables,version'||b.version!==2||b.dataClass!=='non-sensitive'||canonical(b.auth)!==canonical({type:'email-password',sessions:'persistent'})||!Array.isArray(b.tables)||!b.tables.length||b.tables.length>8||canonical(b).length>12000)throw new ApiError(400,'app_schema_invalid');
 const names=new Set<string>();for(const t of b.tables){if(!t||Object.keys(t).sort().join(',')!=='fields,name,permissions'||!ident(t.name)||names.has(t.name)||!t.fields||typeof t.fields!=='object'||Array.isArray(t.fields)||!Object.keys(t.fields).length||Object.keys(t.fields).length>12||Object.entries(t.fields).some(([k,v])=>!ident(k)||!['string','number','boolean'].includes(v))||canonical(t.permissions)!==canonical({read:'owner',create:'owner',update:'owner',delete:'owner'}))throw new ApiError(400,'app_schema_invalid');names.add(t.name)}
 if(hasSecret(canonical(b.tables))||/patient|medical|diagnos|password|card_number|cvv|ssn|passport|api_key|access_token/i.test(canonical(b.tables)))throw new ApiError(400,'backend_sensitive_schema_denied');return JSON.parse(canonical(b));
}
