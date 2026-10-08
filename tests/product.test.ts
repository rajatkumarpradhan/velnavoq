import {it,expect} from 'vitest';
import {PRODUCT} from '../src/product';
it('product contract has only the new identity',()=>{expect(PRODUCT.name).toBe('Velnavoq');expect(PRODUCT.byline).toBe('by Drayvenn Lab');});
it('unavailable runtime is not labeled executable',()=>{expect(PRODUCT.firstStack.preview).toBe(false);expect(PRODUCT.firstStack.dependencyInstall).toBe(false);expect(PRODUCT.firstStack.deployment).toBe(false);expect(PRODUCT.firstStack.buildExecution).toBe(false);});
it('no-spend and sensitive-data boundaries are explicit',()=>{expect(PRODUCT.policies.spendingEnabled).toBe(false);expect(PRODUCT.policies.untrustedCodeInControlPlane).toBe(false);expect(PRODUCT.policies.healthPaymentIdentityData).toBe(false);});
it('contract and implementation limits agree',()=>{expect(PRODUCT.limits.maxFiles).toBe(50);expect(PRODUCT.limits.maxBundleBytes).toBe(500000);});
