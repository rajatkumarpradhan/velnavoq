import {it,expect} from 'vitest';
import {INFRASTRUCTURE as I} from '../src/infrastructure';
it('free reference caps are explicit without activating paid services',()=>{expect(I.entitlementReference.workerCpuMs).toBe(10);expect(I.entitlementReference.queueRetentionHours).toBe(24);expect(Object.values(I.cloud).every(x=>x===false)).toBe(true);expect(I.productionDeploymentEnabled).toBe(false);});
it('no production auth or runtime claims without verified provider',()=>{expect(I.identity.passwordOnPublicOrigin).toBe(false);expect(I.runtime.enabled).toBe(false);});
it('current protocol and security constraints are explicit',()=>{expect(I.integrationPolicies.mcpVersion).toBe('2026-07-28');expect(I.integrationPolicies.oauthPkce).toBe('S256');expect(I.integrationPolicies.tokenPassthrough).toBe(false);expect(I.integrationPolicies.previewSameOrigin).toBe(false);});
it('inference fallbacks cannot silently spend or execute tool requests',()=>{expect(I.integrationPolicies.aiFallbackToPaidProvider).toBe(false);expect(I.integrationPolicies.aiToolAutoExecute).toBe(false);expect(I.integrationPolicies.aiCachePrivateCode).toBe(false);});
