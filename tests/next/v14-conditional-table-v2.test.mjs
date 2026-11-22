import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {buildConditionalTable,verifyConditionalTable,TABLE_VERSION} from '../../src/coach/v14-conditional-table-v2.mjs';
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const clone=x=>structuredClone(x);
const real=process.env.V14_STAGE1?JSON.parse(fs.readFileSync(process.env.V14_STAGE1,'utf8')):[];
function spec(e,opponent=null,rowIndex=null){
 const i=e.request.input,own=i.evidence.find(x=>x.id==='board').value.ownSeat,r=i.evidence.find(x=>x.id==='rank-scenarios').value;
 const a=i.actions.slice(0,2),options=a.map(x=>i.evidence.find(z=>z.id==='calc-'+x.key).value);
 const seat=opponent??[0,1,2,3].find(x=>x!==own),j=rowIndex??r.ron.findIndex(x=>x.other===seat);
 return {recommendation:a[0].key,recommendationDiscard:options[0].afterCallDiscards?.[0]?.discard??null,
 alternative:a[1].key,alternativeDiscard:options[1].afterCallDiscards?.[0]?.discard??null,
 opponent:seat,ronRowIndex:j};
}
test('30 frozen public cases, each three opponents x five hypothetical tiers, have reconcilable candidate-attached tables',()=>{
 if(!process.env.V14_STAGE1)return;
 assert.equal(real.length,30);
 let checked=0;
 for(const e of real){
  const i=e.request.input,own=i.evidence.find(x=>x.id==='board').value.ownSeat;
  const base=i.evidence.find(x=>x.id==='board').value.scores[own].points;
  const rank=i.evidence.find(x=>x.id==='rank-scenarios').value;
  for(const opponent of [0,1,2,3].filter(x=>x!==own)){
   for(let tier=0;tier<rank.ron.filter(r=>r.other===opponent).length;tier++){
    const idx=rank.ron.findIndex(r=>r.other===opponent)+tier;
    const t=buildConditionalTable(e,spec(e,opponent,idx));
    assert.equal(t.version,TABLE_VERSION);
    assert.equal(t.hypotheticalRon.ownWin.ownPointChange,t.hypotheticalRon.ownWin.pointsAfter[own]-base);
    assert.equal(t.hypotheticalRon.ownDealIn.ownPointChange,t.hypotheticalRon.ownDealIn.pointsAfter[own]-base);
    assert.equal(t.symbolicComparison.outcome,'undetermined_without_probabilities');
    assert.equal(t.certification,'hypothetical_public_arithmetic_only_not_ev_or_b3_b4_certification');
    assert.equal(verifyConditionalTable(e,t).tacticalOutcome,'not_certified');
    checked++;
   }
  }
 }
 assert.equal(checked,450);
});
test('refuses fabricated probability/point scenario, mismatched opponent, altered candidate and tampered input',()=>{
 if(!process.env.V14_STAGE1)return;
 const e=real[0],s=spec(e),t=buildConditionalTable(e,s);
 for(const attack of [
  x=>x.hypotheticalRon.ownWin.ownPointChange+=1000,
  x=>x.hypotheticalRon.ownDealIn.pointsAfter[0]+=1000,
  x=>x.symbolicComparison.outcome='chosen_should_push',
  x=>x.symbolicComparison.coefficients.gain+=10,
  x=>x.candidates[0].seatSafety[0].ownRiverGenbutsu=!x.candidates[0].seatSafety[0].ownRiverGenbutsu,
  x=>x.specification.opponent=x.specification.opponent===0?2:0,
  x=>x.candidates[1].key=x.candidates[0].key,
  x=>x.predictedRonRate=.66,
 ]){
  const bad=clone(t);attack(bad);assert.throws(()=>verifyConditionalTable(e,bad),/conditional-table/);
 }
 const wrongInput=clone(e);wrongInput.request.input.evidence[0].value.honba=7;
 assert.throws(()=>buildConditionalTable(wrongInput,s),/untrusted case/);
 const wrongSpec=clone(s);wrongSpec.recommendation=wrongSpec.alternative;
 assert.throws(()=>buildConditionalTable(e,wrongSpec),/identical candidate/);
});
test('genbutsu is scoped to one opponent ron only, not to all players or a risk probability',()=>{
 if(!process.env.V14_STAGE1)return;
 const e=real[0],t=buildConditionalTable(e,spec(e));
 for(const c of t.candidates){
  for(const o of c.seatSafety){
   assert(['safe_from_this_opponent_ron_by_own_river_only','no_genbutsu_certificate'].includes(o.interpretation));
  }
 }
 assert.equal(t.symbolicComparison.utility,'own_point_change_only_no_terminal_rank_utility');
 assert.equal(t.candidates.length,2);
});
