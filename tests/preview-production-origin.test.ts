import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync('preview-host/index.html','utf8').match(/<script>([\s\S]+)<\/script>/)![1]!;
function probe(origin:string,nonce='a'.repeat(48),sameOpener=true,ports=1){
 let listener:(e:any)=>void=()=>{};const received:any[]=[];const opener={postMessage:()=>{}};
 const element=()=>({textContent:'',onclick:null,append:()=>{}});
 const context={location:{hash:'#'+'a'.repeat(48),pathname:'/'},history:{replaceState:()=>{}},window:{opener,addEventListener:(kind:string,cb:any)=>{if(kind==='message')listener=cb}},document:{getElementById:element},setTimeout:()=>0,setInterval:()=>0,clearTimeout:()=>{},clearInterval:()=>{},Date};
 vm.runInNewContext(source,context);
 const port={postMessage:(message:any)=>received.push(message),start:()=>{}};
 listener({source:sameOpener?opener:{},origin,data:{kind:'velnavoq-preview-connect',nonce},ports:Array(ports).fill(port)});
 return received;
}
it.each(['http://localhost:5173','http://127.0.0.1:5173','https://velnavoq-control.rajatkumarpradhan021.workers.dev'])('accepts only configured trusted opener %s',origin=>expect(probe(origin)[0]?.state).toBe('connected'));
it.each(['https://evil.example','https://velnavoq-control.rajatkumarpradhan021.workers.dev.evil.example','http://velnavoq-control.rajatkumarpradhan021.workers.dev','https://other.workers.dev','http://localhost:5174','null'])('rejects wrong origin %s',origin=>expect(probe(origin)).toEqual([]));
it('preserves nonce, exact opener and one private port checks',()=>{const origin='https://velnavoq-control.rajatkumarpradhan021.workers.dev';expect(probe(origin,'wrong')).toEqual([]);expect(probe(origin,undefined,false)).toEqual([]);expect(probe(origin,undefined,true,0)).toEqual([]);expect(probe(origin,undefined,true,2)).toEqual([])});
