#!/usr/bin/env python3
"""Part 25 restore drill. Builds a populated database from every migration, takes a backup with a manifest
(SHA-256 + per-table row counts), restores it into a fresh file, proves the copy matches, proves a corrupted
or tampered backup is REFUSED, and measures real elapsed time. Local only: no cloud account, no D1 token."""
import hashlib,json,pathlib,sqlite3,subprocess,tempfile,time,sys,shutil
M=sorted(pathlib.Path('migrations').glob('*.sql'))
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def counts(c):return {t:c.execute(f'SELECT count(*) FROM "{t}"').fetchone()[0] for (t,) in c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")}
def make_manifest(db,out):
    c=sqlite3.connect(f'file:{db}?mode=ro',uri=True);m={'format':'velnavoq-backup-manifest-v1','sha256':sha(db),'bytes':pathlib.Path(db).stat().st_size,'rows':counts(c),'migrations':[x.name for x in M]};c.close();pathlib.Path(out).write_text(json.dumps(m,indent=1,sort_keys=True))
def restore(backup,manifest,dest):
    """Refuses unless the backup matches its manifest and passes integrity checks. Returns restored path."""
    m=json.loads(pathlib.Path(manifest).read_text())
    if sha(backup)!=m['sha256']:raise SystemExit('REFUSED: backup digest does not match manifest')
    tmp=str(dest)+'.partial';shutil.copyfile(backup,tmp);c=sqlite3.connect(tmp)
    try:
        if c.execute('PRAGMA integrity_check').fetchone()[0]!='ok':raise SystemExit('REFUSED: integrity check failed')
        if c.execute('PRAGMA foreign_key_check').fetchall():raise SystemExit('REFUSED: foreign key check failed')
        if counts(c)!=m['rows']:raise SystemExit('REFUSED: row counts differ from manifest')
    except BaseException:
        c.close();pathlib.Path(tmp).unlink(missing_ok=True);raise
    c.close();pathlib.Path(tmp).replace(dest)
    pathlib.Path(dest).chmod(0o600);return dest
results=[]
def check(name,ok,extra=''):
    results.append(ok);print(('PASS ' if ok else 'FAIL ')+name+(' '+extra if extra else ''))
with tempfile.TemporaryDirectory() as t:
    t=pathlib.Path(t);src=t/'live.db';c=sqlite3.connect(src)
    for m in M:c.executescript(m.read_text())
    c.execute("INSERT INTO users VALUES('u1','drill@example.test','h','s',1)");c.execute("INSERT INTO workspaces VALUES('w1','Drill',1)");c.execute("INSERT INTO memberships VALUES('w1','u1','owner')")
    c.execute("INSERT INTO projects(id,workspace_id,name,created_at,created_by) VALUES('p1','w1','Drill project',1,'u1')")
    for i in range(1,4):
        b=json.dumps({'stack':'static-web-v1','files':{'index.html':f'<h1>v{i} \u0928\u092e\u0938\u094d\u0924\u0947</h1>'},'permissions':[],'schema':[]},ensure_ascii=False,separators=(',',':'),sort_keys=True)
        c.execute("INSERT INTO proposals(id,project_id,base_revision,digest,bundle_json,author_id,created_at) VALUES(?,?,?,?,?,'u1',1)",(f'q{i}','p1',i-1,hashlib.sha256(b.encode()).hexdigest(),b))
        c.execute("UPDATE proposals SET status='approved',approved_by='u1',decided_at=? WHERE id=?",(i,f'q{i}'))
    c.commit();assert c.execute('SELECT revision FROM projects').fetchone()[0]==3;c.close()
    backup=t/'backup.db';manifest=t/'backup.manifest.json'
    t0=time.perf_counter();subprocess.run(['python3','scripts/backup-local.py',str(src),str(backup)],check=True,capture_output=True);make_manifest(backup,manifest);t_backup=time.perf_counter()-t0
    check('backup written with manifest',manifest.exists() and json.loads(manifest.read_text())['rows']['source_revisions']==3,f'({t_backup*1000:.0f} ms)')
    t1=time.perf_counter();restored=restore(backup,manifest,t/'restored.db');t_restore=time.perf_counter()-t1
    a=sqlite3.connect(src);b=sqlite3.connect(restored)
    check('restored database is identical to the original (full dump compare)','\n'.join(a.iterdump())=='\n'.join(b.iterdump()),f'({t_restore*1000:.0f} ms)')
    check('restored data is usable: latest file content and revision read back',b.execute("SELECT content FROM file_versions WHERE version=3").fetchone()[0].startswith('<h1>v3')and b.execute('SELECT revision FROM projects').fetchone()[0]==3)
    b.execute("INSERT INTO proposals(id,project_id,base_revision,digest,bundle_json,author_id,created_at) VALUES('q4','p1',3,'d','{}','u1',9)");b.execute("UPDATE proposals SET status='approved',approved_by='u1',decided_at=9 WHERE id='q4'");check('restored database accepts new approved work (triggers survived)',b.execute('SELECT revision FROM projects').fetchone()[0]==4);b.commit();b.close();a.close()
    check('restore file permissions are 0600',(restored.stat().st_mode&0o777)==0o600)
    bad=t/'bad.db';shutil.copyfile(backup,bad);d=bytearray(bad.read_bytes());d[len(d)//2]^=0xFF;bad.write_bytes(bytes(d))
    try:restore(bad,manifest,t/'x1.db');check('corrupted backup is refused',False)
    except SystemExit as e:check('corrupted backup is refused',str(e).startswith('REFUSED'),'('+str(e)+')')
    m2=json.loads(manifest.read_text());m2['rows']['users']=99;(t/'m2.json').write_text(json.dumps(m2))
    try:restore(backup,t/'m2.json',t/'x2.db');check('manifest tamper is refused',False)
    except SystemExit as e:check('manifest tamper is refused',str(e).startswith('REFUSED'),'('+str(e)+')')
    check('refused restores left no partial database',not any(t.glob('x*')))
    try:subprocess.run(['python3','scripts/backup-local.py',str(src),str(backup)],check=True,capture_output=True);check('backup never overwrites an existing backup',False)
    except subprocess.CalledProcessError:check('backup never overwrites an existing backup',True)
    print(json.dumps({'measured_on':'this sandbox, tiny database','backup_ms':round(t_backup*1000),'restore_ms':round(t_restore*1000),'bytes':backup.stat().st_size}))
ok=all(results);print(f'DRILL {sum(results)}/{len(results)} passed');sys.exit(0 if ok else 1)
