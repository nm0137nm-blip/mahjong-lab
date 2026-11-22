import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {makeArithmeticFixture,verifyConditionalProof,PROOF_VERSION} from '../../src/coach/v14-evidence-proof-v2.mjs';
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const clone=x=>structuredClone(x);
const inputPath=process.env.V14_STAGE1;
const fixtures=inputPath?JSON.parse(fs.readFileSync(inputPath,'utf8')):[];
function synthetic(){
 const input={version:'v14-pilot-calculated-1',id:'pilot-00',phase:'turn',actions:[{key:'a0-0',group:0,detail:'m1'},{key:'a1-0',group:1,detail:'m2'}],evidence:[
 {id:'board',kind:'public_record',value:{ownSeat:0}},
 {id:'calc-a0-0',kind:'calculated',value:{shanten:1,ukeireUpperBound:11,retainedDoraHan:1}},
 {id:'calc-a1-0',kind:'calculated',value:{shanten:2,ukeireUpperBound:15,retainedDoraHan:2}},
 {id:'public-value-1',kind:'calculated',value:{riichi:true,meldCount:0,exposedDoraHan:0,exposedYakuhaiHan:0,discardCount:9,points:30000,pointGapFromOwn:5000}},
 {id:'public-value-2',kind:'calculated',value:{riichi:false,meldCount:1,exposedDoraHan:1,exposedYakuhaiHan:1,discardCount:6,points:23000,pointGapFromOwn:-2000}},
 {id:'public-value-3',kind:'calculated',value:{riichi:false,meldCount:0,exposedDoraHan:0,exposedYakuhaiHan:0,discardCount:7,points:22000,pointGapFromOwn:-3000}}
 ]};
 const request={stage:'independent',input,system:'dev-only'};
 return {request,requestHash:sha(request)};
}
test('arithmetic positive accepted but tactical interpretation NOT certified',()=>{
 const e=synthetic(),p=makeArithmeticFixture(e),r=verifyConditionalProof(e,p);
 assert.equal(p.version,PROOF_VERSION);
 assert.equal(r.deterministicGate,'pass');
 for(const k of ['tacticalCausality','semanticExplanation','rolloutValue','expertLevel'])assert.equal(r[k],'not_certified');
});
test('invalid arithmetic, false observation, corrupt binding and unjustified conditions rejected',()=>{
 const e=synthetic(),p=makeArithmeticFixture(e);
 const attacks=[
  x=>x.comparisons[0].recommended++,
  x=>x.comparisons[0].alternative--,
  x=>x.comparisons[0].relation='same',
  x=>x.comparisons[0].metric='expectedValue',
  x=>x.comparisons[0].recommendedAfterCallDiscard='m9',
  x=>x.comparisons.push(x.comparisons[0]),
  x=>x.alternative=x.recommendation,
  x=>x.recommendation='a99-0',
  x=>x.opponentObservations[0].value=false,
  x=>x.opponentObservations[0].seat=0,
  x=>x.opponentObservations[0].field='opponentTenpaiProbability',
  x=>x.opponentObservations.push(x.opponentObservations[0]),
  x=>x.reversal.unknownFactors=[],
  x=>x.explanation='一般論',
  x=>x.requestHash='forged',
  x=>x.unverifiedRiskProbability=.5
 ];
 for(const f of attacks){const bad=clone(p);f(bad);assert.throws(()=>verifyConditionalProof(e,bad),/v2-proof/,String(f));}
 const badE=clone(e);badE.request.input.evidence[1].value.shanten=8;
 assert.throws(()=>verifyConditionalProof(badE,p),/tampered frozen input/);
});
test('seat-specific values reject stale text even after rebinding a swapped opponent',()=>{
 const e=synthetic(),p=makeArithmeticFixture(e);
 const seatSwapped=clone(p);
 seatSwapped.opponentObservations[0].seat=2;
 assert.throws(()=>verifyConditionalProof(e,seatSwapped),/false or mismatched opponent fact/);
 const changed=clone(e);
 const q=changed.request.input.evidence.find(x=>x.id==='public-value-1');
 q.value.riichi=false;
 changed.requestHash=sha(changed.request);
 const stale=clone(p);stale.requestHash=changed.requestHash;
 assert.throws(()=>verifyConditionalProof(changed,stale),/false or mismatched opponent fact/);
});
test('the checker cannot certify prose causality even if someone pads a generic statement with correct numbers',()=>{
 const e=synthetic(),p=makeArithmeticFixture(e);
 p.explanation='他家の速度と打点を見て臨機応変に判断しましょう。';
 const r=verifyConditionalProof(e,p);
 assert.equal(r.deterministicGate,'pass');
 assert.equal(r.semanticExplanation,'not_certified');
 assert.equal(r.tacticalCausality,'not_certified');
});
test('frozen 30 real development inputs each admits a known-good arithmetic fixture',()=>{
 if(!inputPath)return;
 assert.equal(fixtures.length,30);
 const ids=new Set();
 for(const e of fixtures){
  assert(!ids.has(e.request.input.id));ids.add(e.request.input.id);
  const proof=makeArithmeticFixture(e),r=verifyConditionalProof(e,proof);
  assert.equal(r.deterministicGate,'pass',e.request.input.id);
  assert(r.distinctCandidateMetrics>0);
 }
});
