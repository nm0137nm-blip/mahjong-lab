import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createV2IndependentDevelopmentRequest,ANSWER_VERSION} from '../../src/coach/v14-independent-request-v2.mjs';
import {makeArithmeticFixture} from '../../src/coach/v14-evidence-proof-v2.mjs';
import {sealSingleInference} from '../../src/coach/v14-inference-record-v2.mjs';
import {makeStage2VerifiedDevelopmentRequest,verifyStage2AgainstPinnedOriginal} from '../../src/coach/v14-stage2-boundary-v2.mjs';
import {makeBlindedStage2Pair,inspectIsolatedStage2Response,QUARANTINE_VERSION} from './v14-stage2-counterfeit-isolated-v2.mjs';
const enabled=Boolean(process.env.V14_STAGE1&&process.env.V14_LINEAGE&&process.env.V14_PINNED_CONTRAST);
const es=enabled?JSON.parse(fs.readFileSync(process.env.V14_STAGE1,'utf8')):[],lineage=enabled?JSON.parse(fs.readFileSync(process.env.V14_LINEAGE,'utf8')):[],pinned=enabled?JSON.parse(fs.readFileSync(process.env.V14_PINNED_CONTRAST,'utf8')):{};
function stage2(caseId){
 const old=es.find(x=>x.request.input.id===caseId),i=createV2IndependentDevelopmentRequest(old),p=makeArithmeticFixture(i);
 const a={version:ANSWER_VERSION,requestHash:i.requestHash,evidenceProof:p,
  importantSeats:[],uncertainSeats:[{seat:p.opponentObservations[0].seat,reason:'この相手の影響は公開事実だけではまだ判断できない。'}],
  educational:{reason:'候補間の確定した算術差は確認できるが、選択の正しさとは異なる。',
   opponentTradeoff:'他家の公開情報と非公開の待ち牌・安全度を区別して考える。',
   boundary:'未知の和了率と放銃率によって選択が反転する可能性がある。',
   lesson:'確定した候補計算と条件付きの押し引き仮説を分離する。'}};
 const locked=sealSingleInference(i,{id:caseId,requestHash:i.requestHash,answer:a},{
  sessionId:'synthetic-test-only-'+caseId,transport:'manual_chat',provider:'test fixture',
  modelId:'not-a-real-model',modelVersion:null,effort:null,temperature:null,seed:null,
  startedAt:'2026-11-23T00:00:00+09:00',endedAt:'2026-11-23T00:00:01+09:00',
  providerRequestId:null,sourceAssertion:'user_reported',usage:null});
 const l=lineage.find(x=>x.pilotId===caseId),record=pinned.rows.find(x=>x.pair===l.pair),v=record.variants[l.version];
 const reference={caseId,requestHash:i.requestHash,modelSHA256:pinned.modelSHA256,
  origin:'verifier_only_pinned_model',best:v.best,q:v.q};
 const genuine=makeStage2VerifiedDevelopmentRequest(i,locked,reference);
 return {i,locked,reference,genuine};
}
test('all eight frozen contrast contexts produce indistinguishably shaped, manifest-blinded counterfeit prompts',()=>{
 if(!enabled)return;
 let count=0;
 for(const l of lineage.filter(x=>x.kind==='contrast')){
  const {i,locked,reference,genuine}=stage2(l.pilotId);
  const pair=makeBlindedStage2Pair(genuine,reference);
  assert.equal(pair.verifierOnlyManifest.version,QUARANTINE_VERSION);
  assert.equal(pair.quarantine,'tests_next_only_never_ship_or_route_to_production');
  assert.notEqual(pair.genuineModelVisible.requestHash,pair.counterfeitModelVisible.requestHash);
  assert.deepEqual(Object.keys(pair.genuineModelVisible.request).sort(),Object.keys(pair.counterfeitModelVisible.request).sort());
  assert.deepEqual(Object.keys(pair.genuineModelVisible.request.reference).sort(),Object.keys(pair.counterfeitModelVisible.request.reference).sort());
  assert.deepEqual(pair.genuineModelVisible.request.independent,pair.counterfeitModelVisible.request.independent);
  assert.deepEqual(pair.genuineModelVisible.request.input,pair.counterfeitModelVisible.request.input);
  assert(pair.counterfeitModelVisible.request.reference.bestGroups.some(k=>!pair.genuineModelVisible.request.reference.bestGroups.includes(k)));
  for(const m of [pair.genuineModelVisible,pair.counterfeitModelVisible]){
   assert(!Object.hasOwn(m,'verifierOnlyManifest'));
   assert(!Object.hasOwn(m.request,'experimentalCondition'));
   assert(!Object.hasOwn(m.request.reference,'q'));
   assert(!Object.hasOwn(m.request.reference,'isCounterfeit'));
   assert(!Object.hasOwn(m.request.reference,'teacherQ'));
  }
  assert.equal(verifyStage2AgainstPinnedOriginal(i,locked,reference,pair.genuineModelVisible).stage2TransportIntegrity,'pass');
  assert.throws(()=>verifyStage2AgainstPinnedOriginal(i,locked,reference,pair.counterfeitModelVisible),/reference or first-stage answer was substituted/);
  count++;
 }
 assert.equal(count,8);
});
test('simulated blindly compliant counterfeit endorsement is counted as a diagnostic only, not tactical score',()=>{
 if(!enabled)return;
 const l=lineage.find(x=>x.kind==='contrast'),{reference,genuine}=stage2(l.pilotId);
 const pair=makeBlindedStage2Pair(genuine,reference),fake=pair.counterfeitModelVisible;
 const a={requestHash:fake.requestHash,
  endorsedTopGroup:pair.verifierOnlyManifest.counterfeitTopGroup,expressedUncertainty:false,
  statedCalculationContradiction:false,
  rationale:'これは意図的に偽推奨を信じる人工的な負対照文であり、実際のLLM出力ではない。'};
 const r=inspectIsolatedStage2Response(pair,'counterfeit',a);
 assert.equal(r.reportedCounterfeitTopEndorsement,true);
 assert.equal(r.tacticalCertification,'none');
 assert.equal(r.semanticReview,'not_measured');
 const b=structuredClone(a);b.requestHash=pair.genuineModelVisible.requestHash;
 assert.throws(()=>inspectIsolatedStage2Response(pair,'counterfeit',b),/unbound answer/);
});
test('counterfeit tool remains quarantined in tests directory; cannot be imported from production source',()=>{
 const root=path.resolve('src'),needle=/stage2-counterfeit-isolated-v2|makeBlindedStage2Pair|inspectIsolatedStage2Response/;
 function visit(p){
  for(const d of fs.readdirSync(p,{withFileTypes:true})){
   const f=path.join(p,d.name);
   if(d.isDirectory())visit(f);
   else if(/\.(mjs|js|ts|tsx)$/.test(f))assert.equal(needle.test(fs.readFileSync(f,'utf8')),false,'production references fake-label trial: '+f);
  }
 }
 visit(root);
});
