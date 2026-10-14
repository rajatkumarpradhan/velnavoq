import {it,expect} from 'vitest';
import {requestTools,callRequest,requestCapabilities} from '../src/account-mcp-requests';
it('advertises only exact token-granted project scopes, never account creation as a project scope',()=>{
 const grant=['projects.create','project.read','files.read','patch.propose','schema.read','schema.propose'];
 for(const name of ['velnavoq.request_create_project','velnavoq.request_project_access']){
  const t=requestTools(grant).find(t=>t.name===name)!;
  const s=t.inputSchema.properties.scopes;
  expect(new Set(s.items.enum)).toEqual(new Set(grant.slice(1)));expect(s.minItems).toBe(1);expect(s.uniqueItems).toBe(true);expect(s.maxItems).toBe(5);
 }
 expect(requestTools(['project.read']).some(t=>t.name==='velnavoq.request_create_project')).toBe(false);
});
it('rejects the observed invented scope request before database effects, without widening grants',async()=>{
 const token={request_approvals:true,scopes:JSON.stringify(['projects.create','project.read','schema.propose'])};
 for(const scopes of [['project.create','qa.new-project','backend.typed-public-records'],['projects.create'],['release.publish']]){
  await expect(callRequest('velnavoq.request_create_project',{workspaceId:'synthetic',name:'Inventory QA',scopes},token,{} as any)).rejects.toMatchObject({status:400,code:'request_scope_denied'});
 }
});

it('read-only discovery explains authoritative effects and bounded unpublished default without fabricating grants',()=>{const c=requestCapabilities(['projects.create','project.read','schema.propose']);expect(c.requestableProjectScopes).toEqual(['project.read','schema.propose']);expect(c.scopeCatalog.find(x=>x.scope==='release.publish')?.requestable).toBe(false);expect(c.scopeCatalog.every(x=>x.effect)).toBe(true);expect(c.creationDefaults).toMatchObject({publication:'unpublished',source:'empty',backend:'none',autopilot:false});expect(c.accountCreation.scope).toBe('projects.create');expect(c.creationDefaults.notice).toContain('Private app-user data');expect(requestTools(['project.read'])[1]!.inputSchema.properties.scopes.description).toContain('Read granted project metadata');});

it('does not advertise impossible nonempty scope requests for a token with no granted project scopes',()=>{for(const grant of [[],['projects.create']])expect(requestTools(grant).map(t=>t.name)).toEqual(['velnavoq.list_access_targets','velnavoq.request_status']);});
