// P2a-v4 L3.5 PRE-LABEL original-shard public prefix re-encoder.
// Matches original archived paipu by public visible history only. All
// other players' concealed hands and future events are redacted. S42 labels
// are NOT read in this file. Invalid physical/public pairs are logged before
// any S42 grading; no selection by resulting Q labels.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {initSync} from '../../assets/mortal/encoder.js';
import {MortalMjaiBridge} from '../../src/mortal/mjai-bridge.mjs';
const [prelabelDir,devRoot,outDir]=process.argv.slice(2);
if(!prelabelDir||!devRoot||!outDir)throw Error('usage: prelabel-directory dev-root output-dir');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:JSON.stringify(x)).digest('hex');
const frozen=read(path.join(prelabelDir,'prelabel-manifest.json')),rawPairs=read(path.join(prelabelDir,'public-pairs.json')),origins=read(path.join(prelabelDir,'verifier-origin-map.json'));
assert.equal(frozen.publicPairHash,sha(rawPairs));
assert.equal(frozen.labelStatus,'UNSCORED_S42_NOT_YET_CALLED');
assert.equal(rawPairs.length,frozen.publicPairs);
const lineage=new Map(origins.map(x=>[x.shard,x]));assert.equal(lineage.size,frozen.selectedClusters);
const wasm=initSync({module:fs.readFileSync('assets/mortal/encoder_bg.wasm')});
fs.mkdirSync(outDir,{recursive:true});
const comparable=m=>{
 if(m.zimo)return {種類:'自摸',席:m.zimo.l};
 if(m.gangzimo)return {種類:'嶺上自摸',席:m.gangzimo.l};
 if(m.gang)return {種類:'槓',席:m.gang.l,面子:m.gang.m};
 if(m.kaigang)return {種類:'ドラ表示追加',牌:m.kaigang.baopai};
 if(m.fulou)return {種類:'副露',席:m.fulou.l,面子:m.fulou.m};
 if(m.dapai)return {種類:'打牌',席:m.dapai.l,牌:m.dapai.p.slice(0,2),
  ツモ切り:m.dapai.p.includes('_'),立直宣言:m.dapai.p.includes('*')};
 return null;
};
// The public snapshot moves the newly revealed dora ahead of the immediately
// following replacement draw; some archived original paipu records the two
// adjacent events in the reverse order. Compare *public* projections under
// this narrowly defined adjacent swap. Never reorder the original engine replay.
const publicComparableFromLog=log=>{
 const out=log.slice(1).map(comparable);
 for(let i=0;i<out.length-1;i++)if(
  out[i]?.種類==='嶺上自摸'&&out[i+1]?.種類==='ドラ表示追加'){
  [out[i],out[i+1]]=[out[i+1],out[i]];i++;
 }
 return out;
};
const redact=(msg,own)=>{
 if(msg.qipai)return {qipai:{...msg.qipai,shoupai:msg.qipai.shoupai.map((h,i)=>i===own?h:'')}};
 if(msg.zimo)return {zimo:{l:msg.zimo.l,p:msg.zimo.l===own?msg.zimo.p:''}};
 if(msg.gangzimo)return {gangzimo:{l:msg.gangzimo.l,p:msg.gangzimo.l===own?msg.gangzimo.p:''}};
 if(msg.gang)return {gang:{l:msg.gang.l,m:msg.gang.m}};
 if(msg.kaigang)return {kaigang:{baopai:msg.kaigang.baopai}};
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

const results=[],failures=[];
for(const [n,pair] of rawPairs.entries()){
 let pairId=pair.caseId;
 try{
  const p=lineage.get(pair.originCluster);
  assert(p&&p.originalDecisionId&&p.baselineRequestHash===pair.publicInput.baseline.requestHash);
  const current=pair.publicInput.baseline.request.input,
    other=pair.publicInput.variant.request.input,board=ev(current,'board'),
    changedBoard=ev(other,'board');
  const dir=path.join(devRoot,'p1-v2-dev-data-'+p.shard);
  assert.equal(read(path.join(dir,'manifest.json')).split,'development-only');
  const raw=read(path.join(dir,'public.json')).filter(x=>x.id===p.originalDecisionId);
  assert.equal(raw.length,1);
  assert.deepEqual(raw[0].scene.publicEvents,ev(current,'history'));
  assert.equal(sha(raw[0].scene.publicEvents),p.publicHistoryHash);
  const history=ev(current,'history'),archive=read(path.join(dir,'paipu.json'));
  const matches=archive.log.filter(log=>{
   const q=log[0].qipai;
   return q.zhuangfeng==='東南西北'.indexOf(board.round[0])&&
    q.jushu===Number(board.round[1])-1&&q.changbang===board.honba&&
    log.length>history.length&&
    JSON.stringify(publicComparableFromLog(log).slice(0,history.length))===JSON.stringify(history);
  });
  assert.equal(matches.length,1,'original archived visible-history prefix must be uniquely reconstructible');
  const prefix=matches[0].slice(0,1+history.length).map(m=>redact(m,board.ownSeat));
  const variant=structuredClone(prefix);
  const delta=[];
  for(let s=0;s<4;s++)delta[s]=changedBoard.scores[s].points-board.scores[s].points;
  const changedSeat=[0,1,2,3].find(s=>s!==board.ownSeat&&delta[s]!==0);
  assert(Number.isInteger(changedSeat));
  if(pair.intervention==='opp_riichi_removed'){
   const altered=variant.filter(m=>m.dapai?.l===changedSeat&&m.dapai.p.includes('*'));
   assert.equal(altered.length,1,'exactly one public opponent reach declaration to remove');
   altered[0].dapai.p=altered[0].dapai.p.replace('*','');
  }else{
   // Counterfactual PREVIOUS-ROUND point distribution, NOT a falsified
   // tile history and not a claim that this result occurred in archive.
   for(let s=0;s<4;s++)variant[0].qipai.defen[s]+=delta[s];
  }
  const expected=[...new Set(current.actions.map(x=>x.group))].sort((a,b)=>a-b);
  const altExpected=[...new Set(other.actions.map(x=>x.group))].sort((a,b)=>a-b);
  assert.deepEqual(expected,altExpected);
  const reference=read(path.join(dir,'reference.json')).filter(x=>x.id===p.originalDecisionId);
  assert.equal(reference.length,1);
  assert.equal(reference[0].q.length,46);
  const row={
   pair:n+1,pairCaseId:pairId,sourceCaseId:pair.sourceCaseId,
   sourceCluster:p.shard,kind:pair.intervention,changedSeat,
   baselineRequestHash:pair.publicInput.baseline.requestHash,
   variantRequestHash:pair.publicInput.variant.requestHash,
   originOriginalPublicHistoryHash:p.publicHistoryHash,
   originalVisibleHistoryVerified:true,
   modelInputOrigin:'archived_original_public_prefix_other_player_private_redacted',
   archiveBest:reference[0].best,archiveQ:reference[0].q,expected,variants:{}
  };
  for(const [variantId,sequence] of [['a',prefix],['b',variant]]){
   const encoded=encode(sequence,board.ownSeat,expected);
   const name='pair-'+String(n+1)+'-'+variantId+'.bin';
   fs.writeFileSync(path.join(outDir,name),encoded.obs);
   row.variants[variantId]={file:name,mask:encoded.mask,obsHash:sha(encoded.obs)};
  }
  results.push(row);
 }catch(error){
  failures.push({pairCaseId:pairId,sourceCluster:pair.originCluster,
   intervention:pair.intervention,reason:String(error).slice(0,250)});
 }
}
if(results.length<8)throw Error('insufficient original archive legal encoded pairs');
const manifest={
 version:'p2a-v4-l35-original-shard-S42-verifier-prelabel-encoded-1',
 pairPoolFrozenHash:frozen.publicPairHash,
 pairPoolSourceHash:frozen.sourceSetHash,
 selectionFrozenPreLabel:true,
 sourceClusterCount:new Set(results.map(x=>x.sourceCluster)).size,
 originalProposed:rawPairs.length,encoded:results.length,
 failures,rows:results,
 warning:['Source clusters, not variants, are independent','Original paipu visible prefix matched',
 'Both focal encoder group masks must match public legal choices',
 'Point-shift variants are hypothetical past-round points, not actually archived earlier game results',
 'No S42 Q values used to select scenarios or modify original source before scoring',
 'No hidden opponents or future results passed to S42 encoder',
 'L3.5 classification not yet measured']
};
fs.writeFileSync(path.join(outDir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('V4 L35 ENCODED PRE S42',JSON.stringify({
 proposed:manifest.originalProposed,legalPairs:manifest.encoded,
 sourceClusters:manifest.sourceClusterCount,excludedByPhysicalChecks:failures.length,
 firstFailures:failures.slice(0,5)
}));
