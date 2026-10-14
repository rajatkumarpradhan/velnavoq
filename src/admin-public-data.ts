import {canonical,digest} from './security';
import {validateBackend,validateRow} from './project-backend';

// Service-binding RPC only. The controller authenticates the caller and requires
// the project's workspace owner before dispatching. Never exposed by target.fetch.
export async function adminPublicData(db:D1Database,projectId:string,table:string,operation:string,id:string|null,row:unknown){
 const b=await db.prepare('SELECT config_json,digest FROM target_backend_configs WHERE project_id=?').bind(projectId).first<{config_json:string;digest:string}>();
 if(!b||await digest(b.config_json)!==b.digest)throw Error('backend_not_active');
 const config=validateBackend(JSON.parse(b.config_json));
 if(config.version===2)throw Error('private_rows_no_owner_console_access');
 const t=config.tables.find(t=>t.name===table);if(!t)throw Error('table_not_found');
 if(operation==='list')return (await db.prepare('SELECT id,data_json FROM target_backend_rows WHERE project_id=? AND table_name=? ORDER BY id LIMIT 100').bind(projectId,table).all()).results;
 if(!['create','update','delete'].includes(operation))throw Error('operation_denied');
 // Owner management is independent of anonymous read/create permissions.
 const checked=operation==='delete'?null:validateRow(t,row);
 if(operation==='create'){
  const newId=crypto.randomUUID();
  const result=await db.prepare('INSERT INTO target_backend_rows SELECT ?,?,?,?,? WHERE (SELECT count(*) FROM target_backend_rows WHERE project_id=? AND table_name=?)<5000 AND EXISTS(SELECT 1 FROM target_backend_configs WHERE project_id=? AND digest=?)').bind(projectId,table,newId,canonical(checked),Date.now(),projectId,table,projectId,b.digest).run();
  if(!result.meta.changes)throw Error('backend_row_limit');return {id:newId};
 }
 if(!id||!/^[a-f0-9-]{36}$/.test(id))throw Error('row_id_required');
 const result=operation==='delete'
  ?await db.prepare('DELETE FROM target_backend_rows WHERE project_id=? AND table_name=? AND id=? AND EXISTS(SELECT 1 FROM target_backend_configs WHERE project_id=? AND digest=?)').bind(projectId,table,id,projectId,b.digest).run()
  :await db.prepare('UPDATE target_backend_rows SET data_json=? WHERE project_id=? AND table_name=? AND id=? AND EXISTS(SELECT 1 FROM target_backend_configs WHERE project_id=? AND digest=?)').bind(canonical(checked),projectId,table,id,projectId,b.digest).run();
 if(!result.meta.changes)throw Error('row_not_found');return {id,deleted:operation==='delete'};
}
