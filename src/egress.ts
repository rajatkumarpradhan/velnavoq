// Part 28: control-plane egress policy. Every outbound URL the server fetches is
// validated before the request is made. Deny by default: exact host allowlists per
// purpose, no IP literals, no userinfo, no non-default ports, https except a pinned
// localhost deployment target. The Workers AI binding runs in-process (no egress).
import {ApiError} from './contracts';
export type EgressPurpose='ai-provider'|'deployment-health';
const AI_PROVIDER_HOSTS:readonly string[]=Object.freeze(['api.openai.com']);
const BAD_HOSTS=new Set(['localhost','metadata.google.internal','metadata','169.254.169.254']);
function assertCleanUrl(u:URL):void{
 if(u.username||u.password||u.hash)throw new ApiError(403,'egress_denied');
 const h=u.hostname.toLowerCase();
 if(!h||/^\d+(?:\.\d+){3}$/.test(h)||h.includes(':')||BAD_HOSTS.has(h)||/\.(?:localhost|local|internal|test|invalid|example)$/.test(h))throw new ApiError(403,'egress_denied');
}
/** Validate an AI provider endpoint: https, exact allowlisted host, default port. */
export function assertAiProviderUrl(raw:string):URL{
 let u:URL;try{u=new URL(raw)}catch{throw new ApiError(403,'egress_denied')}
 if(u.protocol!=='https:'||u.port)throw new ApiError(403,'egress_denied');
 assertCleanUrl(u);
 if(!AI_PROVIDER_HOSTS.includes(u.hostname.toLowerCase()))throw new ApiError(403,'egress_denied');
 return u;
}
/** Validate a deployment health URL against the operator-pinned deploy origin only. */
export function assertDeploymentHealthUrl(raw:string,pinnedOrigin:string|undefined):URL{
 if(!pinnedOrigin)throw new ApiError(503,'egress_target_not_configured');
 let pinned:URL;try{pinned=new URL(pinnedOrigin)}catch{throw new ApiError(503,'egress_target_not_configured')}
 let u:URL;try{u=new URL(raw)}catch{throw new ApiError(403,'egress_denied')}
 if(u.origin!==pinned.origin)throw new ApiError(403,'egress_denied');
 const local=pinned.hostname==='localhost'||pinned.hostname==='127.0.0.1';
 if(!local){if(pinned.protocol!=='https:'||pinned.port)throw new ApiError(403,'egress_denied');assertCleanUrl(u)}
 return u;
}
