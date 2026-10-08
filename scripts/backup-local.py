#!/usr/bin/env python3
"""Local SQLite backup and verification. No cloud credentials or production access."""
import argparse,hashlib,pathlib,sqlite3,sys
p=argparse.ArgumentParser();p.add_argument('source');p.add_argument('destination');args=p.parse_args()
source=pathlib.Path(args.source).resolve();dest=pathlib.Path(args.destination).resolve()
if not source.is_file() or dest.exists() or source==dest:sys.exit('Source must exist and destination must not exist.')
src=sqlite3.connect(f'file:{source}?mode=ro',uri=True);out=sqlite3.connect(dest)
try:
 src.backup(out)
 if out.execute('PRAGMA integrity_check').fetchone()[0]!='ok':raise RuntimeError('integrity check failed')
 if out.execute('PRAGMA foreign_key_check').fetchall():raise RuntimeError('foreign key check failed')
finally:out.close();src.close()
# Account/session data may be sensitive: restrict local output and keep it outside source control.
dest.chmod(0o600)
print('Backup verified. SHA256:',hashlib.sha256(dest.read_bytes()).hexdigest())
