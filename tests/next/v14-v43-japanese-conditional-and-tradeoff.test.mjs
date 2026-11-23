import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {hasV43ConditionalReversal} from '../../src/coach/v14-japanese-condition-v43.mjs';
import {createV3IndependentDevelopmentRequest} from '../../src/coach/v14-independent-request-v3.mjs';
import {createV43CompactDevelopmentPacket,verifyAndRenderV43CompactModelResponse,V43_COMPACT_RESPONSE}
 from '../../src/coach/v14-compact-model-contract-v43.mjs';
const source=process.env.V14_FOLLOWUP_PUBLIC?JSON.parse(fs.readFileSync(process.env.V14_FOLLOWUP_PUBLIC,'utf8')):[];
const fixture=()=>{
 const x=source.find(x=>x.request.input.id==='pilot-59');
 if(!x)return null;
 const e=createV3IndependentDevelopmentRequest(x),packet=createV43CompactDevelopmentPacket(e);
 const seat=(s)=>({
  seat:s,importance:'potentially_relevant',
  analysis:'[[opponent:seat'+s+':pointGapFromOwn]]と[[opponent:seat'+s+':meldCount]]で相手の公開進行を照合する。',
  tradeoff:'[[candidate:a41-0:afterCallDiscard]]の危険を[[opponent:seat'+s+':riichi]]と合わせて考える。推奨手の放銃危険は断定しない。',
  changeCondition:s===1?
   'もし[[opponent:seat1:riichi]]が先行立直済みとなり、現物でなければ守備に切り替える。':
   s===2?
   'もし[[opponent:seat2:recentHandDiscards]]に対する現物条件が変われば、危険度を再評価する。':
   'もし[[opponent:seat3:meldCount]]が増えて高打点になれば、鳴く判断を見直す。'
 });
 const answer={version:V43_COMPACT_RESPONSE,requestHash:packet.requestHash,
  recommendation:{key:'a41-0',afterCallDiscard:'m4'},
  alternative:{key:'a45-0',afterCallDiscard:null},
  tactics:{
   comparison:'[[candidate:a41-0:kind]]で鳴いた後[[candidate:a41-0:afterCallDiscard]]を切る。対案[[candidate:a45-0:kind]]の[[candidate:a45-0:shanten]]と速度・安全牌を比較する。',
   opponents:[seat(1),seat(2),seat(3)],
   bottomLine:'[[candidate:a41-0:kind]]と[[candidate:a41-0:afterCallDiscard]]による和了の機会を評価する。',
   reversal:'もし[[opponent:seat1:riichi]]が変わって現物でなければ、[[candidate:a45-0:kind]]を再評価する。',
   lesson:'特定の相手の現物と全員への安全を混同せず、鳴いた後の打牌の自由度を検討する。'
  }};
 return {e,packet,answer};
};
test('Japanese grammatical conditional forms with opponent-specific decision changes are accepted',()=>{
 const positives=[
  'もし[[opponent:seat1:riichi]]のもとで現物でなければ、守備に切り替える。',
  'もし[[opponent:seat3:meldCount]]が増えて高打点になれば、鳴く判断を見直す。',
  'もし[[opponent:seat2:riichi]]が立直済みとなったら撤退する。',
  '[[opponent:seat1:riichi]]が立直ならば、押し引きを再考する。',
  '[[opponent:seat2:meldCount]]が増えた場合には、守備を重視する。',
  'もし[[opponent:seat3:discardCount]]から危険が明瞭になる限り、攻め方を見直す。'
 ];
 const negatives=[
  '相手は無条件に危険で、公開情報から判断を絶対に変えない。',
  'もし[[opponent:seat1:riichi]]の情報を参照する。',
  '相手の状況に気をつけるという一般論である。',
  'もし[[opponent:seat2:meldCount]]が増えれば、今の状況が進む。'
 ];
 for(const x of positives)assert.equal(hasV43ConditionalReversal(x),true,x);
 for(const x of negatives)assert.equal(hasV43ConditionalReversal(x),false,x);
});
test('v43 typed public facts: real pilot59-shaped synthetic model response passes both condition and three opponent FactIDs',()=>{
 const f=fixture();if(!f)return;
 const v=verifyAndRenderV43CompactModelResponse(f.e,f.packet,f.answer);
 assert.equal(v.output.outcome,'typed_facts_verified_qualitative_tactics_unverified');
 assert.equal(v.actualTacticalSkill,'not_certified_pending_independent_anonymous_blind_review');
 assert.equal(v.output.experimentalModelChoice.isProductionRecommendation,false);
 assert.equal(v.output.opponents.length,3);
 assert.deepEqual(v.output.opponents.map(x=>x.seat),[1,2,3]);
 assert(v.output.sourceBasedPublicProof.opponentObservations.length===6);
});
test('pilot59 historical answer defect remains FAIL: seat2 tradeoff has no opponent seat2 FactID',()=>{
 const f=fixture();if(!f)return;
 const bad=structuredClone(f.answer);
 bad.tactics.opponents[1].tradeoff='[[candidate:a41-0:afterCallDiscard]]がこの相手の河にはあり、[[candidate:a45-0:kind]]より安全な打牌と言える。';
 assert.throws(()=>verifyAndRenderV43CompactModelResponse(f.e,f.packet,bad),
  /opponent tradeoff needs both concrete candidate and opponent evidence/);
});
test('citation from a different opponent seat never substitutes for own seat in tradeoff',()=>{
 const f=fixture();if(!f)return;
 const bad=structuredClone(f.answer);
 bad.tactics.opponents[1].tradeoff='[[candidate:a41-0:afterCallDiscard]]と[[opponent:seat1:riichi]]を比較した結果、安全なら押す。';
 assert.throws(()=>verifyAndRenderV43CompactModelResponse(f.e,f.packet,bad),
  /opponent tradeoff needs both concrete candidate and opponent evidence/);
});
test('no candidate FactID in seat tradeoff fails; conditions without reversal also fail',()=>{
 const f=fixture();if(!f)return;
 const bad=structuredClone(f.answer);
 bad.tactics.opponents[2].tradeoff='[[opponent:seat3:meldCount]]は公開副露で、危険が増す。';
 assert.throws(()=>verifyAndRenderV43CompactModelResponse(f.e,f.packet,bad),/opponent tradeoff needs both/);
 const g=structuredClone(f.answer);
 g.tactics.opponents[0].changeCondition='もし[[opponent:seat1:riichi]]が変わるかどうか不明である。';
 assert.throws(()=>verifyAndRenderV43CompactModelResponse(f.e,f.packet,g),/change condition needs/);
});
test('new fact registry enables source-grounded public opponent river and legal chosen post-call genbutsu only',()=>{
 const f=fixture();if(!f)return;
 const x=structuredClone(f.answer);
 x.tactics.opponents[1].tradeoff='[[candidate:a41-0:afterCallDiscard]]は[[candidate:a41-0:genbutsuSeat2]]であり、[[opponent:seat2:recentHandDiscards]]と照合する。';
 const r=verifyAndRenderV43CompactModelResponse(f.e,f.packet,x);
 assert(r.output.opponents[1].tradeoff.includes('席2'));
 assert(r.output.opponents[1].tradeoffFactRefs.includes('opponent:seat2:recentHandDiscards'));
 assert(!f.packet.request.availableFactIds.includes('candidate:a41-0:genbutsuSeat2'));
 const falseFact=structuredClone(x);
 falseFact.tactics.opponents[1].tradeoff+=' [[candidate:a45-0:genbutsuSeat2]]という公開事実もある。';
 assert.throws(()=>verifyAndRenderV43CompactModelResponse(f.e,f.packet,falseFact),/unknown fact ID/);
});
test('ordinary Japanese and file-only transport remain present in exact v43 public packet',()=>{
 const f=fixture();if(!f)return;
 const p=f.packet.request;
 assert.equal(p.delivery.filename,'mahjong_P2a_v43_stage1_pilot-59_response.json');
 assert(p.system.includes('各席のtradeoff本文'));
 assert(p.system.includes('JSONファイル'));
 assert(p.availableFactIds.includes('opponent:seat2:recentHandDiscards'));
 assert(!JSON.stringify(p).includes('mortalReference'));
});
