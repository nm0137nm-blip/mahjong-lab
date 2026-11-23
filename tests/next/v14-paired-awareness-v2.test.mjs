import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createV2IndependentDevelopmentRequest,ANSWER_VERSION} from '../../src/coach/v14-independent-request-v2.mjs';
import {makeArithmeticFixture} from '../../src/coach/v14-evidence-proof-v2.mjs';
import {evaluatePairedStage1Awareness,validatePairedAwarenessResult,PAIR_AWARENESS_VERSION} from '../../src/coach/v14-paired-awareness-v2.mjs';
const epath=process.env.V14_STAGE1,lpath=process.env.V14_LINEAGE,rpath=process.env.V14_PINNED_CONTRAST;
const ready=Boolean(epath&&lpath&&rpath),stage1=ready?JSON.parse(fs.readFileSync(epath,'utf8')):[],
 lineage=ready?JSON.parse(fs.readFileSync(lpath,'utf8')):[],reference=ready?JSON.parse(fs.readFileSync(rpath,'utf8')):{};
const pairRows=()=>lineage.filter(x=>x.kind==='contrast');
const copy=x=>structuredClone(x);
function syntheticAnswer(id,{omitChangedSeat=false}={}){
 const original=stage1.find(x=>x.request.input.id===id);
 const env=createV2IndependentDevelopmentRequest(original);
 const proof=makeArithmeticFixture(env);
 const row=pairRows().find(x=>x.pilotId===id);
 const delta=reference.rows.find(x=>x.pair===row.pair);
 const on=row.version==='a';
 const seat=delta?stage1.find(x=>x.request.input.id===id).request.input.evidence.find(x=>x.id==='seat-'+delta.pair)?.value?.seat:undefined;
 // The changed seat is detected directly from the public riichi declaration
 // paired with the reversed declaration in the opposite variant; never inferred
 // from the model response or Q reference.
 const counterpart=stage1.find(x=>{
  const l=pairRows().find(t=>t.pilotId===x.request.input.id);
  return l?.pair===row.pair&&l.version!==row.version;
 });
 const target=[0,1,2,3].find(s=>{
  const left=original.request.input.evidence.find(x=>x.id==='public-value-'+s)?.value;
  const right=counterpart.request.input.evidence.find(x=>x.id==='public-value-'+s)?.value;
  return left?.riichi!==right?.riichi;
 });
 assert(Number.isInteger(target));
 const own=original.request.input.evidence.find(x=>x.id==='board').value.ownSeat;
 const observationalSeat=omitChangedSeat?[0,1,2,3].find(s=>s!==own&&s!==target):target;
 const val=env.request.input.evidence.find(x=>x.id==='public-value-'+observationalSeat).value;
 proof.opponentObservations=[{seat:observationalSeat,field:'riichi',value:val.riichi,assessment:'not_established'}];
 const answer={
  version:ANSWER_VERSION,requestHash:env.requestHash,evidenceProof:proof,
  importantSeats:[],
  uncertainSeats:[{seat:observationalSeat,reason:'この相手の公開事実は確認できるが推奨打牌の変更要因とは断定できない。'}],
  educational:{
   reason:'候補の算術比較は妥当でも、実際の和了/放銃確率は未検証で最善判断は証明できない。',
   opponentTradeoff:'相手の宣言と点棒は公開されるが真の手牌の形は非公開であり確率推定はできない。',
   boundary:'立直宣言や供託の有無で状況が変わる場合もあるが、変化だけで最適手の反転を強制しない。',
   lesson:'公開リーチ事実の認識と戦術判断の正しさを別々の評価対象として扱う。'
  }
 };
 return {id,requestHash:env.requestHash,answer};
}
test('four legal coupled riichi packages: both sides can record opposite public facts without requiring action switches',()=>{
 if(!ready)return;
 const responses=pairRows().map(x=>syntheticAnswer(x.pilotId));
 const report=evaluatePairedStage1Awareness(stage1,lineage,reference,responses);
 assert.equal(report.version,PAIR_AWARENESS_VERSION);
 assert.equal(report.nPairs,4);
 assert.equal(report.availablePairedResponses,4);
 assert.equal(report.bothSidesExplicitRiichiGrounding,4);
 assert.equal(report.referenceChangedPairs,2);
 assert.equal(report.referenceMaintainedPairs,2);
 assert.equal(report.matchedReferenceChangePairs,0); // arithmetic-fixture-first-action: does not react
 assert.equal(report.matchedReferenceMaintainPairs,2);
 assert.equal(report.bothReferenceGroupsExact<=4,true);
 assert.equal(report.interpretation.modelReasoning,'NOT CERTIFIED');
 assert.equal(report.interpretation.causalIsolation.startsWith('Not single-factor'),true);
 assert.equal(validatePairedAwarenessResult(stage1,lineage,reference,responses,report).strategy,'unproven');
});
test('a factually valid generic answer that omits changed opponent never receives contrast awareness credit',()=>{
 if(!ready)return;
 const responses=pairRows().map(x=>syntheticAnswer(x.pilotId,{omitChangedSeat:x.version==='a'}));
 const report=evaluatePairedStage1Awareness(stage1,lineage,reference,responses);
 assert.equal(report.bothSidesExplicitRiichiGrounding,0);
 assert.equal(report.availablePairedResponses,4);
 assert.equal(report.referenceMaintainedPairs,2);
 assert.equal(report.interpretation.referenceSensitivity.includes('not a correctness oracle'),true);
});
test('missing variants count against denominator, duplicate IDs and unbound hashes fail',()=>{
 if(!ready)return;
 const responses=pairRows().map(x=>syntheticAnswer(x.pilotId));
 const short=evaluatePairedStage1Awareness(stage1,lineage,reference,responses.slice(1));
 assert.equal(short.nPairs,4);assert.equal(short.availablePairedResponses,3);
 assert.equal(short.missingPairedResponses,1);
 assert.equal(short.bothSidesExplicitRiichiGrounding,3);
 assert.throws(()=>evaluatePairedStage1Awareness(stage1,lineage,reference,[responses[0],responses[0]]),/duplicate/);
 const wrong=copy(responses),r=wrong[0];r.requestHash='forged';
 assert.throws(()=>evaluatePairedStage1Awareness(stage1,lineage,reference,wrong),/v2 request hash/);
});
test('rehashed stage1 pseudo-answer cannot falsely quote the opposite legal variant public riichi status',()=>{
 if(!ready)return;
 const responses=pairRows().map(x=>syntheticAnswer(x.pilotId));
 const bad=copy(responses);
 bad[0].answer.evidenceProof.opponentObservations[0].value=!bad[0].answer.evidenceProof.opponentObservations[0].value;
 assert.throws(()=>evaluatePairedStage1Awareness(stage1,lineage,reference,bad),/false or mismatched opponent fact/);
 const good=evaluatePairedStage1Awareness(stage1,lineage,reference,responses);
 good.rows[0].changedPublicFactorExplicitlyGrounded=false;
 assert.throws(()=>validatePairedAwarenessResult(stage1,lineage,reference,responses,good),/tampered paired diagnostic/);
});
