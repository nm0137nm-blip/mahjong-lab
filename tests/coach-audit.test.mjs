import {test} from 'node:test';
import assert from 'node:assert/strict';
import {materialized,prompt,grade} from '../scripts/coach/audit.mjs';
test('60 distinct probes, ten in each domain, actual engine checks',()=>{
 assert.equal(materialized.length,60);assert.equal(new Set(materialized.map(x=>x.id)).size,60);
 for(const g of new Set(materialized.map(x=>x.group)))assert.equal(materialized.filter(x=>x.group===g).length,10);
 const c=materialized.find(c=>c.id==='E01');
 for(const k of ['m1','s1','m2']){
  assert.equal(c.expected[k].shanten,2);
  assert.equal(c.expected[k].ukeire,20);
  assert.deepEqual(c.expected[k].waits,['m3','m6','p3','p6','s8','s9']);
 }
 assert.equal(c.verified.各候補[0].実ドラ[0],'s3');
 assert.ok(c.verified.各候補[0].after.includes('s18899'));
 assert.ok(!c.verified.各候補[1].after.includes('s18899'));
});
test('v1/v2 prompts do not leak private answer key, enforce independent recommendation',()=>{
 const batch=materialized.slice(0,5);
 const a=prompt(batch,'v1'),b=prompt(batch,'v2');
 assert.doesNotMatch(a,/engine_facts/);assert.match(b,/engine_facts/);
 for(const p of [a,b]){assert.doesNotMatch(p,/"expected"|"oracle"|"rubric"/);assert.match(p,/recommendation/);}
 assert.match(b,/独立した推奨を必ず一つ選び/);
});
test('scoring detects wrong dora, illegal choice and omission; objective pass never certifies coaching',()=>{
 const batch=materialized.slice(0,3);
 const good=batch.map(c=>({id:c.id,facts:c.expected,recommendation:null,confidence:'high',reasoning:'fixture only',next_rule:'fixture only'}));
 const pass=grade(good,batch);assert.equal(pass.objectivePass,3);assert.equal(pass.manualReviewPending,3);
 good[0].facts={dora:'s2'};good[1].recommendation='illegal';good.pop();
 const fail=grade(good,batch);assert.equal(fail.objectivePass,0);assert.equal(fail.criticalFactErrors,2);assert.equal(fail.legalFailures,2);
 assert.throws(()=>grade([good[0],good[0]],batch),/duplicate/);
});
