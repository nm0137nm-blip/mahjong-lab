import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {verifyPairedPackages,evaluatePairResponses} from '../../src/coach/v14-paired-contrast-v2.mjs';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const clone=x=>structuredClone(x);
const root=process.env.V14_STAGE1,lin=process.env.V14_LINEAGE,ref=process.env.V14_PINNED_CONTRAST;
const hasData=Boolean(root&&lin&&ref);
const es=hasData?JSON.parse(fs.readFileSync(root,'utf8')):[],lineage=hasData?JSON.parse(fs.readFileSync(lin,'utf8')):[],mortal=hasData?JSON.parse(fs.readFileSync(ref,'utf8')):{};
function groupFor(es,id,key){const e=es.find(x=>x.request.input.id===id);if(!e)throw Error('missing case');const groups=[...new Set(e.request.input.actions.map(x=>x.group))];if(key!==undefined){if(!groups.includes(key))throw Error('illegal fixture group');return key;}return groups;}
function rehash(es,lineage,id,modify){
 const row=es.find(e=>e.request.input.id===id),l=lineage.find(l=>l.pilotId===id);
 if(!row||!l)throw Error('missing fixture');
 modify(row.request.input);
 row.requestHash=hash(row.request);l.requestHash=row.requestHash;
}
test('four frozen riichi packages: single declared riichi toggle AND necessary escrow, no other primary fact changes',()=>{
 if(!hasData)return;
 const a=verifyPairedPackages(es,lineage,mortal);
 assert.equal(a.legalPrimaryPairedPackages,4);
 assert.equal(a.referenceChanged,2);
 assert.equal(a.referenceMaintained,2);
 assert.deepEqual(a.rows.map(x=>[x.caseA,x.caseB]),[
  ['pilot-12','pilot-10'],['pilot-13','pilot-02'],['pilot-25','pilot-05'],['pilot-29','pilot-18']]);
 for(const r of a.rows){
  assert.equal(r.package,'riichi_declaration_plus_1000_point_deposit');
  assert.equal(r.noUnrelatedPrimaryFactsChanged,true);
  assert.equal(r.canClaimSingleFactor,false);
  assert.equal(r.tacticalTruth,'not_established_by_this_comparison');
  assert.equal(r.publicEventToggleCount,1);
 }
});
test('paired evaluator distinguishes change-vs-maintain and rejects both trivial baselines',()=>{
 if(!hasData)return;
 const p=verifyPairedPackages(es,lineage,mortal);
 const gold=p.rows.flatMap(r=>[{id:r.caseA,group:r.reference.bestA},{id:r.caseB,group:r.reference.bestB}]);
 const perfect=evaluatePairResponses(es,p,gold);
 assert.equal(perfect.complete,4);
 assert.equal(perfect.matchedSensitivity,2);
 assert.equal(perfect.matchedSpecificity,2);
 assert.equal(perfect.groupExactPair,4);
 assert.equal(perfect.strategyCertification,'not_proved');
 const alwaysSame=p.rows.flatMap(r=>[{id:r.caseA,group:r.reference.bestA},{id:r.caseB,group:r.reference.bestA}]);
 const same=evaluatePairResponses(es,p,alwaysSame);
 assert.equal(same.matchedSensitivity,0);
 assert.equal(same.matchedSpecificity,2);
 const alwaysChange=p.rows.flatMap(r=>{
  const different=groupFor(es,r.caseB).find(g=>g!==r.reference.bestA);
  assert.notEqual(different,undefined);
  return [{id:r.caseA,group:r.reference.bestA},{id:r.caseB,group:different}];
 });
 const change=evaluatePairResponses(es,p,alwaysChange);
 assert.equal(change.matchedSensitivity,2);
 assert.equal(change.matchedSpecificity,0);
});
test('missing cases contribute to denominator; illegal group or duplicate response fails',()=>{
 if(!hasData)return;
 const p=verifyPairedPackages(es,lineage,mortal);
 const predictions=p.rows.flatMap(r=>[{id:r.caseA,group:r.reference.bestA},{id:r.caseB,group:r.reference.bestB}]);
 const short=evaluatePairResponses(es,p,predictions.slice(0,7));
 assert.equal(short.total,4);
 assert.equal(short.complete,3);
 assert.equal(short.groupExactPair,3);
 assert.throws(()=>evaluatePairResponses(es,p,[predictions[0],predictions[0]]),/duplicate/);
 assert.throws(()=>evaluatePairResponses(es,p,[{id:predictions[0].id,group:999}]),/illegal/);
 assert.throws(()=>evaluatePairResponses(es,p,[{id:'pilot-99',group:1}]),/duplicate or unknown/);
});
test('fail-closed public package audit catches illegal change in unrelated river and fake 1000 point deposit',()=>{
 if(!hasData)return;
 const badE=clone(es),badL=clone(lineage);
 rehash(badE,badL,'pilot-10',i=>i.evidence.find(e=>e.id==='seat-1').value.discards[0].tile='s9');
 assert.throws(()=>verifyPairedPackages(badE,badL,mortal),/other input evidence changed|non-target opponent/);
 const b2=clone(es),l2=clone(lineage);
 rehash(b2,l2,'pilot-10',i=>i.evidence.find(e=>e.id==='board').value.kyotaku+=2);
 assert.throws(()=>verifyPairedPackages(b2,l2,mortal),/escrow/);
 const b3=clone(es),l3=clone(lineage);
 rehash(b3,l3,'pilot-10',i=>i.evidence.find(e=>e.id==='history').value.push({種類:'打牌',席:0,牌:'m1',ツモ切り:false,立直宣言:false}));
 assert.throws(()=>verifyPairedPackages(b3,l3,mortal),/history size/);
});
test('reference-only materials are explicit verifier inputs and do not contaminate the frozen public request',()=>{
 if(!hasData)return;
 const before=hash(es),a=verifyPairedPackages(es,lineage,mortal);
 assert.equal(hash(es),before);
 for(const e of es){
  assert(!Object.hasOwn(e.request,'reference')&&!Object.hasOwn(e.request,'mortal'));
  assert(!Object.hasOwn(e.request.input,'q')&&!Object.hasOwn(e.request.input,'teacher'));
 }
 const malicious=clone(mortal);malicious.modelSHA256='other-model';
 assert.throws(()=>verifyPairedPackages(es,lineage,malicious),/pinned reference/);
 assert.equal(a.certification,'verifier_only_mortal_sensitivity_specificity_not_B3_B4');
});
