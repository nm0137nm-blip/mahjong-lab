import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {buildTradeoffWitness,verifyTradeoffWitness,scanTradeoffWitnesses} from '../../src/coach/v14-public-tradeoff-witness-v2.mjs';
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const clone=x=>structuredClone(x);
const es=process.env.V14_STAGE1?JSON.parse(fs.readFileSync(process.env.V14_STAGE1,'utf8')):[];
test('888 concrete safety-vs-shape tradeoffs are linked to public seat/river in 22 frozen dev scenes',()=>{
 if(!es.length)return;
 assert.equal(es.length,30);
 let n=0;const cases=new Set(),seats=new Set();
 for(const e of es){
  const ws=scanTradeoffWitnesses(e);
  for(const w of ws){
   const v=verifyTradeoffWitness(e,w);
   assert.equal(v.witnessVerified,true);
   assert.equal(v.tactic,'not_certified');
   assert.equal(v.conditionalRisk,'unknown');
   assert.equal(w.certified,'candidate_specific_factual_tradeoff_only');
   cases.add(e.request.input.id);seats.add(e.request.input.id+':'+w.seat);n++;
  }
 }
 assert.equal(n,888);assert.equal(cases.size,22);assert.equal(seats.size,58);
});
test('one real opponent-specific contrast shows the actual 9-copy public upper-bound sacrifice without claiming it is correct to fold',()=>{
 if(!es.length)return;
 const e=es.find(x=>x.request.input.id==='pilot-01');
 const w=buildTradeoffWitness(e,'a4-0','a3-0',0,'ukeireUpperBound');
 assert.equal(w.genbutsuValue,63);assert.equal(w.otherValue,72);
 assert.equal(w.evidence.actionGenbutsuToSeat,true);
 assert.equal(w.tactics,'not_certified');
 assert.equal(verifyTradeoffWitness(e,w).seatAsDecisionDriver,'not_certified');
 for(const mutation of [
  x=>x.genbutsuValue=72,
  x=>x.otherValue=63,
  x=>x.seat=2,
  x=>x.genbutsuAction=x.otherAction,
  x=>x.comparison='forced dangerous deal-in',
  x=>x.tactics='certified',
  x=>x.estimatedDealIn=.24
 ]){
  const f=clone(w);mutation(f);assert.throws(()=>verifyTradeoffWitness(e,f),/tradeoff-witness|seat-proof-v2/);
 }
});
test('rejects claims that non-genbutsu is safe, that safety has no cost, or that public probabilities are known',()=>{
 if(!es.length)return;
 const e=es.find(x=>x.request.input.id==='pilot-01');
 assert.throws(()=>buildTradeoffWitness(e,'a3-0','a4-0',0,'ukeireUpperBound'),/not a meaningful opponent-scoped/);
 assert.throws(()=>buildTradeoffWitness(e,'a4-0','a3-0',0,'shanten'),/does not sacrifice this measured/);
 assert.throws(()=>buildTradeoffWitness(e,'a4-0','a3-0',0,'dealInProbability'),/unsupported comparison metric/);
 const x=clone(e);
 x.request.input.evidence.find(r=>r.id==='calc-a4-0').value.safety.find(r=>r.seat===0).ownRiverGenbutsu=false;
 x.requestHash=sha(x.request);
 assert.throws(()=>buildTradeoffWitness(x,'a4-0','a3-0',0,'ukeireUpperBound'),/not a meaningful opponent-scoped|calculated genbutsu conflicts with actual public river/);
});
test('known-good numerical tradeoff still cannot certify generic prose as high-quality tactical coaching',()=>{
 if(!es.length)return;
 const e=es[0],w=scanTradeoffWitnesses(e)[0],r=verifyTradeoffWitness(e,w);
 assert(r.witnessVerified);
 assert.equal(r.tactic,'not_certified');
 assert.equal(r.seatAsDecisionDriver,'not_certified');
});
