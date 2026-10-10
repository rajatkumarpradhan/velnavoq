-- Bound expiry cleanup scans for hashed request-rate counters.
CREATE INDEX rate_window ON rate_limits(window);
-- Updates cannot rewrite security events; DELETE remains available for retention/project erasure.
CREATE TRIGGER observation_event_no_update BEFORE UPDATE ON observation_events BEGIN SELECT RAISE(ABORT,'immutable_observation_event'); END;
