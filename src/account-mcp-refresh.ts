import {ApiError,type Env} from './contracts';
import {canonical,digest,randomToken} from './security';
export const HOUR=3600000,DAY=24*HOUR;
export function newConsentDeadline(hours:unknown,now:number){
 if(hours===undefined||hours===1)return 0;
 if(hours!==24)throw new ApiError(400,'consent_lifetime_invalid');
 return now+DAY;
}
const response=(access:string,expires:number,scopes:string,refresh?:string,deadline?:number)=>Response.json({access_token:access,token_type:'Bearer',expires_in:Math.max(0,Math.floor((expires-Date.now())/1000)),scope:JSON.parse(scopes).join(' '),...(refresh?{refresh_token:refresh,refresh_token_expires_in:Math.max(0,Math.floor((deadline!-Date.now())/1000))}:{})},{headers:{'cache-control':'no-store','pragma':'no-cache'}});
export {response as accountTokenResponse};
export async function initialRefresh(env:Env,row:any,id:string,now:number){
 if(!row.renewable_until)return {statements:[] as D1PreparedStatement[],refresh:undefined as string|undefined};
 if(row.renewable_until<=now||row.renewable_until>now+DAY)throw new ApiError(400,'invalid_grant');
 const family=crypto.randomUUID(),refresh=randomToken();
 return {refresh,statements:[env.DB.prepare('INSERT INTO account_mcp_refresh_families(id,authorization_id,client_id,user_id,resource,scopes_json,grant_deadline_ms,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(family,id,row.client_id,row.user_id,new URL(env.APP_ORIGIN).origin+'/mcp',row.scopes,row.renewable_until,now),env.DB.prepare('INSERT INTO account_mcp_refresh_entries(token_hash,family_id,expires_at,created_at) VALUES(?,?,?,?)').bind(await digest(refresh),family,row.renewable_until,now)]};
}
async function revokeFamily(env:Env,id:string){await env.DB.prepare('UPDATE account_mcp_refresh_families SET revoked_at=? WHERE id=? AND revoked_at IS NULL').bind(Date.now(),id).run();}
export async function refreshAccount(env:Env,f:URLSearchParams){
 const fail=()=>{throw new ApiError(400,'invalid_grant')};
 if(!/^[a-f0-9]{64}$/.test(f.get('refresh_token')||''))return fail();
 const hash=await digest(f.get('refresh_token')!),now=Date.now();
 const row=await env.DB.prepare('SELECT e.consumed_at,e.expires_at refresh_expiry,f.*,t.revoked_at token_revoked,t.scopes token_scopes,c.expires_at client_expiry FROM account_mcp_refresh_entries e JOIN account_mcp_refresh_families f ON f.id=e.family_id JOIN account_mcp_tokens t ON t.id=f.authorization_id JOIN account_mcp_clients c ON c.id=f.client_id WHERE e.token_hash=?').bind(hash).first<any>();
 // Wrong clients/resources cannot revoke another client's authorization.
 if(!row||f.get('client_id')!==row.client_id||(f.has('resource')&&f.get('resource')!==row.resource))return fail();
 if(row.consumed_at!==null){await revokeFamily(env,row.id);return fail()}
 if(row.revoked_at!==null||row.token_revoked!==null||now>=row.grant_deadline_ms||now>=row.refresh_expiry||now>=row.client_expiry||row.token_scopes!==row.scopes_json)return fail();
 // No scope changes through refresh; a fresh owner consent is required instead.
 if(f.has('scope')&&canonical(f.get('scope')!.split(' ').sort())!==canonical((JSON.parse(row.scopes_json) as string[]).sort()))throw new ApiError(400,'invalid_scope');
 const access=randomToken(),refresh=randomToken(),expires=Math.min(now+HOUR,row.grant_deadline_ms),accessHash=await digest(access);
 const children=(await env.DB.prepare('SELECT g.*,t.scopes FROM account_mcp_projects g JOIN mcp_access_tokens t ON t.id=g.child_token_id JOIN mcp_clients c ON c.id=g.child_client_id WHERE g.token_id=? AND t.revoked_at IS NULL AND c.revoked_at IS NULL').bind(row.authorization_id).all<any>()).results;
 const statements=[
 // D1 batch is transactional. The predecessor UNIQUE key + insert guard elect one winner;
 // no access/child updates survive a lost concurrent rotation.
 env.DB.prepare('INSERT INTO account_mcp_refresh_entries(token_hash,family_id,predecessor_hash,expires_at,created_at) VALUES(?,?,?,?,?)').bind(await digest(refresh),row.id,hash,row.grant_deadline_ms,now),
 env.DB.prepare('UPDATE account_mcp_tokens SET token_hash=?,expires_at=? WHERE id=? AND revoked_at IS NULL').bind(accessHash,expires,row.authorization_id)
 ];
 for(const child of children){
  const derived=await digest((child.derivation?accessHash:access)+':'+child.project_id),nextId=crypto.randomUUID();
  // Child tokens are immutable. Mint a same-identity/same-scope successor, then revoke
  // the predecessor. A revoked child/client or removed ownership cannot be revived.
  statements.push(
   env.DB.prepare('INSERT INTO mcp_access_tokens(id,token_hash,client_id,project_id,user_id,issuer,audience,scopes,expires_at,created_at) SELECT ?,?,t.client_id,t.project_id,t.user_id,t.issuer,t.audience,t.scopes,?,? FROM mcp_access_tokens t JOIN mcp_clients c ON c.id=t.client_id WHERE t.id=? AND t.revoked_at IS NULL AND c.revoked_at IS NULL AND EXISTS(SELECT 1 FROM memberships m JOIN projects p ON p.workspace_id=m.workspace_id WHERE p.id=t.project_id AND m.user_id=t.user_id AND m.role=\'owner\')').bind(nextId,await digest(derived),expires,now,child.child_token_id),
   env.DB.prepare('UPDATE account_mcp_projects SET child_token_id=? WHERE token_id=? AND project_id=? AND child_token_id=? AND EXISTS(SELECT 1 FROM mcp_access_tokens WHERE id=?)').bind(nextId,row.authorization_id,child.project_id,child.child_token_id,nextId),
   env.DB.prepare('UPDATE mcp_access_tokens SET revoked_at=? WHERE id=? AND revoked_at IS NULL AND EXISTS(SELECT 1 FROM mcp_access_tokens WHERE id=?)').bind(now,child.child_token_id,nextId)
  );
 }
 try{await env.DB.batch(statements)}catch{
  const used=await env.DB.prepare('SELECT consumed_at FROM account_mcp_refresh_entries WHERE token_hash=?').bind(hash).first<any>();
  if(used?.consumed_at!==null&&used?.consumed_at!==undefined)await revokeFamily(env,row.id);
  return fail();
 }
 return response(access,expires,row.scopes_json,refresh,row.grant_deadline_ms);
}
export async function revokeAccount(env:Env,f:URLSearchParams){
 const hash=await digest(f.get('token')||''),now=Date.now();
 await env.DB.batch([
 env.DB.prepare('UPDATE account_mcp_tokens SET revoked_at=? WHERE token_hash=? AND client_id=? AND revoked_at IS NULL').bind(now,hash,f.get('client_id')),
 env.DB.prepare('UPDATE account_mcp_refresh_families SET revoked_at=? WHERE client_id=? AND revoked_at IS NULL AND id IN(SELECT family_id FROM account_mcp_refresh_entries WHERE token_hash=?)').bind(now,f.get('client_id'),hash)
 ]);
 return new Response(null,{status:200});
}
