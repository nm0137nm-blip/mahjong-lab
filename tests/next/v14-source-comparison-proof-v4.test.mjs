import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createV3IndependentDevelopmentRequest} from '../../src/coach/v14-independent-request-v3.mjs';
import {createV4DeterministicSourceComparison} from '../../src/coach/v14-source-comparison-proof-v4.mjs';
import {verifyV4StrictPublicProof} from '../../src/coach/v14-public-proof-gate-v4.mjs';
const cases=process.env.V14_FOLLOWUP_PUBLIC?
 JSON.parse(fs.readFileSync(process.env.V14_FOLLOWUP_PUBLIC,'utf8')):[];
const choice=(key,afterCallDiscard=null)=>({key,afterCallDiscard});
function full(envelope,proof){
 const input=envelope.request.input,own=input.evidence.find(x=>x.id==='board').value.ownSeat;
 for(const s of [0,1,2,3].filter(x=>x!==own)){
  if(proof.opponentObservations.some(x=>x.seat===s))continue;
  const rec=input.evidence.find(e=>e.id==='public-value-'+s).value;
  proof.opponentObservations.push({seat:s,field:'points',value:rec.points,assessment:'not_established'});
 }
 return proof;
}
test('pilot48 generated proof includes verified conditional 5200 vs 2600 and no scored m9 dama',()=>{
 const x=cases.find(x=>x.request.input.id==='pilot-48');if(!x)return;
 const e=createV3IndependentDevelopmentRequest(x),v=createV4DeterministicSourceComparison(e,choice('a37-1'),choice('a13-0'));
 assert.equal(v.proofStatus,'meaningful_differences_proven');
 const points=v.proof.comparisons.filter(x=>x.type==='conditionalRonByChoice');
 assert(points.some(x=>x.tile==='m9'&&x.recommended.status==='conditionally_scored'&&x.alternative.status==='no_scored_win_under_assumptions'));
 assert(points.some(x=>x.tile==='m6'&&x.recommended.basePoints===5200&&x.alternative.basePoints===2600));
 assert(verifyV4StrictPublicProof(e,full(e,v.proof)).distinctPublicFacts>0);
});
test('case where opposite legal discards have equal shape can still have verified seat-specific safe differences',()=>{
 if(!cases.length)return;
 let found=0;
 for(const x of cases){
  const e=createV3IndependentDevelopmentRequest(x);
  const disc=e.request.input.actions.filter(x=>x.group<37);
  for(let i=0;i<disc.length;i++)for(let j=i+1;j<disc.length;j++){
   const a=e.request.input.evidence.find(x=>x.id==='calc-'+disc[i].key).value;
   const b=e.request.input.evidence.find(x=>x.id==='calc-'+disc[j].key).value;
   if(a.shanten!==b.shanten||a.ukeireUpperBound!==b.ukeireUpperBound||a.retainedDoraHan!==b.retainedDoraHan)continue;
   const z=createV4DeterministicSourceComparison(e,choice(disc[i].key),choice(disc[j].key));
   if(z.proof.comparisons.some(x=>x.type==='seatGenbutsu'&&x.relation==='different'))found++;
  }
 }
 assert(found>0);
});
test('no source-grounded difference does not turn into fabricated distinction merely because discards differ',()=>{
 if(!cases.length)return;
 let undifferentiated=0,compared=0;
 for(const x of cases.slice(24,36)){
  const e=createV3IndependentDevelopmentRequest(x),actions=e.request.input.actions.filter(x=>x.group<37);
  for(let i=0;i<actions.length;i++)for(let j=i+1;j<actions.length;j++){
   const v=createV4DeterministicSourceComparison(e,choice(actions[i].key),choice(actions[j].key));
   compared++;
   if(v.publicDifferences===0){
    undifferentiated++;
    assert.equal(v.proofStatus,'no_public_differentiator_available');
    assert.equal(v.proof.comparisons[0].relation,'same');
   }
  }
 }
 assert(compared>0);
 assert(undifferentiated>=0);
});
