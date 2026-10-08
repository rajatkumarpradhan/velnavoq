#!/usr/bin/env python3
"""Populated-schema upgrade, consistent local backup and isolated restore proof. No cloud account."""
import pathlib,sqlite3,tempfile,subprocess,json,hashlib
migrations=sorted(pathlib.Path('migrations').glob('*.sql'))
with tempfile.TemporaryDirectory() as t:
 src=pathlib.Path(t)/'original.db';backup=pathlib.Path(t)/'backup.db';restore=pathlib.Path(t)/'restored.db';export=pathlib.Path(t)/'export.sql';sql_restore=pathlib.Path(t)/'sql-restored.db'
 c=sqlite3.connect(src)
 # Upgrade an already populated Part 5 database, not merely create empty tables.
 for migration in migrations[:3]:c.executescript(migration.read_text())
 c.execute("INSERT INTO users VALUES('local-test','backup@example.test','test-hash','test-salt',1)")
 c.execute("INSERT INTO workspaces VALUES('workspace','Backup workspace',1)")
 c.execute("INSERT INTO memberships VALUES('workspace','local-test','owner')")
 c.execute("INSERT INTO projects(id,workspace_id,name,created_at,created_by) VALUES('project','workspace','Persisted project',1,'local-test')")
 bundle=json.dumps({'stack':'static-web-v1','files':{'index.html':'<h1>नमस्ते</h1>','old.txt':'historical'},'permissions':[],'schema':[]},ensure_ascii=False,separators=(',',':'),sort_keys=True);digest=hashlib.sha256(bundle.encode()).hexdigest()
 c.execute("INSERT INTO proposals(id,project_id,base_revision,digest,bundle_json,author_id,created_at) VALUES('proposal','project',0,?,?,'local-test',1)",(digest,bundle))
 c.execute("UPDATE proposals SET status='approved',approved_by='local-test',decided_at=2 WHERE id='proposal'")
 c.executescript(migrations[3].read_text())
 assert c.execute('SELECT count(*) FROM file_versions').fetchone()[0]==2
 # Relationships only: lifecycle metadata is not evidence that a runner or deploy exists.
 c.execute("INSERT INTO jobs VALUES('job','project',1,'local-test','schema-restore-test','queued',3)")
 c.execute("INSERT INTO job_events VALUES('job',1,'queued','test metadata',3)")
 c.execute("INSERT INTO artifacts VALUES('artifact','project','job','test/object-key','test-digest',100,3)")
 c.execute("INSERT INTO releases VALUES('release','project','artifact','local-test',3)")
 c.execute("INSERT INTO deployments VALUES('deployment','project','release','test-only','pending',3)")
 c.execute("INSERT INTO environment_variables VALUES('project','PUBLIC_LABEL','test','non-secret',3)")
 c.execute("INSERT INTO secrets_metadata VALUES('secret','project','TEST_SECRET','test','reference-only',NULL,3)")
 c.execute("INSERT INTO mcp_connections VALUES('mcp','project','https://example.test','reference-only','pending',3)")
 c.execute("INSERT INTO mcp_permissions VALUES('mcp','read','read','local-test',9999999999)");c.commit()
 assert not c.execute('PRAGMA foreign_key_check').fetchall();c.close()
 subprocess.run(['python3','scripts/backup-local.py',str(src),str(backup)],check=True)
 subprocess.run(['python3','scripts/backup-local.py',str(backup),str(restore)],check=True)
 a=sqlite3.connect(src);b=sqlite3.connect(restore)
 assert '\n'.join(a.iterdump())=='\n'.join(b.iterdump())
 assert b.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
 assert not b.execute('PRAGMA foreign_key_check').fetchall();assert (restore.stat().st_mode&0o777)==0o600
 # SQL export/re-import in isolation and compare every table, index and trigger.
 sql='\n'.join(a.iterdump());export.write_text(sql);export.chmod(0o600)
 d=sqlite3.connect(sql_restore);d.executescript(sql);assert '\n'.join(a.iterdump())=='\n'.join(d.iterdump());assert not d.execute('PRAGMA foreign_key_check').fetchall()
 # Restored constraints and deletion graph still execute.
 d.execute('PRAGMA foreign_keys=ON')
 try:d.execute("UPDATE file_versions SET content='tamper'");raise AssertionError('immutable source bypass')
 except sqlite3.IntegrityError:pass
 try:d.execute("DELETE FROM memberships WHERE user_id='local-test'");raise AssertionError('last owner bypass')
 except sqlite3.IntegrityError:pass
 d.execute("DELETE FROM projects WHERE id='project'")
 for table in ['project_versions','files','file_versions','jobs','job_events','artifacts','approvals','proposals','source_revisions','releases','deployments','environment_variables','secrets_metadata','mcp_connections','mcp_permissions']:
  assert d.execute('SELECT count(*) FROM '+table).fetchone()[0]==0,table
 assert not d.execute('PRAGMA foreign_key_check').fetchall()
 a.close();b.close();d.close();print('PASS: populated migration upgrade, exact binary and SQL restore, integrity/FKs, private mode, restored triggers and full deletion graph')
