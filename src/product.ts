/** Product contract only. Flags describe actual availability, never UI-simulated success. */
export const PRODUCT = Object.freeze({
 id:'velnavoq', name:'Velnavoq', byline:'by Drayvenn Lab', phase:'local-p0',
 audience:'Invited university students and individual web builders',
 firstStack:Object.freeze({id:'static-web-v1',language:'HTML/CSS/JavaScript',sourceStorage:true,dependencyInstall:false,buildExecution:true,preview:false,deployment:false,runtimeDecision:'free-browser-static-build-unverified-no-hosted-runtime'}),
 capabilities:Object.freeze({workspaces:true,projects:true,sessions:true,sourceProposals:true,atomicApproval:true,ai:false,mcp:true,oauth:true,terminal:true,hosting:false,remoteBackup:false}),
 limits:Object.freeze({maxBundleBytes:500000,maxFiles:50,maxPathCharacters:160,maxNameCharacters:100}),
 policies:Object.freeze({publicSignup:false,untrustedCodeInControlPlane:false,spendingEnabled:false,healthPaymentIdentityData:false,universalFrameworkSupport:false})
} as const);
