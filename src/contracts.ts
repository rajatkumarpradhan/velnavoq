export interface Env { OBS_REQUEST_ID?: string; OBS_PROJECT_ID?: string; DEPLOY_TARGET?: import('./deployment-target').TargetBinding; DEPLOY_ORIGIN?: string; DEPLOY_MODE?: string; SECRET_STORE_KEY?: string; SECRET_STORE_KEY_VERSION?: string; AI?: import('./ai-adapters').WorkersBinding; AI_REPAIR_ENABLED?: string; QUOTA_FREEZE_AI?: string; DB: D1Database; APP_ORIGIN: string; REGISTRATION_ENABLED: string; RUNTIME_ENABLED: string }
export type Role = 'owner' | 'editor' | 'viewer';
export interface Identity { userId: string; sessionHash: string; csrfHash: string }
export interface Bundle { stack: 'static-web-v1'; files: Record<string,string>; schema: never[]; permissions: string[] }
export interface Project { id: string; workspace_id: string; name: string; revision: number; release_digest: string | null; release_json: string | null; created_by: string | null }
export interface Proposal { id: string; project_id: string; base_revision: number; digest: string; bundle_json: string; status: 'pending'|'approved'|'rejected'; author_id: string }
export class ApiError extends Error { constructor(public status: number, public code: string) { super(code); } }
