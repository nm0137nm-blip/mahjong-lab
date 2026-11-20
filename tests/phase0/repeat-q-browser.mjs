// Test actual production worker in WebKit against original PyTorch Q arrays.
import {webkit,chromium} from 'playwright';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const refs=JSON.parse(readFileSync(process.argv[3],'utf8'));
const kind=process.argv[4];assert.ok(['webkit','chromium'].includes(kind));
const browser=await (kind==='webkit'?webkit:chromium).launch({headless:true});
const rows=[];
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:kind==='webkit',hasTouch:true,serviceWorkers:'block'});
 const page=await context.newPage();
 await page.route('**/audit-sandbox.html',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>S42 synthetic audit</title>'}));
 await page.route('**/audit-model.onnx',r=>r.fulfill({contentType:'application/octet-stream',path:process.argv[2]}));
 await page.goto('http://127.0.0.1:8765/audit-sandbox.html');
 await page.evaluate(async()=>{
   const w=new Worker('/src/mortal/mortal-worker.mjs',{type:'module'});
   let id=0;
   window.auditRequest=(packet,transfers)=>new Promise((resolve,reject)=>{
     const requestId=++id;
     const listener=({data})=>{if(data.id!==requestId)return;w.removeEventListener('message',listener);data.type==='error'?reject(Error(data.reason)):resolve(data);};
     w.addEventListener('message',listener);
     w.postMessage({...packet,id:requestId},transfers);
   });
   const model=await (await fetch('/audit-model.onnx')).arrayBuffer();
   const ready=await window.auditRequest({type:'init',model},[model]);
   if(ready.type!=='ready')throw Error('worker did not become ready');
 });
 let max=0,count=0;
 for(const ref of refs){
   const result=await page.evaluate(async raw=>{
     const bytes=Uint8Array.from(atob(raw),c=>c.charCodeAt(0));
     const obs=new Float32Array(bytes.buffer.slice(0,1012*34*4));
     const mask=bytes.slice(1012*34*4);
     return await window.auditRequest({type:'eval',obs,mask},[obs.buffer,mask.buffer]);
   },ref.raw);
   const best=ref.q.reduce((best,q,i)=>q!=null&&(best===-1||q>ref.q[best])?i:best,-1);
   rows.push({name:ref.name,eventIndex:ref.eventIndex,q:result.q.map((v,i)=>result.legal[i]?v:null),best:result.best});
   for(let i=0;i<46;i++){
     assert.equal(Boolean(result.legal[i]),ref.q[i]!=null,ref.name+' legal mask');
     if(ref.q[i]==null)continue;
     const delta=Math.abs(result.q[i]-ref.q[i]); assert.ok(delta<=1e-4,ref.name+' Q['+i+'] '+delta);
     count++;max=Math.max(max,delta);
   }
 }
 writeFileSync(process.argv[5],JSON.stringify({engine:kind,rows}));
 console.log(JSON.stringify({status:'PASS_PRODUCTION_WEBKIT_Q_PARITY',decisions:refs.length,legal_q_values:count,max_q_error:max}));
}finally{await browser.close();}
