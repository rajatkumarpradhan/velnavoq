#!/usr/bin/env python3
import pathlib,sqlite3,tempfile,subprocess
schema=pathlib.Path('migrations/0001_control_plane.sql').read_text()
with tempfile.TemporaryDirectory() as t:
 src=pathlib.Path(t)/'original.db';backup=pathlib.Path(t)/'backup.db';restore=pathlib.Path(t)/'restored.db'
 c=sqlite3.connect(src);c.executescript(schema)
 c.execute("INSERT INTO users VALUES('local-test','backup@example.test','test-hash','test-salt',1)")
 c.execute("INSERT INTO workspaces VALUES('workspace','Backup workspace',1)")
 c.execute("INSERT INTO memberships VALUES('workspace','local-test','owner')")
 c.execute("INSERT INTO projects(id,workspace_id,name,created_at) VALUES('project','workspace','Persisted project',1)");c.commit();c.close()
 subprocess.run(['python3','scripts/backup-local.py',str(src),str(backup)],check=True)
 subprocess.run(['python3','scripts/backup-local.py',str(backup),str(restore)],check=True)
 a=sqlite3.connect(src);b=sqlite3.connect(restore)
 assert '\n'.join(a.iterdump())=='\n'.join(b.iterdump())
 assert b.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
 assert not b.execute('PRAGMA foreign_key_check').fetchall()
 assert (restore.stat().st_mode&0o777)==0o600
 a.close();b.close();print('Local backup/restore exact SQL dump, integrity, foreign keys and private file mode: PASS')
