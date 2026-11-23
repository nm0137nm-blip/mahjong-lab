import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createV3IndependentDevelopmentRequest} from '../../src/coach/v14-independent-request-v3.mjs';
import {buildV4CandidateSettlementCatalog,verifyV4CandidateSettlementCatalog}
 from '../../src/coach/v14-candidate-settlement-v4.mjs';
const sources=process.env.V14_FOLLOWUP_PUBLIC?
 JSON.parse(fs.readFileSync(process.env.V14_FOLLOWUP_PUBLIC,'utf8')):[];
function scene(id){
 const source=sources.find(e=>e.request.input.id===id);
 return source?createV3IndependentDevelopmentRequest(source):null;
}
const choice=(key,afterCallDiscard=null)=>({key,afterCallDiscard});
test('pilot48 concrete riichi p5 yields m6/m9 conditional 5200 and separate post-reach deposit events',()=>{
 const e=scene('pilot-48');if(!e)return;
 const c=buildV4CandidateSettlementCatalog(e,choice('a37-1'));
 assert.equal(c.status,'public_source_bound_conditional_score_and_loss_sensitivity');
 assert.equal(c.sourceMode,'hypotheticalRiichiRon');
 assert.equal(c.scoredOwnRon.length,6);
 assert.equal(c.dealInSensitivity.length,15);
 assert.deepEqual(new Set(c.scoredOwnRon.map(x=>x.sourceTile)),new Set(['m6','m9']));
 assert(c.scoredOwnRon.every(x=>x.scoreFromVisibleSource===5200));
 assert(c.scoredOwnRon.every(x=>x.hypotheticalSettlement.riichiDeposit===1000));
 assert(c.scoredOwnRon.every(x=>x.hypotheticalSettlement.paymentBase===5200));
 assert(c.scoredOwnRon.every(x=>x.sourceMode==='hypotheticalRiichiRon'));
 assert.equal(verifyV4CandidateSettlementCatalog(e,c).scoredEvents,6);
 const seat0loss=c.dealInSensitivity.find(x=>x.hypotheticalSettlement.opponentSeat===0&&x.sourceTierBase===5800);
 assert.equal(seat0loss.hypotheticalSettlement.ownPointsAfter,26000);
 assert.equal(seat0loss.hypotheticalSettlement.opponentPointsAfter,28200);
 assert.equal(seat0loss.hypotheticalSettlement.riichiDeposit,1000);
});
test('pilot48 silent p5 only scores m6 as 2600; m9 is roleless unscored ron',()=>{
 const e=scene('pilot-48');if(!e)return;
 const c=buildV4CandidateSettlementCatalog(e,choice('a13-0'));
 assert.equal(c.sourceMode,'ron');
 assert.equal(c.scoredOwnRon.length,3);
 assert.equal(c.scoredOwnRon[0].scoreFromVisibleSource,2600);
 assert.equal(c.unscoredOwnRon.length,1);
 assert.equal(c.unscoredOwnRon[0].tile,'m9');
 assert(c.scoredOwnRon.every(x=>x.hypotheticalSettlement.riichiDeposit===0));
 assert.equal(c.dealInSensitivity.length,15);
});
test('pilot59 pon m222- concrete afterCallDiscard produces three scoring tiles; wrong/missing discard fails',()=>{
 const e=scene('pilot-59');if(!e)return;
 const c=buildV4CandidateSettlementCatalog(e,choice('a41-0','m4'));
 assert.equal(c.choiceKind,'post_call_discard_concrete');
 assert.equal(c.status,'public_source_bound_conditional_score_and_loss_sensitivity');
 assert.equal(c.scoredOwnRon.length,9);
 assert.deepEqual(new Set(c.scoredOwnRon.map(x=>x.sourceTile)),new Set(['p2','p5','p0']));
 assert.deepEqual(new Set(c.scoredOwnRon.map(x=>x.scoreFromVisibleSource)),new Set([3900,7700]));
 assert(c.scoredOwnRon.every(x=>x.sourceAfterCallDiscard==='m4'));
 assert.throws(()=>buildV4CandidateSettlementCatalog(e,choice('a41-0')),/call requires/);
 assert.throws(()=>buildV4CandidateSettlementCatalog(e,choice('a41-0','z7')),/afterCallDiscard absent/);
});
test('pilot63 post-pon m5 is self-furiten: never expose 12000 as currently legal ron',()=>{
 const e=scene('pilot-63');if(!e)return;
 const c=buildV4CandidateSettlementCatalog(e,choice('a41-0','m5'));
 assert.equal(c.status,'own_river_furiten_no_ron_scenarios');
 assert.equal(c.scoredOwnRon.length,0);
 assert(c.unscoredOwnRon.length>0);
});
test('pilot63 terminal ron and response pass do not produce fictitious future ron event',()=>{
 const e=scene('pilot-63');if(!e)return;
 for(const key of ['a43-0','a45-0']){
  const c=buildV4CandidateSettlementCatalog(e,choice(key));
  assert.equal(c.status,'terminal_or_pass_no_immediate_future_ron_event');
  assert.equal(c.scoredOwnRon.length,0);
  assert.equal(c.dealInSensitivity.length,0);
 }
});
test('pilot53 chii before legal discard is not yet tenpai and must not receive future win points',()=>{
 const e=scene('pilot-53');if(!e)return;
 const c=buildV4CandidateSettlementCatalog(e,choice('a39-0','m2'));
 assert.equal(c.status,'not_tenpai_after_concrete_choice');
 assert.equal(c.scoredOwnRon.length,0);
});
test('tampered candidate score or settlement tier always rejected at source hash or output verification',()=>{
 const e=scene('pilot-48');if(!e)return;
 const c=buildV4CandidateSettlementCatalog(e,choice('a37-1'));
 const bad=structuredClone(c);bad.scoredOwnRon[0].scoreFromVisibleSource=9999;
 assert.throws(()=>verifyV4CandidateSettlementCatalog(e,bad),/altered/);
 const x=structuredClone(e);const ev=x.request.input.evidence.find(a=>a.id==='calc-a37-1');
 ev.value.conditionalNormalWins[0].hypotheticalRiichiRon.basePoints=9999;
 assert.throws(()=>buildV4CandidateSettlementCatalog(x,choice('a37-1')),/mutated public evidence/);
 const y=structuredClone(e);y.request.input.evidence.find(a=>a.id==='rank-scenarios').value.ron[2].lossBase=3900;
 assert.throws(()=>buildV4CandidateSettlementCatalog(y,choice('a37-1')),/mutated public evidence/);
});
test('v4 deterministic score catalogs cover 36 public cases without a teacher choice',()=>{
 if(!sources.length)return;
 let attempted=0,available=0,nonzero=0,scored=0;
 for(const e of sources){
  const p=createV3IndependentDevelopmentRequest(e),board=e.request.input.evidence.find(x=>x.id==='board').value;
  if(board.honba||board.kyotaku)nonzero++;
  for(const a of p.request.input.actions){
   let choices=[choice(a.key)];
   if(a.group>=38&&a.group<=41){
    const m=p.request.input.evidence.find(x=>x.id==='calc-'+a.key).value;
    choices=m.afterCallDiscards.map(x=>choice(a.key,x.discard));
   }
   for(const c of choices){
    attempted++;
    const catalog=buildV4CandidateSettlementCatalog(p,c);
    if(catalog.status==='public_source_bound_conditional_score_and_loss_sensitivity')available++;
    scored+=catalog.scoredOwnRon.length;
    assert(verifyV4CandidateSettlementCatalog(p,catalog).noActualExpectedValue);
   }
  }
 }
 assert.equal(sources.length,36);
 assert(attempted>250&&available>0&&scored>0&&nonzero>0);
});
