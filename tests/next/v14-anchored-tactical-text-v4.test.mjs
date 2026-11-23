import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createV3IndependentDevelopmentRequest} from '../../src/coach/v14-independent-request-v3.mjs';
import {createV3PublicContrastFixture} from '../../src/coach/v14-evidence-proof-v3.mjs';
import {buildV4RonSettlement} from '../../src/coach/v14-settlement-events-v4.mjs';
import {buildV4CandidateSettlementCatalog} from '../../src/coach/v14-candidate-settlement-v4.mjs';
import {createV4PublicFactRegistry,createV4SourceBoundFactRegistry,verifyAndRenderV4AnchoredTactics,V4_TACTIC_VERSION}
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
  analysis:'[[opponent:seat'+s+':points]]の点棒と[[opponent:seat'+s+':meldCount]]の進行材料を区別し、攻守の重みを考える。',
  tradeoff:'[[opponent:seat'+s+':riichi]]という公開状況と[[candidate:a37-1:kind]]の防御制限を合わせて、和了価値を比較する。',
  changeCondition:'もし[[opponent:seat'+s+':riichi]]の観測が変わる場合、押し引きの条件を変えて考える。'});
 const answer={version:V4_TACTIC_VERSION,requestHash:input.requestHash,proof,
  tactics:{
   comparison:'[[candidate:a37-1:kind]]と[[candidate:a13-0:kind]]を比べる。[[candidate:a37-1:shanten]]を保ちつつ、役が増える利点と防御へ変更できない欠点を区別する。',
   opponents:[opponent(0),opponent(1),opponent(3)],
   bottomLine:'[[candidate:a37-1:kind]]を暫定選択とし、現物と待ちを比較する。ただし正解確率は確定していない。',
   reversal:'もし[[opponent:seat1:meldCount]]など公開情報が変わる場合、選択の相対価値は再検討する。',
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
 assert.throws(()=>verifyAndRenderV4AnchoredTactics(g.input,g.answer),/opponent analysis requires own seat-specific/);
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


test('empty generic tactical statements cannot pass by citing only candidate name and not opponent context',()=>{
 const f=fixture();if(!f)return;
 f.answer.tactics.opponents[0].tradeoff='相手が早そうならダマに切り替えるべきだが、現状は確定しない。';
 assert.throws(()=>verifyAndRenderV4AnchoredTactics(f.input,f.answer),/lacks concrete public-fact anchor/);
 const x=fixture();if(!x)return;
 x.answer.tactics.reversal='もし相手が怖い場合は変更するが、実際の確率は分からない。';
 assert.throws(()=>verifyAndRenderV4AnchoredTactics(x.input,x.answer),/lacks concrete public-fact anchor/);
});
test('seat analysis must actually contrast scoreboard and progress instead of just copying points',()=>{
 const f=fixture();if(!f)return;
 f.answer.tactics.opponents[0].analysis='[[opponent:seat0:points]]だけから脅威を判断することはできない。';
 assert.throws(()=>verifyAndRenderV4AnchoredTactics(f.input,f.answer),/requires own seat-specific rank gap plus public progress/);
});
test('candidate action labels without nontrivial comparison evidence do not satisfy v4 structure',()=>{
 const f=fixture();if(!f)return;
 f.answer.tactics.comparison='[[candidate:a37-1:kind]]と[[candidate:a13-0:kind]]だけを並べても、選択の比較にはならない。';
 assert.throws(()=>verifyAndRenderV4AnchoredTactics(f.input,f.answer),/comparison only names actions/);
});


test('short ronSummary anchors preserve conditional own riichi versus silent legal role, and no actual probability claims',()=>{
 const f=fixture();if(!f)return;
 const facts=createV4PublicFactRegistry(f.input);
 assert.match(facts['candidate:a37-1:ronSummary'],/m6の仮ロンは5,200点/);
 assert.match(facts['candidate:a37-1:ronSummary'],/m9の仮ロンは5,200点/);
 assert.match(facts['candidate:a13-0:ronSummary'],/m6の仮ロンは2,600点/);
 assert.match(facts['candidate:a13-0:ronSummary'],/m9は指定条件で役なしロン点なし/);
 f.answer.tactics.comparison+=' [[candidate:a37-1:ronSummary]]と[[candidate:a13-0:ronSummary]]を対照する。';
 const output=verifyAndRenderV4AnchoredTactics(f.input,f.answer);
 assert.match(output.comparison,/5,200点/);
 assert.match(output.comparison,/2,600点/);
 assert.match(output.comparison,/役なしロン点なし/);
 assert.equal(output.freeNumericTextBlocked,true);
});
test('call m222- after m4 uses only that concrete post-call conditional score summary and cannot cite another discarded tile',()=>{
 const v=cases.find(x=>x.request.input.id==='pilot-59');if(!v)return;
 const e=createV3IndependentDevelopmentRequest(v);
 const rec={key:'a41-0',afterCallDiscard:'m4'},alt={key:'a45-0',afterCallDiscard:null};
 const proof=createV3PublicContrastFixture(e,rec,alt);
 const own=e.request.input.evidence.find(x=>x.id==='board').value.ownSeat;
 for(const seat of [0,1,2,3].filter(s=>s!==own)){
  if(proof.opponentObservations.some(x=>x.seat===seat))continue;
  const value=e.request.input.evidence.find(x=>x.id==='public-value-'+seat).value.points;
  proof.opponentObservations.push({seat,field:'points',value,assessment:'not_established'});
 }
 const facts=createV4SourceBoundFactRegistry(e,proof);
 assert.match(facts['candidate:a41-0:afterCallDiscard'],/m4を切る/);
 assert.match(facts['candidate:a41-0:afterCallRonSummary'],/p0の仮ロンは7,700点/);
 assert.match(facts['candidate:a41-0:afterCallRonSummary'],/p2の仮ロンは3,900点/);
 assert.equal(Object.hasOwn(facts,'candidate:a41-0:m5:afterCallRonSummary'),false);
});
