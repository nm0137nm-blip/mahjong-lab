import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createV3IndependentDevelopmentRequest} from '../../src/coach/v14-independent-request-v3.mjs';
import {createV3PublicContrastFixture} from '../../src/coach/v14-evidence-proof-v3.mjs';
import {buildV4RonSettlement} from '../../src/coach/v14-settlement-events-v4.mjs';
import {buildV4CandidateSettlementCatalog} from '../../src/coach/v14-candidate-settlement-v4.mjs';
import {createV4PublicFactRegistry,verifyAndRenderV4AnchoredTactics,V4_TACTIC_VERSION}
 from '../../src/coach/v14-anchored-tactical-text-v4.mjs';
const cases=process.env.V14_FOLLOWUP_PUBLIC?
 JSON.parse(fs.readFileSync(process.env.V14_FOLLOWUP_PUBLIC,'utf8')):[];
const evidence=(i,key)=>i.evidence.find(e=>e.id===key)?.value;
function fixture(){
 const v=cases.find(x=>x.request.input.id==='pilot-48');if(!v)return null;
 const input=createV3IndependentDevelopmentRequest(v),i=input.request.input;
 const proof=createV3PublicContrastFixture(input,{key:'a37-1',afterCallDiscard:null},
  {key:'a13-0',afterCallDiscard:null});
 for(const s of [1,3]){
  const v=evidence(i,'public-value-'+s);
  proof.opponentObservations.push({seat:s,field:'points',value:v.points,assessment:'not_established'});
 }
 const catalog=buildV4CandidateSettlementCatalog(input,{key:'a13-0',afterCallDiscard:null});
 const allowed=catalog.dealInSensitivity.find(x=>x.sourceTierBase===5800&&x.hypotheticalSettlement.opponentSeat===0);
 const event=allowed.hypotheticalSettlement,eventFactId=allowed.factId;
 const opponent=s=>({seat:s,
  analysis:'[[opponent:seat'+s+':points]]という公開点棒を見て、和了価値との相対関係を考える。',
  tradeoff:'この相手への安全性と自分の和了機会は別々の条件付き価値である。',
  changeCondition:'相手の攻撃が明示されたら、攻撃を続ける条件を再検討する。'});
 const answer={version:V4_TACTIC_VERSION,requestHash:input.requestHash,proof,
  tactics:{
   comparison:'[[candidate:a37-1:kind]]と[[candidate:a13-0:kind]]を比べ、役が増える利点と防御へ変更できない欠点を区別する。',
   opponents:[opponent(0),opponent(1),opponent(3)],
   bottomLine:'現物かどうかと待ちの価値を検討するが、正解確率は確定していない。',
   reversal:'相手の脅威の確信度が変われば、選択の重みが変化する。',
   lesson:'観測される事実と実際には分からない他家の和了率を分けて考える。'
  }};
 return {input,answer,event,eventFactId};
}
test('v4 anchored qualitative prose preserves 3 seats without free numeric model statements',()=>{
 const f=fixture();if(!f)return;
 f.answer.tactics.opponents[0].analysis+=' [['+f.eventFactId+']]で仮定の放銃清算を参照する。';
 const summary=verifyAndRenderV4AnchoredTactics(f.input,f.answer);
 assert.equal(summary.numericFactsRenderedByCode,true);
 assert.equal(summary.experimentalModelChoice.isProductionRecommendation,false);
 assert.equal(summary.opponents.length,3);
 assert.match(summary.opponents[0].analysis,/5,800点/);
 assert.match(summary.opponents[0].analysis,/27,000点/);
 assert.match(summary.comparison,/立直 p5/);
});
test('old known ChatGPT numerical hallucination blocked even with valid structured proof',()=>{
 const f=fixture();if(!f)return;
 f.answer.tactics.opponents[0].analysis+=' 3900点放銃で逆転すると書く。';
 assert.throws(()=>verifyAndRenderV4AnchoredTactics(f.input,f.answer),/unanchored numerical/);
});
test('kanji counting and fake placeholder do not bypass word-level facts',()=>{
 const f=fixture();if(!f)return;
 f.answer.tactics.lesson='三千九百点で順位が逆転するかもしれない。';
 assert.throws(()=>verifyAndRenderV4AnchoredTactics(f.input,f.answer),/unanchored numerical/);
 const x=fixture();if(!x)return;
 x.answer.tactics.lesson='[[event:made-up]]で着順を考えて判断を選ぶ。';
 assert.throws(()=>verifyAndRenderV4AnchoredTactics(x.input,x.answer),/unknown fact ID/);
});
test('tampered arithmetic event rejected when inserted into fact registry',()=>{
 const f=fixture();if(!f)return;
 const e={...f.event,ownPointsAfter:27001};
 assert.throws(()=>createV4PublicFactRegistry(f.input,[e]),/caller-supplied arithmetic event is not source-bound/);
});
test('duplicate seats, missing seat citations and fabricated public values are rejected',()=>{
 const f=fixture();if(!f)return;
 f.answer.tactics.opponents[2].seat=1;
 assert.throws(()=>verifyAndRenderV4AnchoredTactics(f.input,f.answer),/duplicate opponent/);
 const g=fixture();if(!g)return;
 g.answer.tactics.opponents[1].analysis='[[candidate:a13-0:kind]]だけを考えて相手の情報に言及しない。';
 assert.throws(()=>verifyAndRenderV4AnchoredTactics(g.input,g.answer),/opponent analysis must cite/);
 const h=fixture();if(!h)return;
 h.answer.proof.opponentObservations[0].value='bogus';
 assert.throws(()=>verifyAndRenderV4AnchoredTactics(h.input,h.answer),/v3-proof/);
});
test('unchanged model-proposed choice is never promoted to authenticated Mortal advice',()=>{
 const f=fixture();if(!f)return;
 const a=verifyAndRenderV4AnchoredTactics(f.input,f.answer);
 assert.equal(a.experimentalModelChoice.origin,'model_selected_not_mortal_verified');
 assert.equal(a.outcome,'typed_facts_verified_qualitative_tactics_unverified');
 assert.equal(a.policy,'NOT_PRODUCTION_NO_TACTICAL_SKILL_CERTIFICATION');
});


test('a plausible but not source-listed dealer 3900 hypothetical cannot be inserted as a selectable fact ID',()=>{
 const f=fixture();if(!f)return;
 const arbitrary=buildV4RonSettlement(evidence(f.input.request.input,'board'),
  {kind:'hypotheticalOwnDealIn',dealerSeat:0,opponentSeat:0,paymentBase:3900,postRiichi:false});
 assert.equal(arbitrary.ownPointsAfter,28900);
 assert.throws(()=>createV4PublicFactRegistry(f.input,[arbitrary]),/not source-bound/);
 f.answer.tactics.lesson='[[event:'+arbitrary.id+']]に応じて局収支を考える。';
 assert.throws(()=>verifyAndRenderV4AnchoredTactics(f.input,f.answer),/unknown fact ID/);
});
test('a valid source tier cannot be reinterpreted with an arbitrary other candidate',()=>{
 const f=fixture();if(!f)return;
 const wrong='candidate:pilot-48:a14-0:none:ron:m6:opp0:'+f.event.id;
 f.answer.tactics.lesson='[['+wrong+']]のときに対応を検討する。';
 assert.throws(()=>verifyAndRenderV4AnchoredTactics(f.input,f.answer),/unknown fact ID/);
});
