/** Product contract only. Flags describe actual availability, never UI-simulated success. */
export const PRODUCT = Object.freeze({
 id:'velnavoq', name:'Velnavoq', byline:'by Drayvenn Lab', phase:'local-p0',
 audience:'Invited university students and individual web builders',
 firstStack:Object.freeze({id:'static-web-v1',language:'HTML/CSS/JavaScript',sourceStorage:true,dependencyInstall:false,buildExecution:false,preview:false,deployment:false,runtimeDecision:'blocked-pending-free-isolated-runner'}),
 capabilities:Object.freeze({workspaces:true,projects:true,sessions:true,sourceProposals:true,atomicApproval:true,ai:false,mcp:false,oauth:false,terminal:false,hosting:false,remoteBackup:false}),
 limits:Object.freeze({maxBundleBytes:500000,maxFiles:50,maxPathCharacters:160,maxNameCharacters:100}),
 policies:Object.freeze({publicSignup:false,untrustedCodeInControlPlane:false,spendingEnabled:false,healthPaymentIdentityData:false,universalFrameworkSupport:false})
} as const);
