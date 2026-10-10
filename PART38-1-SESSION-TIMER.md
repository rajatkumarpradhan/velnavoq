# Part38.1: Fix30day browser timer overflow

Confirmed root cause: navigation scheduled refresh with expiresAt*1000-Date.now().30days=2,592,000,000ms exceeds browser signed32-bit timeout max2,147,483,647ms. Browser fired almost immediately, refresh cleared user, repeated me/workspaces/renew/inbox, dashboard stuck loading. Server cookie was not the cause of this regression.

New session timer clamps each arm to max, recalculates remaining on fire, calls refresh only when actual expiry reached. Cleanup cancels timers and invalid expiry does not schedule. No shortening30day sessions. Existing session/approval features preserved; no migration beyond Part38 migration0029 if not already applied.

Actual browser-like password-signin regression with30day API expiry and counted requests over3seconds: before me44/workspaces41/renew41/inbox41 -> after me3 (StrictMode/initial anonymous), workspaces1,renew1,inbox1. Test failed on old source, passes new source. It asserts dashboard becomes signed-in, no loading message, bounded counts. Fixture APIs rather than production. Fake timer tests advance through max clamp to actual30day deadline and verify no early expiry, one fire/cancellation. Audited UI timers: other renewal6h, inbox<=120s, preview8s, worker hard/idle bounds and download URL revoke1s all below max; no other UI long-expiry timer found.

No server/UI approval permission changes. Build/test then control/UI deploy with normal bindings/signup. Test real sign-in and reopen with30day session, wait more than several seconds and verify no repeated auth requests. Don't claim production fixed before that check.
