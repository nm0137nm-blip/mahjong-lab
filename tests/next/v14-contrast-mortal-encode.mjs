// Verifier-only stage: reconstruct focal-observable prefix from development paipu.
// Never pass opponent concealed hands/draws or post-decision events to encoder.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {initSync} from '../../assets/mortal/encoder.js';
import {MortalMjaiBridge} from '../../src/mortal/mjai-bridge.mjs';
const [root,contrast,out]=process.argv.slice(2),pairs=JSON.parse(fs.readFileSync(contrast,'utf8')),w=initSync({module:fs.readFileSync('assets/mortal/encoder_bg.wasm')});
fs.mkdirSync(out,{recursive:true});const results=[];
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const redact=(msg,own)=>{if(msg.qipai)return {qipai:{...msg.qipai,shoupai:msg.qipai.shoupai.map((h,i)=>i===own?h:'')}};if(msg.zimo)return {zimo:{l:msg.zimo.l,p:msg.zimo.l===own?msg.zimo.p:''}};if(msg.dapai)return {dapai:{...msg.dapai}};throw Error('unsupported prefix event')};
function comparable(msg){if(msg.zimo)return {種類:'自摸',席:msg.zimo.l};if(msg.dapai){const {l,p}=msg.dapai;return {種類:'打牌',席:l,牌:p.slice(0,2),ツモ切り:p.includes('_'),立直宣言:p.includes('*')};}return null;}
function encode(prefix,own,expected){
 const b=new MortalMjaiBridge();let handle=0,ready=0;
 try{
  for(const msg of prefix){
   const packet=redact(msg,own);
   const r=b.receive(packet);
   if(r.reset){assert(!handle);handle=w.new_state(r.seat);assert(handle);}
   for(const ev of r.events){
    if(ev.type==='start_kyoku')assert(ev.tehais.every((h,i)=>i===r.seat?h.every(t=>t!=='?'):h.every(t=>t==='?')));
    if(ev.type==='tsumo'&&ev.actor!==b.seat)assert.equal(ev.pai,'?');
    const a=new TextEncoder().encode(JSON.stringify(ev)),p=w.alloc_bytes(a.length);
    try{new Uint8Array(w.memory.buffer,p,a.length).set(a);ready=w.apply_event(handle,p,a.length);assert(ready>=0);}finally{w.free_bytes(p,a.length);}
   }
  }
  assert.equal(ready,1);const obs=w.alloc_bytes(1012*34*4),mask=w.alloc_bytes(46);
  try{
   assert.equal(w.encode_state(handle,obs,mask),0);
   const m=Array.from(new Uint8Array(w.memory.buffer,mask,46)),legal=m.flatMap((v,i)=>v?[i]:[]);
   assert.deepEqual(legal,expected);return {obs:Buffer.from(new Uint8Array(w.memory.buffer,obs,1012*34*4).slice()),mask:m};
  }finally{w.free_bytes(obs,1012*34*4);w.free_bytes(mask,46);}
 }finally{if(handle)w.drop_state(handle);}
}
for(const [n,p] of pairs.entries()){
 const a=p.a.request.input,b=p.b.request.input,ev=a.evidence.find(x=>x.id==='history').value,board=a.evidence.find(x=>x.id==='board').value;
 const own=board.ownSeat,dir=path.join(root,'p1-v2-dev-data-'+p.lineage.shard),read=f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')),manifest=read('manifest.json');assert.equal(manifest.split,'development-only');
 const raw=read('public.json').filter(x=>x.id===p.lineage.decision);assert.equal(raw.length,1);assert.deepEqual(raw[0].scene.publicEvents,ev);
 const actual=read('paipu.json'),matches=actual.log.filter(log=>{
  const q=log[0].qipai;return q.zhuangfeng==='東南西北'.indexOf(board.round[0])&&q.jushu===Number(board.round[1])-1&&q.changbang===board.honba&&log.length>ev.length&&same(log.slice(1,1+ev.length).map(comparable),ev);
 });assert.equal(matches.length,1,'unique actual observable prefix');
 const prefix=matches[0].slice(0,1+ev.length).map(m=>redact(m,own));
 assert(prefix.at(-1).zimo?.l===own);
 const altered=structuredClone(prefix),changed=altered.filter(m=>m.dapai?.l===p.lineage.changedSeat&&m.dapai.p.includes('*'));assert.equal(changed.length,1);changed[0].dapai.p=changed[0].dapai.p.replace('*','');
 const expected=[...new Set(a.actions.map(x=>x.group))].sort((a,b)=>a-b);assert.deepEqual(expected,[...new Set(b.actions.map(x=>x.group))].sort((a,b)=>a-b));
 const ref=read('reference.json').filter(r=>r.id===p.lineage.decision);assert.equal(ref.length,1);
 const row={pair:n+1,archiveQ:ref[0].q,archiveBest:ref[0].best,expected,variants:{}};
 for(const [v,seq] of [['a',prefix],['b',altered]]){
  const enc=encode(seq,own,expected),name='pair-'+(n+1)+'-'+v+'.bin';fs.writeFileSync(path.join(out,name),enc.obs);
  row.variants[v]={file:name,mask:enc.mask,obsHash:createHash('sha256').update(enc.obs).digest('hex')};
 }
 results.push(row);
}
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(results,null,2));console.log('encoded',results.length,'paired public/focal prefixes');
