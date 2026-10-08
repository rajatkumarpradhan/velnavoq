import type {Role} from './contracts';
export type Capability='read'|'propose'|'edit'|'run-job'|'cancel-own-job'|'approve'|'publish'|'rollback'|'manage-members'|'manage-secrets'|'delete';
const grants:Readonly<Record<Role,readonly Capability[]>>=Object.freeze({
 owner:['read','propose','edit','run-job','cancel-own-job','approve','publish','rollback','manage-members','manage-secrets','delete'],
 editor:['read','propose','edit','run-job','cancel-own-job'],viewer:['read']
});
/** Capability permission is necessary but never sufficient to activate an unavailable feature. */
export function can(role:Role,capability:Capability):boolean{return grants[role]?.includes(capability)??false;}
export interface ResourceScope{workspaceId:string;projectId:string;jobId:string}
export function runtimeKey(s:ResourceScope):string{
 for(const value of Object.values(s))if(!/^[a-zA-Z0-9-]{1,80}$/.test(value))throw new Error('invalid_scope');
 return `workspace:${s.workspaceId}:project:${s.projectId}:job:${s.jobId}`;
}
export type JobState='queued'|'running'|'succeeded'|'failed'|'cancelled'|'timed-out';
export const JOB_TRANSITIONS:Readonly<Record<JobState,readonly JobState[]>>=Object.freeze({queued:['running','cancelled','failed'],running:['succeeded','failed','cancelled','timed-out'],succeeded:[],failed:[],cancelled:[],'timed-out':[]});
export const RUNTIME_BOUNDARY=Object.freeze({enabled:false,controlPlaneSecrets:false,sharedTenantRuntime:false,outbound:'deny-by-default',packageInstall:'blocked',previewOnControlOrigin:false});
export function assertSeparatePreview(control:string,preview:string):void{
 const a=new URL(control),b=new URL(preview);if(b.protocol!=='https:'||a.origin===b.origin||b.username||b.password)throw new Error('unsafe_preview_origin');
}
/** Future external records. Interfaces establish ownership, not feature availability. */
export interface JobRecord extends ResourceScope {actorId:string;kind:'build'|'test'|'repair'|'deploy';state:JobState;sourceRevision:number;idempotencyKey:string;deadline:number}
export interface RuntimeRecord extends ResourceScope {runtimeId:string;state:'unavailable'|'starting'|'running'|'stopped'|'failed';credentialBindings:never[]}
export interface ArtifactRecord extends ResourceScope {artifactId:string;sourceDigest:string;contentDigest:string;trusted:false}
export interface ReleaseRecord {workspaceId:string;projectId:string;releaseId:string;artifactId:string;sourceDigest:string;approvedBy:string;state:'candidate'|'publishing'|'live'|'failed'|'rolled-back'}
export function assertArtifactJob(job:JobRecord,artifact:ArtifactRecord):void{
 if(job.workspaceId!==artifact.workspaceId||job.projectId!==artifact.projectId||job.jobId!==artifact.jobId)throw new Error('artifact_job_scope_mismatch');
}
