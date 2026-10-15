import {ApiError} from './contracts';
import {hasSecret} from './coding-agent';
import {canonical} from './security';
import {backendContractIssues,BackendContractError} from './backend-contract';
export type PrivateAppSchema={version:2;dataClass:'non-sensitive';auth:{type:'email-password';sessions:'persistent'};tables:{name:string;fields:Record<string,'string'|'number'|'boolean'>;permissions:{read:'owner';create:'owner';update:'owner';delete:'owner'}}[]};
export type ManagedAppSchema={version:3;dataClass:'non-sensitive';auth:{type:'email-password';sessions:'persistent'};tables:{name:string;fields:Record<string,'string'|'number'|'boolean'>;permissions:{read:'owner'|'public'|'admin';create:'owner'|'public'|'admin';update:'owner'|'admin';delete:'owner'|'admin'}}[]};
export type AppSchema=PrivateAppSchema|ManagedAppSchema;
export function validateAppSchema(raw:unknown):AppSchema{
 const issues=backendContractIssues(raw);if(issues.length)throw new BackendContractError(issues);const b=raw as AppSchema;
 if(hasSecret(canonical(b.tables))||/patient|medical|diagnos|password|card_number|cvv|ssn|passport|api_key|access_token/i.test(canonical(b.tables)))throw new ApiError(400,'backend_sensitive_schema_denied');return JSON.parse(canonical(b));
}
