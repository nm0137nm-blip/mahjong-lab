import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createV3IndependentDevelopmentRequest} from '../../src/coach/v14-independent-request-v3.mjs';
import {createV3PublicContrastFixture} from '../../src/coach/v14-evidence-proof-v3.mjs';
import {verifyV4StrictPublicProof} from '../../src/coach/v14-public-proof-gate-v4.mjs';
const src=process.env.V14_FOLLOWUP_PUBLIC?JSON.parse(fs.readFileSync(process.env.V14_FOLLOWUP_PUBLIC,'utf8')):[];
function source(){
 const v=src.find(x=>x.request.input.id==='pilot-48');return v?createV3IndependentDevelopmentRequest(v):null;
}
function proof(envelope,left='a37-1',right='a13-0'){
 const obj=createV3PublicContrastFixture(envelope,{key:left,afterCallDiscard:null},{key:right,afterCallDiscard:null});
 const evidence=envelope.request.input.evidence;
 for(const s of [1,3]){
  const v=evidence.find(x=>x.id==='public-value-'+s).value;
  obj.opponentObservations.push({seat:s,field:'points',value:v.points,assessment:'not_established'});
 }
 return obj;
}
test('typed valid reach/dama difference and all 3 public seats accepted',()=>{
 const e=source();if(!e)return;
 const r=verifyV4StrictPublicProof(e,proof(e));
 assert.equal(r.gate,'pass');
 assert.deepEqual(r.seatsCovered,[0,1,3]);
 assert(r.distinctPublicFacts>=1);
});
test('actionKind missing fails even if numeric comparison differs',()=>{
 const e=source();if(!e)return;
 const p=proof(e);p.comparisons=p.comparisons.filter(x=>x.type!=='actionKind');
 assert.throws(()=>verifyV4StrictPublicProof(e,p),/exactly one actionKind/);
});
test('actionKind same only and no differentiating public fact must fail',()=>{
 const e=source();if(!e)return;
 const p=proof(e,'a13-0','a14-0');
 p.comparisons=p.comparisons.filter(x=>x.type==='actionKind');
 assert.equal(p.comparisons[0].relation,'same');
 assert.throws(()=>verifyV4StrictPublicProof(e,p),/one public difference/);
});
test('one opponent missing fails even though v3 total observations >0',()=>{
 const e=source();if(!e)return;
 const p=proof(e);
 p.opponentObservations=p.opponentObservations.filter(x=>x.seat!==3);
 assert.throws(()=>verifyV4StrictPublicProof(e,p),/exactly three opponents/);
});
test('four observations at one seat fails despite total observations <=9',()=>{
 const e=source();if(!e)return;
 const p=proof(e);
 const facts=e.request.input.evidence.find(x=>x.id==='public-value-0').value;
 for(const field of ['points','meldCount','exposedYakuhaiHan'])
  p.opponentObservations.push({seat:0,field,value:facts[field],assessment:'not_established'});
 assert(p.opponentObservations.length<=9);
 assert.throws(()=>verifyV4StrictPublicProof(e,p),/1-3 observations/);
});
test('underlying public mismatch cannot be bypassed by added v4 constraints',()=>{
 const e=source();if(!e)return;
 const p=proof(e);
 p.opponentObservations[0].value=999;
 assert.throws(()=>verifyV4StrictPublicProof(e,p),/v3-proof/);
});
