import {ApiError} from './contracts';
/** Called only behind authenticated project-owner controller or owner-only preview routes.
 * Emails are unverified; owner must recognize the account id, not trust its email claim.
 * Never read credentials, session cookies, or private rows. No self-promotion endpoint. */
export async function managedAppAccounts(db:D1Database,pid:string,operation:string,userId:string|null,role:string|null){
 if(operation==='list')return {accounts:(await db.prepare("SELECT u.id,u.email,CASE WHEN r.role='admin' THEN 'admin' ELSE 'user' END role FROM target_app_users u LEFT JOIN target_app_roles r ON r.project_id=u.project_id AND r.user_id=u.id WHERE u.project_id=? ORDER BY u.id LIMIT 100").bind(pid).all()).results,emailVerified:false,limit:100};
 if(operation!=='setRole'||!userId||!/^[a-f0-9-]{36}$/.test(userId)||!['user','admin'].includes(role||''))throw new ApiError(400,'app_role_request_invalid');
 if(!await db.prepare('SELECT id FROM target_app_users WHERE project_id=? AND id=?').bind(pid,userId).first())throw new ApiError(404,'app_user_not_found');
 if(role==='admin')await db.prepare("INSERT INTO target_app_roles VALUES(?,?,'admin',?) ON CONFLICT(project_id,user_id) DO NOTHING").bind(pid,userId,Date.now()).run();else await db.prepare('DELETE FROM target_app_roles WHERE project_id=? AND user_id=?').bind(pid,userId).run();
 return {userId,role};
}
