import {ApiError,type Env} from './contracts';
/** Conservative free-stack defaults. No existing account is removed or disabled. */
export function admissionLimits(env:Env){
 const bounded=(s:string|undefined,d:number,max:number)=>{if(s===undefined)return d;const n=Number(s);if(!Number.isSafeInteger(n)||n<1||n>max)throw new ApiError(503,'signup_admission_not_configured');return n};
 return {daily:bounded(env.SIGNUP_DAILY_LIMIT,100,10000),total:bounded(env.SIGNUP_TOTAL_LIMIT,1000,100000)};
}
export async function chargeSignup(env:Env){
 const {daily,total}=admissionLimits(env),window=Math.floor(Date.now()/86400000)*86400000;
 const r=await env.DB.prepare("INSERT INTO usage_counters(scope,scope_id,metric,window_start,count) VALUES('global','signup','attempt.day',?,1) ON CONFLICT(scope,scope_id,metric,window_start) DO UPDATE SET count=count+1 WHERE count<? RETURNING count").bind(window,daily).first<{count:number}>();
 if(!r)throw new ApiError(429,'signup_admission_exhausted');return total;
}
