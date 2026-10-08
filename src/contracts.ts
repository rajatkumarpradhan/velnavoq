export interface Env { DB: D1Database; APP_ORIGIN: string; REGISTRATION_ENABLED: string; RUNTIME_ENABLED: string }
export type Role = 'owner' | 'editor' | 'viewer';
export interface Identity { userId: string; sessionHash: string; csrfHash: string }
export interface Bundle { stack: 'static-web-v1'; files: Record<string,string>; schema: never[]; permissions: string[] }
export interface Project { id: string; workspace_id: string; name: string; revision: number; release_digest: string | null; release_json: string | null; created_by: string | null }
export interface Proposal { id: string; project_id: string; base_revision: number; digest: string; bundle_json: string; status: 'pending'|'approved'|'rejected'; author_id: string }
export class ApiError extends Error { constructor(public status: number, public code: string) { super(code); } }
