import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createV2IndependentDevelopmentRequest,ANSWER_VERSION} from '../../src/coach/v14-independent-request-v2.mjs';
import {makeArithmeticFixture} from '../../src/coach/v14-evidence-proof-v2.mjs';
import {sealSingleInference} from '../../src/coach/v14-inference-record-v2.mjs';
import {makeStage2VerifiedDevelopmentRequest,verifyStage2AgainstPinnedOriginal,storeStage2DevelopmentAnswer} from '../../src/coach/v14-stage2-boundary-v2.mjs';
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex'),clone=x=>structuredClone(x);
const enabled=Boolean(process.env.V14_STAGE1&&process.env.V14_LINEAGE&&process.env.V14_PINNED_CONTRAST);
const inputs=enabled?JSON.parse(fs.readFileSync(process.env.V14_STAGE1,'utf8')):[],lineage=enabled?JSON.parse(fs.readFileSync(process.env.V14_LINEAGE,'utf8')):[],pinned=enabled?JSON.parse(fs.readFileSync(process.env.V14_PINNED_CONTRAST,'utf8')):{};
function fixture(v1){
 const i=createV2IndependentDevelopmentRequest(v1),proof=makeArithmeticFixture(i);
 const answer={version:ANSWER_VERSION,requestHash:i.requestHash,evidenceProof:proof,
  importantSeats:[],uncertainSeats:[{seat:proof.opponentObservations[0].seat,reason:'この座席の影響については定量的に判断する根拠がないため保留する。'}],
  educational:{reason:'この2つの候補の数値差だけは確認できるが、最良の戦術という証明ではない。',
   opponentTradeoff:'他家の立直・点数の公開情報だけでは、個々の待ちや放銃率は確定しない。',
   boundary:'和了と放銃の未知の頻度で選択が変わる可能性がある。',
   lesson:'自手の形だけでなく、確定情報と仮説を分けて比較する。'}};
 const locked=sealSingleInference(i,{id:i.request.input.id,requestHash:i.requestHash,answer},
 {sessionId:'fixture-session-'+i.request.input.id,transport:'manual_chat',
  provider:'unit-test fixture not a model call',modelId:'synthetic fixture',modelVersion:null,
  effort:null,temperature:null,seed:null,startedAt:'2026-11-23T00:00:00+09:00',
  endedAt:'2026-11-23T00:00:01+09:00',providerRequestId:null,
  sourceAssertion:'user_reported',usage:null});
 const l=lineage.find(l=>l.pilotId===i.request.input.id),q=pinned.rows.find(x=>x.pair===l.pair).variants[l.version];
 const reference={caseId:i.request.input.id,requestHash:i.requestHash,
  modelSHA256:pinned.modelSHA256,origin:'verifier_only_pinned_model',
  q:q.q,best:q.best};
 return {i,locked,reference};
}
test('paired stage2 genuine source uses only legal GROUP ranking, never raw Q, and freezes the independent answer',()=>{
 if(!enabled)return;
 let counted=0;
 for(const l of lineage.filter(x=>x.kind==='contrast')){
  const old=inputs.find(e=>e.request.input.id===l.pilotId),{i,locked,reference}=fixture(old);
  const c=makeStage2VerifiedDevelopmentRequest(i,locked,reference);
  assert.equal(c.request.kind,'genuine_verifier_reference_only');
  assert.equal(c.request.stage,'comparison-v2-dev');
  assert.equal(c.request.independent.lockedRecordHash,locked.packetHash);
  assert.deepEqual(c.request.independent.answer,locked.packet.answerEnvelope.answer);
  assert(!Object.hasOwn(c.request.reference,'q'));
  assert(!Object.hasOwn(c.request.reference,'hiddenHand'));
  assert(c.request.reference.rankedGroups.length>=2);
  assert(c.request.reference.bestGroups.includes(reference.best));
  assert.equal(verifyStage2AgainstPinnedOriginal(i,locked,reference,c).contentSemanticQuality,'not_certified');
  const out=storeStage2DevelopmentAnswer(i,locked,reference,c,{
   text:'これはユニットテスト用の説明であって、モデルの実推論や麻雀能力を示すものではない。',
   diagnosis:{referenceInterpretation:'モデルの合法グループ間の順位に限定して解釈する。',
    whatCouldRefute:'前提となる公開情報や計算が変化した場合は検証し直す。'}});
  assert.equal(out.record.certification,'dev_transport_only_no_semantic_or_expert_certification');
  counted++;
 }
 assert.equal(counted,8);
});
test('quarantined counterfeit label cannot be accepted against separately provided pinned reference, even if rehashed',()=>{
 if(!enabled)return;
 const old=inputs.find(e=>e.request.input.id===lineage.find(x=>x.kind==='contrast').pilotId);
 const {i,locked,reference}=fixture(old),good=makeStage2VerifiedDevelopmentRequest(i,locked,reference);
 const fake=clone(good),top=fake.request.reference.bestGroups;
 fake.request.reference.bestGroups=[fake.request.reference.rankedGroups.find(g=>!top.includes(g))];
 fake.request.reference.scope='Mortal definitely recommends this false group';
 fake.requestHash=sha(fake.request);
 assert.throws(()=>verifyStage2AgainstPinnedOriginal(i,locked,reference,fake),/reference or first-stage answer was substituted/);
 assert.throws(()=>storeStage2DevelopmentAnswer(i,locked,reference,fake,{
  text:'これは偽参照への追従を試すだけの長いテスト説明であって利用者に表示しない。',
  diagnosis:{referenceInterpretation:'偽参照を無批判に正当化したい。',
    whatCouldRefute:'独立計算に矛盾する場合は説明を拒否すべき。'}}),/substituted/);
 const forged=clone(reference);forged.q[forged.best]=-999;
 assert.throws(()=>makeStage2VerifiedDevelopmentRequest(i,locked,forged),/reference best not maximum/);
});
test('stage2 transport fails if first-stage answer is altered or unrelated reference is injected',()=>{
 if(!enabled)return;
 const old=inputs.find(e=>e.request.input.id===lineage.find(x=>x.kind==='contrast').pilotId);
 const {i,locked,reference}=fixture(old),c=makeStage2VerifiedDevelopmentRequest(i,locked,reference);
 const bad=clone(locked);bad.packet.answerEnvelope.answer.educational.reason='勝てると確定した。';
 assert.throws(()=>verifyStage2AgainstPinnedOriginal(i,bad,reference,c),/tampered record/);
 const fakeSource=clone(reference);fakeSource.caseId='pilot-99';
 assert.throws(()=>makeStage2VerifiedDevelopmentRequest(i,locked,fakeSource),/unverifiable pinned group ref/);
 const v1=clone(i);v1.request.stage='independent';v1.requestHash=sha(v1.request);
 assert.throws(()=>makeStage2VerifiedDevelopmentRequest(v1,locked,reference),/untrusted stage1/);
});
