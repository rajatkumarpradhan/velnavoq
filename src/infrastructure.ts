/** Research-backed policy, not resource activation or proof of account entitlement. */
export const INFRASTRUCTURE = Object.freeze({
 reviewedOn:'2026-10-09',
 controlPlane:'cloudflare-workers-free', metadata:'d1',
 productionDeploymentEnabled:false,
 identity:Object.freeze({local:'password-session',production:'blocked-provider-not-configured',passwordOnPublicOrigin:false}),
 runtime:Object.freeze({enabled:false,reason:'no-verified-free-isolated-hosted-runner'}),
 cloud:Object.freeze({r2:false,durableObjects:false,queues:false,workersAI:false,aiGateway:false}),
 entitlementReference:Object.freeze({workerRequestsPerDay:100000,workerCpuMs:10,d1RowsReadPerDay:5000000,d1RowsWrittenPerDay:100000,d1BytesPerDatabase:500000000,queueOperationsPerDay:10000,queueRetentionHours:24,workersAiNeuronsPerDay:10000}),
 integrationPolicies:Object.freeze({mcpVersion:'2026-07-28',oauthPkce:'S256',tokenPassthrough:false,previewSameOrigin:false,aiCachePrivateCode:false,aiFallbackToPaidProvider:false,aiToolAutoExecute:false}),
 selectedStreaming:'sse-per-job-events',gitModel:'immutable-content-digests-with-optional-git-adapter',
} as const);
