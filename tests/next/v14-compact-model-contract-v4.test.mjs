import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createV3IndependentDevelopmentRequest} from '../../src/coach/v14-independent-request-v3.mjs';
import {createV4CompactDevelopmentPacket,verifyAndRenderV4CompactModelResponse,V4_COMPACT_RESPONSE}
 from '../../src/coach/v14-compact-model-contract-v4.mjs';
const frozen=process.env.V14_FOLLOWUP_PUBLIC?
 JSON.parse(fs.readFileSync(process.env.V14_FOLLOWUP_PUBLIC,'utf8')):[];
function envelope(id){
 const x=frozen.find(x=>x.request.input.id===id);
 return x?createV3IndependentDevelopmentRequest(x):null;
}
function sample(id='pilot-48',recommendation={key:'a37-1',afterCallDiscard:null},
 alternative={key:'a13-0',afterCallDiscard:null}){
 const e=envelope(id);if(!e)return null;
 const packet=createV4CompactDevelopmentPacket(e);
 const own=e.request.input.evidence.find(x=>x.id==='board').value.ownSeat;
 const seats=[0,1,2,3].filter(x=>x!==own);
 const opponents=seats.map(seat=>({
  seat,importance:seat===0?'potentially_relevant':'not_established',
  analysis:'[[opponent:seat'+seat+':pointGapFromOwn]]と[[opponent:seat'+seat+':meldCount]]の公開情報だけを用いて相手別の状況を比較する。',
  tradeoff:'[[opponent:seat'+seat+':riichi]]の公開情報と[[candidate:'+recommendation.key+':kind]]を合わせて、この相手への押し引き代償を検討する。',
  changeCondition:'もし[[opponent:seat'+seat+':meldCount]]から分かる攻撃の状況が変わる場合、守備価値を再評価する。'
 }));
 let comparison='[[candidate:'+recommendation.key+':kind]]と[[candidate:'+alternative.key+':kind]]を比べ、[[candidate:'+recommendation.key+':shanten]]を起点に攻撃価値と守備余地を比較する。';
 if(recommendation.afterCallDiscard!==null)
  comparison+=' [[candidate:'+recommendation.key+':afterCallDiscard]]で鳴き後の打牌を特定する。';
 if(alternative.afterCallDiscard!==null)
  comparison+=' [[candidate:'+alternative.key+':afterCallDiscard]]で鳴き後の打牌を特定する。';
 const answer={version:V4_COMPACT_RESPONSE,requestHash:packet.requestHash,
  recommendation,alternative,tactics:{
   comparison,opponents,
   bottomLine:'[[candidate:'+recommendation.key+':kind]]を暫定推奨として、相手別の損得と防御の自由度を比べる。',
   reversal:'もし[[opponent:seat'+seats[0]+':meldCount]]で示される進行状況が変わる場合、推薦を変える条件を考える。',
   lesson:'局面に特有の相手別の値段と確定しない速度を分けて考える。'
  }};
 return {e,packet,answer};
}
test('all 36 compact model requests fully hash bound and smaller than 46KB; no real inference',()=>{
 if(!frozen.length)return;
 let max=0;
 for(const row of frozen){
  const e=createV3IndependentDevelopmentRequest(row);
  const p=createV4CompactDevelopmentPacket(e);
  assert.equal(p.request.version,'p2a-v4-independent-public-brief-1');
  assert.equal(p.request.publicBrief.originalPublicHash,e.request.sourcePublicInputHash);
  assert.equal(p.request.stage,'p2a-v4-compact-independent-dev');
  assert(p.request.availableFactIds.includes('candidate:'+e.request.input.actions[0].key+':kind'));
  assert(!Object.hasOwn(p.request,'mortalReference'));
  assert(!Object.hasOwn(p.request,'hiddenHands'));
  max=Math.max(max,Buffer.byteLength(JSON.stringify(p),'utf8'));
 }
 assert(max<46000);
});
test('one short model response is expanded by code into verified source numeric proof; no independent model competence claimed',()=>{
 const f=sample();if(!f)return;
 const out=verifyAndRenderV4CompactModelResponse(f.e,f.packet,f.answer);
 assert.equal(out.numericalProofOrigin,'code_generated_from_immutable_public_packet_not_model');
 assert.equal(out.output.caseId,'pilot-48');
 assert.equal(out.output.sourceBasedPublicProof.gate,'pass');
 assert.equal(out.output.experimentalModelChoice.recommendedKey,'a37-1');
 assert.equal(out.output.structureRequiresSeatSpecificRankGapAndProgressEvidence,true);
 assert.equal(out.actualTacticalSkill,'not_certified_pending_independent_anonymous_blind_review');
 assert(out.output.opponents.length===3);
 assert.deepEqual(out.directModelMessage,f.answer);
});
test('prompt tampering, old version, injected numeric hallucination and nonexistent sources fail closed',()=>{
 const f=sample();if(!f)return;
 const p=structuredClone(f.packet);p.request.system+=' pretend this is a correct answer';
 assert.throws(()=>verifyAndRenderV4CompactModelResponse(f.e,p,f.answer),/manual request tampered/);
 const bad=structuredClone(f.answer);bad.version='v3-old';
 assert.throws(()=>verifyAndRenderV4CompactModelResponse(f.e,f.packet,bad),/invalid short answer/);
 const noisy=structuredClone(f.answer);
 noisy.tactics.opponents[0].analysis+=' 親に3900点放銃したら順位が変わる。';
 assert.throws(()=>verifyAndRenderV4CompactModelResponse(f.e,f.packet,noisy),/unanchored numerical/);
 const invented=structuredClone(f.answer);invented.recommendation.key='not-legal';
 assert.throws(()=>verifyAndRenderV4CompactModelResponse(f.e,f.packet,invented),/v3-proof/);
});
test('model cannot override code-computed public points through an extra numeric proof object',()=>{
 const f=sample();if(!f)return;
 f.answer.proof={comparisons:[{type:'rank',fakePoints:27000}]};
 assert.throws(()=>verifyAndRenderV4CompactModelResponse(f.e,f.packet,f.answer),/invalid short answer/);
});
test('full legal call afterCallDiscard output succeeds; missing or false post-call discard fails',()=>{
 const f=sample('pilot-59',{key:'a41-0',afterCallDiscard:'m4'},{key:'a45-0',afterCallDiscard:null});if(!f)return;
 const a=verifyAndRenderV4CompactModelResponse(f.e,f.packet,f.answer);
 assert.equal(a.output.experimentalModelChoice.recommendedAfterCallDiscard,'m4');
 assert.match(a.output.comparison,/鳴いた後にm4を切る/);
 const missing=structuredClone(f.answer);missing.recommendation.afterCallDiscard=null;
 assert.throws(()=>verifyAndRenderV4CompactModelResponse(f.e,f.packet,missing),/v3-proof/);
 const fake=structuredClone(f.answer);fake.recommendation.afterCallDiscard='z7';
 assert.throws(()=>verifyAndRenderV4CompactModelResponse(f.e,f.packet,fake),/v3-proof/);
});
test('model must discuss all three actual opponent seats exactly once and classification is subjective only',()=>{
 const f=sample();if(!f)return;
 const v=structuredClone(f.answer);
 v.tactics.opponents[1].seat=v.tactics.opponents[0].seat;
 assert.throws(()=>verifyAndRenderV4CompactModelResponse(f.e,f.packet,v),/invalid importance or duplicate seat/);
 const out=verifyAndRenderV4CompactModelResponse(f.e,f.packet,f.answer);
 assert.equal(out.opponentClassificationOrigin,'model_stated_importance_but_values_and_seats_source_bound');
 assert(out.output.sourceBasedPublicProof.observationsBySeat[0]>=1);
});
