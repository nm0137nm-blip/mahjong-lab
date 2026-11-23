// Verifier-only reproducible S42 encoder preparation for NEW P2a-v3 paired
// development cases, sourced from already archived local development games.
// All opponent concealed hands and future draws are stripped BEFORE encoder
// ingestion. Never upload raw paipu, other-player hands or own-13 start hands.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {initSync} from '../../assets/mortal/encoder.js';
import {MortalMjaiBridge} from '../../src/mortal/mjai-bridge.mjs';
import {prepareV3DevelopmentCounterfactualPairs,prepareV3UnlabelledExpansionPairs} from '../../src/coach/v14-public-counterfactual-prep-v3.mjs';
const [frozenFile,lineageFile,devRoot,outDir]=process.argv.slice(2);
if(!frozenFile||!lineageFile||!devRoot||!outDir)throw Error('usage: frozen36 lineage dev-root out');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=x=>createHash('sha256').update(x).digest('hex');
const source=read(frozenFile),privateLineage=read(lineageFile),expanded=process.env.V14_PAIR_BATCH==='expansion';
const pairs=expanded?prepareV3UnlabelledExpansionPairs(source):prepareV3DevelopmentCounterfactualPairs(source);
const data=new Map(privateLineage.map(x=>[x.id,x]));assert.equal(data.size,36);
const wasm=initSync({module:fs.readFileSync('assets/mortal/encoder_bg.wasm')});
fs.mkdirSync(outDir,{recursive:true});
const comparable=m=>{
 if(m.zimo)return {種類:'自摸',席:m.zimo.l};
 if(m.fulou)return {種類:'副露',席:m.fulou.l,面子:m.fulou.m};
 if(m.dapai)return {種類:'打牌',席:m.dapai.l,牌:m.dapai.p.slice(0,2),
  ツモ切り:m.dapai.p.includes('_'),立直宣言:m.dapai.p.includes('*')};
 return null;
};
const redact=(msg,own)=>{
 if(msg.qipai)return {qipai:{...msg.qipai,shoupai:msg.qipai.shoupai.map((h,i)=>i===own?h:'')}};
 if(msg.zimo)return {zimo:{l:msg.zimo.l,p:msg.zimo.l===own?msg.zimo.p:''}};
 if(msg.fulou)return {fulou:{l:msg.fulou.l,m:msg.fulou.m}};
 if(msg.dapai)return {dapai:{...msg.dapai}};
 throw Error('unsupported original public prefix event, no attempt to encode');
};
const ev=(i,id)=>i.evidence.find(x=>x.id===id)?.value;
function encode(prefix,own,expected){
 const b=new MortalMjaiBridge();let handle=0,ready=0;
 try{
  for(const p of prefix){
   const msg=redact(p,own),r=b.receive(msg);
   if(r.reset){assert(!handle);handle=wasm.new_state(r.seat);assert(handle);}
   for(const event of r.events){
    if(event.type==='start_kyoku')assert(event.tehais.every((h,i)=>i===r.seat?
      h.every(x=>x!=='?'):h.every(x=>x==='?')));
    if(event.type==='tsumo'&&event.actor!==b.seat)assert.equal(event.pai,'?');
    const bytes=new TextEncoder().encode(JSON.stringify(event)),ptr=wasm.alloc_bytes(bytes.length);
    try{
     new Uint8Array(wasm.memory.buffer,ptr,bytes.length).set(bytes);
     ready=wasm.apply_event(handle,ptr,bytes.length);
     assert(ready>=0);
    }finally{wasm.free_bytes(ptr,bytes.length);}
   }
  }
  assert.equal(ready,1,'S42 encoder is not at focal decision');
  const obs=wasm.alloc_bytes(1012*34*4),mask=wasm.alloc_bytes(46);
  try{
   assert.equal(wasm.encode_state(handle,obs,mask),0);
   const masks=Array.from(new Uint8Array(wasm.memory.buffer,mask,46));
   const legal=masks.flatMap((v,i)=>v?[i]:[]);
   assert.deepEqual(legal,expected,'Mortal encoder action group mask diverges from frozen legal public mask');
   return {obs:Buffer.from(new Uint8Array(wasm.memory.buffer,obs,1012*34*4).slice()),mask:masks};
  }finally{wasm.free_bytes(obs,1012*34*4);wasm.free_bytes(mask,46);}
 }finally{if(handle)wasm.drop_state(handle);}
}
const results=[];
for(const [n,pair] of pairs.pairs.entries()){
 const p=privateLineage.find(x=>x.id===pair.sourceCaseId),current=pair.baseline.request.input,board=ev(current,'board');
 assert(p&&p.requestHash===source.find(x=>x.request.input.id===pair.sourceCaseId).requestHash);
 const dir=path.join(devRoot,'p1-v2-dev-data-'+p.shard);
 assert.equal(read(path.join(dir,'manifest.json')).split,'development-only');
 const raw=read(path.join(dir,'public.json')).filter(x=>x.id===p.decisionId);
 assert.equal(raw.length,1);assert.deepEqual(raw[0].scene.publicEvents,ev(current,'history'));
 const archive=read(path.join(dir,'paipu.json'));
 const history=ev(current,'history');
 const matches=archive.log.filter(log=>{
  const q=log[0].qipai;
  return q.zhuangfeng==='東南西北'.indexOf(board.round[0])&&
   q.jushu===Number(board.round[1])-1&&q.changbang===board.honba&&
   log.length>history.length&&
   JSON.stringify(log.slice(1,1+history.length).map(comparable))===JSON.stringify(history);
 });
 assert.equal(matches.length,1,'unique observable game prefix must be found');
 const prefix=matches[0].slice(0,1+history.length).map(m=>redact(m,board.ownSeat));
 // An identical physical point in the round, with only the declared public
 // intervention. This does not magically prove unobserved physical histories.
 const variant=structuredClone(prefix);
 if(pair.kind==='riichi_escrow'){
  const flagged=variant.filter(m=>m.dapai?.l===pair.changedSeat&&m.dapai.p.includes('*'));
  assert.equal(flagged.length,1,'exactly one reach declaration to remove');
  flagged[0].dapai.p=flagged[0].dapai.p.replace('*','');
 }else{
  const original=ev(pair.baseline.request.input,'board'),changed=ev(pair.alternative.request.input,'board');
  for(let s=0;s<4;s++)variant[0].qipai.defen[s]+=
   changed.scores[s].points-original.scores[s].points;
 }
 const expected=[...new Set(current.actions.map(x=>x.group))].sort((a,b)=>a-b),
  ref=read(path.join(dir,'reference.json')).filter(x=>x.id===p.decisionId);
 assert.equal(ref.length,1);
 const row={pair:n+1,sourceCaseId:pair.sourceCaseId,kind:pair.kind,changedSeat:pair.changedSeat,
  modelInputOrigin:'development_paipu_public_prefix_only_other_hands_redacted',
  baselineRequestHash:pair.baseline.requestHash,variantRequestHash:pair.alternative.requestHash,
  archiveBest:ref[0].best,archiveQ:ref[0].q,expected,variants:{}};
 for(const [v,seq] of [['a',prefix],['b',variant]]){
  const encoded=encode(seq,board.ownSeat,expected),name='pair-'+String(n+1)+'-'+v+'.bin';
  fs.writeFileSync(path.join(outDir,name),encoded.obs);
  row.variants[v]={file:name,mask:encoded.mask,obsHash:sha(encoded.obs)};
 }
 results.push(row);
}
fs.writeFileSync(path.join(outDir,'manifest.json'),JSON.stringify({
 version:expanded?'p2a-v3-unlabelled-expansion-s42-verifier-only-1':'p2a-v3-8-development-paired-s42-verifier-only-1',
 selectionFrozenPreLabel:true,sourceClusterCount:new Set(results.map(x=>x.sourceCaseId)).size,rows:results,
 selectionFrozenSourceHash:pairs.sourceFrozenHash,warning:pairs.notCertified},null,2)+'\n');
console.log('V3 PAIRED ENCODED',results.length,'public-only focal decisions; concealed other hands discarded');
