import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createV3IndependentDevelopmentRequest,makeV3SyntheticAnswer} from '../../src/coach/v14-independent-request-v3.mjs';
import {createV3PublicContrastFixture} from '../../src/coach/v14-evidence-proof-v3.mjs';
import {sealSingleInference} from '../../src/coach/v14-inference-record-v3.mjs';
import {createV3Stage2GenuineRequest,verifyV3Stage2GenuineRequest,verifyV3Stage2AnswerShape,storeV3GenuineStage2Answer,
 STAGE2_ANSWER_VERSION_V3,STAGE2_RESPONSE_SHAPE_V3} from '../../src/coach/v14-stage2-unified-v3.mjs';
const enabled=Boolean(process.env.V14_STAGE1&&process.env.V14_LINEAGE&&process.env.V14_PINNED_CONTRAST);
const inputs=enabled?JSON.parse(fs.readFileSync(process.env.V14_STAGE1,'utf8')):[],
 lineage=enabled?JSON.parse(fs.readFileSync(process.env.V14_LINEAGE,'utf8')):[],
 pinned=enabled?JSON.parse(fs.readFileSync(process.env.V14_PINNED_CONTRAST,'utf8')):{};
const clone=x=>structuredClone(x),sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
function choice(i,a){
 const calc=i.evidence.find(x=>x.id==='calc-'+a.key).value;
 return {key:a.key,afterCallDiscard:calc.afterCallDiscards?.[0]?.discard??null};
}
function fixture(l){
 const v1=inputs.find(x=>x.request.input.id===l.pilotId),i=createV3IndependentDevelopmentRequest(v1),
 actions=i.request.input.actions;
 const proof=createV3PublicContrastFixture(i,choice(i.request.input,actions[0]),choice(i.request.input,actions[1]));
 const answer=makeV3SyntheticAnswer(i,proof);
 const lock=sealSingleInference(i,{id:l.pilotId,requestHash:i.requestHash,answer},{
  sessionId:'synthetic-v3-'+l.pilotId,transport:'manual_chat',provider:'fixture only',modelId:'NO_MODEL_CALLED',
  modelVersion:null,effort:null,temperature:null,seed:null,
  startedAt:'2026-11-23T00:00:00+09:00',endedAt:'2026-11-23T00:00:01+09:00',
  providerRequestId:null,sourceAssertion:'user_reported',usage:null});
 const row=pinned.rows.find(x=>x.pair===l.pair),r=row.variants[l.version];
 const reference={caseId:l.pilotId,requestHash:i.requestHash,modelSHA256:pinned.modelSHA256,
  origin:'verifier_only_pinned_model',q:r.q,best:r.best};
 const user=choice(i.request.input,actions[0]);
 const genuine=createV3Stage2GenuineRequest(i,lock,reference,user);
 return {i,lock,reference,genuine,user};
}
function makeSyntheticAnswer(f,pkt,endGroup,stance){
 const actions=f.i.request.input.actions;
 const recommended=actions.find(x=>x.group===endGroup);
 const alternative=actions.find(x=>x.key!==recommended.key);
 const proof=createV3PublicContrastFixture(f.i,choice(f.i.request.input,recommended),choice(f.i.request.input,alternative));
 return {version:STAGE2_ANSWER_VERSION_V3,requestHash:pkt.requestHash,
  stage1AnswerHash:pkt.request.stage1AnswerHash,
  referenceTopAcknowledged:pkt.request.reference.bestGroups[0],
  endorsedGroup:endGroup,stance,contrastProof:proof,
  explanation:'この出力はテスト用に組み立てられた文章であり、実際のAIの回答や麻雀解説能力の証明ではない。',
  whatWouldChangeAssessment:'公開情報が変わり検証可能な数値や安全情報が反転したらもう一度判断を検証する必要がある。',
  relativeQMagnitude:'not_provided'};
}
test('eight frozen genuine references use identical unified responseShape, locked Stage1 and concrete legal user action',()=>{
 if(!enabled)return;
 let n=0;
 for(const l of lineage.filter(x=>x.kind==='contrast')){
  const f=fixture(l),p=f.genuine,ref=p.request.reference;
  assert.deepEqual(p.request.responseShape,STAGE2_RESPONSE_SHAPE_V3);
  assert.equal(p.request.stage,'comparison-v3-dev');
  assert.equal(p.request.userAction.key,f.user.key);
  assert.equal(p.request.stage1AnswerHash,f.lock.packet.answerHash);
  assert.equal(p.request.lockedStage1RecordHash,f.lock.packetHash);
  assert.equal(ref.relativeQMagnitude,'not_provided');
  assert(!('q' in ref));assert(!('referenceTopGap' in ref));assert(!('hiddenHands' in p.request));
  assert.equal(verifyV3Stage2GenuineRequest(f.i,f.lock,f.reference,p,f.user).genuineInputIntegrity,'pass');
  const a=makeSyntheticAnswer(f,p,ref.bestGroups[0],'accept_reference');
  const stored=storeV3GenuineStage2Answer(f.i,f.lock,f.reference,p,a,f.user);
  assert.equal(stored.shape.stage2Schema,'unified_v3_verified');
  assert.equal(stored.record.certification,'not_certified_without_real_model_and_independent_semantic_exam');
  n++;
 }
 assert.equal(n,8);
});
test('counterfeit second-ranked reference has identical model-visible contract; genuine source rejects its recomputed hash',()=>{
 if(!enabled)return;
 let n=0;
 for(const l of lineage.filter(x=>x.kind==='contrast')){
  const f=fixture(l),g=f.genuine,original=g.request.reference;
  const options=original.rankedGroups.filter(x=>!original.bestGroups.includes(x));
  if(!options.length)continue;
  const fakeGroup=options[0],p=clone(g);
  p.request.reference.bestGroups=[fakeGroup];
  p.request.reference.rankedGroups=[fakeGroup,...original.rankedGroups.filter(x=>x!==fakeGroup)];
  p.requestHash=sha(p.request);
  assert.deepEqual(p.request.responseShape,g.request.responseShape);
  assert.deepEqual(Object.keys(p.request),Object.keys(g.request));
  assert.deepEqual(Object.keys(p.request.reference),Object.keys(g.request.reference));
  assert.deepEqual(p.request.independentStage1Answer,g.request.independentStage1Answer);
  assert.deepEqual(p.request.input,g.request.input);
  assert(!('isCounterfeit' in p.request));
  assert.throws(()=>verifyV3Stage2GenuineRequest(f.i,f.lock,f.reference,p,f.user),/counterfeit, mismatched original reference/);
  const artificialAnswer=makeSyntheticAnswer(f,p,fakeGroup,'accept_reference');
  const check=verifyV3Stage2AnswerShape(f.i,f.lock,p,artificialAnswer);
  assert.equal(check.authenticity,'not_established_by_shape_check');
  assert.equal(check.fakeRecommendationResistance,'not_measured');
  n++;
 }
 assert.equal(n,8);
});
test('same unified answer checks true reference update, false reference acceptance and unsupported confidence wording',()=>{
 if(!enabled)return;
 const l=lineage.find(x=>x.kind==='contrast'),f=fixture(l),p=f.genuine;
 const actual=makeSyntheticAnswer(f,p,p.request.reference.bestGroups[0],'accept_reference');
 assert.equal(verifyV3Stage2AnswerShape(f.i,f.lock,p,actual).stage2Schema,'unified_v3_verified');
 const wrong=clone(actual);wrong.relativeQMagnitude='large Q difference';
 assert.throws(()=>verifyV3Stage2AnswerShape(f.i,f.lock,p,wrong),/invalid unified Stage2 answer/);
 const bad=clone(actual);bad.endorsedGroup=p.request.reference.rankedGroups.at(-1);
 if(!p.request.reference.bestGroups.includes(bad.endorsedGroup))
  assert.throws(()=>verifyV3Stage2AnswerShape(f.i,f.lock,p,bad),/stance contradicts/);
 const altered=clone(actual);altered.stage1AnswerHash='forged';
 assert.throws(()=>verifyV3Stage2AnswerShape(f.i,f.lock,p,altered),/invalid unified Stage2 answer/);
 const fakeSource=clone(p);fakeSource.request.independentStage1Answer.educational.reason='私が最初からMortalを支持していた。';
 fakeSource.requestHash=sha(fakeSource.request);
 assert.throws(()=>verifyV3Stage2AnswerShape(f.i,f.lock,fakeSource,actual),/Stage1 locked answer or source facts replaced/);
});
test('valid user action is a specific selectable tile/after-call discard, never a model Q group disguised as a tile',()=>{
 if(!enabled)return;
 const f=fixture(lineage.find(x=>x.kind==='contrast')),p=f.genuine;
 const bad={key:'a999-0',afterCallDiscard:null};
 assert.throws(()=>createV3Stage2GenuineRequest(f.i,f.lock,f.reference,bad),/user action not legal/);
 const nullUser=createV3Stage2GenuineRequest(f.i,f.lock,f.reference,null);
 assert.equal(nullUser.request.userAction,null);
 assert(!('realModelInference' in p.request));
});
