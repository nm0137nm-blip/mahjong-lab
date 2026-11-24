import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {buildV47Packet,verifyV47,receiveV47,explicitQuantity} from '../../src/coach/v14-minimal-v47.mjs';
import {createV3IndependentDevelopmentRequest} from '../../src/coach/v14-independent-request-v3.mjs';
import {createV46CompactDevelopmentPacket} from '../../src/coach/v14-compact-model-contract-v46.mjs';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const old=JSON.parse(fs.readFileSync(process.env.V14_FOLLOWUP_PUBLIC,'utf8'));
const natural=JSON.parse(fs.readFileSync(process.env.V46_SOURCE,'utf8'));
assert.equal(hash(old),'271b4a304ed86dc41be2e72766e2b5cc496966bdf8a0ce5a8d5a5d0334e6103a');
assert.equal(hash(natural),'529102d7db69fca9bef26d04adee2240a3b3cd20d6085238133b8934beda310c');
const exposed=['pilot-41','pilot-45','pilot-54','pilot-81'];
const make=raw=>{
 const e=createV3IndependentDevelopmentRequest(raw),p=buildV47Packet(e);
 const [a,b]=Object.keys(p.request.actions),s=[0,1,2,3].filter(x=>x!==p.request.facts['b:ownSeat']);
 const answer={recommendation:a,alternative:b,keyOpponent:s[0],explanation:'[['+a+':move]]と[['+b+':move]]を比較する試験用文。五筒と5索は牌名。東2局、7巡目。',
  opponents:Object.fromEntries(s.map(seat=>[seat,'[[s'+seat+':riichi]]を確認する試験用文。'])),
  flips:[{if:'[[s'+s[0]+':riichi]]が現状と異なる仮定なら対案に判断を傾ける。',then:b,seat:s[0]}]};
 return {e,p,answer,s};
};
test('numeric guard: quantified amounts rejected, normal tile/yaku/turn prose allowed',()=>{
 for(const t of ['3900点','３，９００点','5,800点','三千九百点','一万二千点','1万2000点','二翻','三十符','4枚','４％','80パーセント','一向聴','２シャンテン','二本場'])assert(explicitQuantity(t),t);
 for(const t of ['5筒','五萬','m5','東2局','7巡目','一盃口','三色','一方','満貫','点差を考える','席0','安全牌が多い'])assert(!explicitQuantity(t),t);
});
test('all 44 old public cases: synthetic contract only; no real answers or certification',()=>{
 const rows=[];
 for(const raw of [...old,...natural]){
  const {e,p,answer}=make(raw),result=verifyV47(e,p,answer);
  assert.equal(result.semanticCertified,false);
  assert.equal(result.verdict,'CONTRACT_PASS_SEMANTICS_UNASSESSED');
  const source=e.request.input.actions;
  for(const c of Object.values(p.choiceMap))assert(source.some(x=>x.key===c.key));
  for(const a of source){const c=e.request.input.evidence.find(x=>x.id==='calc-'+a.key).value;
   const mapped=Object.values(p.choiceMap).filter(v=>v.key===a.key);
   if(a.group>=38&&a.group<=41)assert.deepEqual(mapped.map(x=>x.afterCallDiscard),c.afterCallDiscards.map(x=>x.discard));else assert.deepEqual(mapped,[{key:a.key,afterCallDiscard:null}]);}
  assert(!JSON.stringify(p.request).includes('DECOY_NOT_ALLOWED'));
  const oldp=createV46CompactDevelopmentPacket(e);
  rows.push({id:p.request.caseId,v46Bytes:Buffer.byteLength(JSON.stringify(oldp.request)),v47Bytes:Buffer.byteLength(JSON.stringify(p.request)),v46Chars:JSON.stringify(oldp.request).length,v47Chars:JSON.stringify(p.request).length});
 }
 fs.mkdirSync('/tmp/v47-public',{recursive:true});
 const summary={cases:rows.length,bytesBefore:rows.reduce((s,x)=>s+x.v46Bytes,0),bytesAfter:rows.reduce((s,x)=>s+x.v47Bytes,0),charsBefore:rows.reduce((s,x)=>s+x.v46Chars,0),charsAfter:rows.reduce((s,x)=>s+x.v47Chars,0),rows,modelCalls:0,tokenCounts:'not measured'};
 fs.writeFileSync('/tmp/v47-public/size-audit.json',JSON.stringify(summary,null,2));console.log('V47_SIZE_AUDIT',JSON.stringify(summary));
});
test('fatal negatives, including candidate seat-specific safety and hypothetical settlement scope',()=>{
 const {e,p,answer,s}=make(natural[0]);const bad=[
 a=>a.recommendation='not-legal',a=>a.alternative=a.recommendation,a=>a.keyOpponent=99,
 a=>delete a.opponents[s[1]],a=>a.explanation+='[[fake:fact]]',a=>a.explanation+='[[broken',
 a=>a.explanation+='3900点',a=>a.opponents[s[0]]+='[[s'+s[1]+':riichi]]',
 a=>a.opponents[s[0]]='根拠なし',a=>a.flips[0].then=a.recommendation,a=>a.flips[0].then='illegal',
 a=>a.flips[0].seat=null,a=>a.flips[0].if+='五千八百点',a=>a.version='old'];
 const foreign=Object.keys(p.scope).find(k=>p.scope[k]===s[1]&&/:safe|:settle/.test(k));
 if(foreign)bad.push(a=>a.opponents[s[0]]+='[['+foreign+']]');
 for(const mutate of bad){const a=structuredClone(answer);mutate(a);assert.throws(()=>verifyV47(e,p,a));}
 const changed=structuredClone(p);changed.request.facts['b:remaining']=999;assert.throws(()=>verifyV47(e,changed,answer));
 assert.equal(receiveV47(e,p,'{',{packetHash:p.requestHash,status:'incomplete'}).verdict,'OPERATIONAL_INCOMPLETE');
 assert.equal(receiveV47(e,p,'{',{packetHash:p.requestHash,status:'completed'}).verdict,'FATAL_INVALID_JSON');
 assert.equal(receiveV47(e,p,JSON.stringify(answer),{packetHash:p.requestHash,status:'completed'}).verdict,'CONTRACT_PASS_SEMANTICS_UNASSESSED');
 assert.throws(()=>receiveV47(e,p,JSON.stringify(answer),{packetHash:'wrong',status:'completed'}));
});
test('free diagnostic packets only for four already model-exposed cases; no heldout prompt delivery',()=>{
 const rows=exposed.map(id=>{const raw=[...old,...natural].find(x=>x.request.input.id===id);assert(raw,id);return make(raw).p});
 for(const p of rows)fs.writeFileSync('/tmp/v47-public/'+p.request.caseId+'_question.json',JSON.stringify(p.request,null,2)+'\n');
 fs.writeFileSync('/tmp/v47-public/diagnostic-manifest.json',JSON.stringify(rows.map(p=>({caseId:p.request.caseId,requestHash:p.requestHash,sourceHash:p.sourceHash})),null,2));
});
