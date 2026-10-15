import {ApiError} from './contracts';
import {canonical,readBody} from './security';
import {validateRow} from './project-backend';
import type {AppSchema} from './app-schema';
/** Shared managed records. Only schema-declared public read/create is anonymous.
 * Account identity/roles are passed from the trusted runtime, never request data. */
export async function managedAppData(req:Request,db:D1Database,pid:string,route:string,schema:AppSchema,admin:boolean,rowLimit=5000):Promise<Response|null>{
 if(schema.version!==3)return null;
 const m=/^data\/([a-z][a-z0-9_]{0,31})(?:\/([a-f0-9-]{36}))?$/.exec(route);
 const table=schema.tables.find(t=>t.name===m?.[1]);if(!m||!table||table.permissions.read==='owner')return null;
 const id=m[2],op=req.method==='GET'?'read':req.method==='POST'&&!id?'create':req.method==='PUT'&&id?'update':req.method==='DELETE'&&id?'delete':null;
 if(!op)throw new ApiError(405,'method_denied');if(!admin&&table.permissions[op]!=='public')throw new ApiError(403,'app_admin_required');
 const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
 if(op==='read'){
  const u=new URL(req.url),after=u.searchParams.get('after')||'',limit=Number(u.searchParams.get('limit')||50);
  if(after&&!/^[a-f0-9-]{36}$/.test(after)||!Number.isInteger(limit)||limit<1||limit>100||[...u.searchParams.keys()].some(x=>!['after','limit'].includes(x)))throw new ApiError(400,'invalid_query');
  const statement=id?db.prepare('SELECT id,data_json,created_at FROM target_backend_rows WHERE project_id=? AND table_name=? AND id=?').bind(pid,table.name,id):db.prepare('SELECT id,data_json,created_at FROM target_backend_rows WHERE project_id=? AND table_name=? AND id>? ORDER BY id LIMIT ?').bind(pid,table.name,after,limit);const rows=(await statement.all()).results as any[];
  return json({rows:rows.map(r=>({id:r.id,...JSON.parse(r.data_json),createdAt:r.created_at})),next:rows.length===limit?rows.at(-1)?.id:null});
 }
 if(op==='delete'){const r=await db.prepare('DELETE FROM target_backend_rows WHERE project_id=? AND table_name=? AND id=?').bind(pid,table.name,id).run();if(!r.meta.changes)throw new ApiError(404,'not_found');return json({deleted:true})}
 const body=await readBody(req);if(new TextEncoder().encode(canonical(body)).length>4096)throw new ApiError(413,'app_body_too_large');const row=validateRow(table,body);
 if(op==='create'){const rid=crypto.randomUUID();const r=await db.prepare('INSERT INTO target_backend_rows SELECT ?,?,?,?,? WHERE (SELECT count(*) FROM target_backend_rows WHERE project_id=? AND table_name=?)<?').bind(pid,table.name,rid,canonical(row),Date.now(),pid,table.name,rowLimit).run();if(!r.meta.changes)throw new ApiError(409,'app_row_limit');return json({id:rid},201)}
 const r=await db.prepare('UPDATE target_backend_rows SET data_json=? WHERE project_id=? AND table_name=? AND id=?').bind(canonical(row),pid,table.name,id).run();if(!r.meta.changes)throw new ApiError(404,'not_found');return json({updated:true});
}
