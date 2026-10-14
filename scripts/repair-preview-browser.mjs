import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
const output='../evidence';mkdirSync(output,{recursive:true});
const origin='http://127.0.0.1:5208',host='http://127.0.0.1:5209/';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5208','--strictPort'],{env:{...process.env,VITE_PREVIEW_HOST:host},stdio:'ignore'});
let browser;const results=[];
const check=(name,value)=>{results.push({name,passed:!!value});if(!value)throw Error(name)};
try{
 for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 // Read-only live checks: no login, writes, accounts, or injected API success.
 for(const width of [360,390,412,1440]){
  const c=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'});const p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
  const r=await p.goto('https://velnavoq-control.rajatkumarpradhan021.workers.dev/');await p.locator('main h1').first().waitFor();await p.waitForTimeout(300);
  check('live landing HTTP 200 '+width,r.status()===200);check('live no horizontal overflow '+width,await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const a=await new AxeBuilder({page:p}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();results.push({name:'live axe '+width,violations:a.violations.map(x=>({id:x.id,impact:x.impact,description:x.description})),passed:a.violations.length===0});
  check('live no JavaScript page errors '+width,errors.length===0);await p.screenshot({path:output+'/live-home-'+width+'.png',fullPage:true});
  writeFileSync(output+'/live-home-'+width+'.txt',await p.locator('main').innerText());await c.close();
 }
 // Explicit synthetic API fixture; tests actual patched React component and worker.
 const c=await browser.newContext({viewport:{width:390,height:844}});let reservation,release;let stopped=0;const requested=new Promise(r=>reservation=r);const released=new Promise(r=>release=r);
 await c.route(host+'**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Synthetic isolated host</title><h1>Waiting</h1>'}));
 await c.route(origin+'/api/**',async r=>{
  const path=new URL(r.request().url()).pathname,method=r.request().method();let data={};
  if(path==='/api/me')data={userId:'qa-user',email:'fixture@example.test',expiresAt:Math.floor(Date.now()/1000)+86400};
  else if(path==='/api/workspaces')data=[{id:'w',name:'Synthetic QA workspace',role:'owner'}];
  else if(path==='/api/workspaces/w/projects')data=[{id:'p',name:'Synthetic QA project',revision:1}];
  else if(path==='/api/workspaces/w/activity')data=[];
  else if(path==='/api/approval-inbox')data={items:[],limited:false};
  else if(path.endsWith('/agent/context'))data={snapshot:{revision:1,sourceDigest:'digest'}};
  else if(path==='/api/projects/p/build'&&method==='GET')data={jobs:[{id:'job',status:'succeeded',revision:1,source_digest:'digest',finished_at:Date.now()}]};
  else if(path==='/api/projects/p/preview'&&method==='POST'){reservation();await released;data={id:'delayed-session',files:{'index.html':'<h1>Synthetic app</h1>'},expiresAt:Date.now()+60000}}
  else if(path==='/api/projects/p/preview/delayed-session/stop')stopped++;
  else if(path==='/api/auth/renew')data={expiresAt:Math.floor(Date.now()/1000)+86400};
  await r.fulfill({contentType:'application/json',body:JSON.stringify(data)});
 });
 const p=await c.newPage();await p.goto(origin+'/#preview?workspace=w&project=p');await p.getByRole('heading',{name:'Preview your website',exact:true}).waitFor();
 await p.getByRole('button',{name:'Preview website',exact:true}).click();await requested;
 check('preview button disabled during reservation',await p.getByRole('button',{name:'Preview website',exact:true}).isDisabled());
 await p.getByRole('button',{name:'Stop preview',exact:true}).click();release();
 for(let i=0;i<30&&stopped===0;i++)await p.waitForTimeout(50);
 check('late-created preview receives exactly one Stop',stopped===1);
 check('no preview popup remains after Stop',c.pages().length===1);
 await p.waitForTimeout(100);check('patched preview no overflow at 390',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const a=await new AxeBuilder({page:p}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();check('patched preview axe 390',a.violations.length===0);
 await p.screenshot({path:output+'/patched-preview-stop-390.png',fullPage:true});await c.close();
 console.log(JSON.stringify(results,null,2));
}finally{writeFileSync(output+'/browser-results.json',JSON.stringify(results,null,2));await browser?.close();server.kill('SIGTERM')}
