import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {prepareV3DevelopmentCounterfactualPairs,prepareV3UnlabelledExpansionPairs} from '../../src/coach/v14-public-counterfactual-prep-v3.mjs';
const file=process.env.V14_FOLLOWUP_PUBLIC;
const cases=file?JSON.parse(fs.readFileSync(file,'utf8')):[];
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const val=(i,k)=>i.evidence.find(e=>e.id===k)?.value;
const total=b=>b.scores.reduce((a,v)=>a+v.points,0)+1000*b.kyotaku;
test('additional source-disjoint cases are chosen without teacher labels, preserving frozen eight',()=>{
 if(!file)return;
 const first=prepareV3DevelopmentCounterfactualPairs(cases);
 const original=first.pairs.map(x=>x.baseline.requestHash);
 const expansion=prepareV3UnlabelledExpansionPairs(cases);
 assert.deepEqual(first.pairs.map(x=>x.baseline.requestHash),original);
 assert.equal(expansion.observedS42LabelsAtSelection,false);
 assert.equal(expansion.pairCount,expansion.pairs.length);
 assert(expansion.pairCount>=1);
 assert(expansion.sourceClusterCount<=expansion.pairCount);
 assert(expansion.sourceClusterCount<=27);
 const oldIds=new Set(first.pairs.map(x=>x.sourceCaseId));
 const uniq=new Set();
 for(const p of expansion.pairs){
  assert(!oldIds.has(p.sourceCaseId));
  assert.notEqual(p.sourceCaseId,'pilot-48');
  assert.equal(p.labelStatus,'NO_MORTAL_REPLAY_NO_CHANGE_OR_MAINTAIN_GROUP_ASSIGNED');
  assert.equal(sha(p.baseline.request),p.baseline.requestHash);
  assert.equal(sha(p.alternative.request),p.alternative.requestHash);
  assert.notEqual(p.baseline.requestHash,p.alternative.requestHash);
  assert.deepEqual(p.baseline.request.input.actions,p.alternative.request.input.actions);
  assert.deepEqual(val(p.baseline.request.input,'visible'),val(p.alternative.request.input,'visible'));
  assert.deepEqual(val(p.baseline.request.input,'own'),val(p.alternative.request.input,'own'));
  assert.equal(total(val(p.baseline.request.input,'board')),total(val(p.alternative.request.input,'board')));
  assert.equal(val(p.alternative.request.input,'board').scores.some(x=>x.points<0),false);
  const key=p.sourceCaseId+'/'+p.kind+'/'+p.changedSeat;
  assert(!uniq.has(key));uniq.add(key);
 }
});
