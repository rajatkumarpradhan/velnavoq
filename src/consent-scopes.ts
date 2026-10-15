import {ApiError} from './contracts';
// The request stays the ceiling. Only the owner's explicit subset becomes authority.
// Omission preserves the legacy exact-consent API, never adds to its requested ceiling.
export function consentScopeSubset(requested:string[],value:unknown):string[]{
 const selected=value===undefined?requested:value;
 if(!Array.isArray(selected)||!selected.length||new Set(selected).size!==selected.length||selected.some(s=>typeof s!=='string'||!requested.includes(s)))throw new ApiError(400,'consent_scope_subset_required');
 return requested.filter(s=>selected.includes(s));
}
