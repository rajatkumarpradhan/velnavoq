/** Product contract only. Flags describe actual availability, never UI-simulated success. */
export const PRODUCT = Object.freeze({
 id:'velnavoq', name:'Velnavoq', byline:'by Drayvenn Lab', phase:'connector-rebuild-r1',
 audience:'Invited university students and individual web builders',
 firstStack:Object.freeze({id:'static-web-v1',language:'HTML/CSS/JavaScript',sourceStorage:true,dependencyInstall:false,buildExecution:true,preview:'requires-separate-host',deployment:'requires-configured-target-and-health',runtimeDecision:'static-web-v1-fixed-typed-data-api-no-arbitrary-server-runtime'}),
 capabilities:Object.freeze({workspaces:true,projects:true,sessions:true,sourceProposals:true,atomicApproval:true,ai:'requires-free-provider-binding',mcp:true,oauth:true,terminal:true,hosting:'requires-configured-target',remoteBackup:false}),
 backend:Object.freeze({kind:'fixed-typed-d1',privateAppUsers:false,arbitraryFunctions:false,sensitiveData:false}),
 sessions:Object.freeze({persistent:true,lifetimeDays:365,idleSignout:false}),
 limits:Object.freeze({maxBundleBytes:500000,maxFiles:50,maxPathCharacters:160,maxNameCharacters:100}),
 policies:Object.freeze({publicSignup:false,untrustedCodeInControlPlane:false,spendingEnabled:false,healthPaymentIdentityData:false,universalFrameworkSupport:false})
} as const);
