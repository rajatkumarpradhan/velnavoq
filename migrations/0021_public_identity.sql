-- Part 29: public identity. New accounts derive their password verifier in the browser (PBKDF2-SHA256, 600k)
-- so the Workers Free 10 ms CPU limit never has to run a password KDF. The server stores only a SHA-256
-- of that already-stretched verifier in users.password_hash. A row here marks an account as client-derived;
-- accounts without a row are legacy server-side PBKDF2 (localhost reference identity only).
CREATE TABLE user_kdf(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,kdf TEXT NOT NULL);
CREATE TABLE auth_config(key TEXT PRIMARY KEY,value TEXT NOT NULL);
