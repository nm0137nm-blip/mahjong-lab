import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createV3IndependentDevelopmentRequest,verifyV3IndependentDevelopmentAnswer,makeV3SyntheticAnswer} from '../../src/coach/v14-independent-request-v3.mjs';
import {createV3PublicContrastFixture,verifyV3PublicContrast} from '../../src/coach/v14-evidence-proof-v3.mjs';
const sources=process.env.V14_FOLLOWUP_PUBLIC?JSON.parse(fs.readFileSync(process.env.V14_FOLLOWUP_PUBLIC,'utf8')):[];
const sha=(x)=>JSON.stringify(x);const clone=x=>structuredClone(x);
function choice(i,a){
 const c=i.evidence.find(x=>x.id==='calc-'+a.key)?.value;
 return {key:a.key,afterCallDiscard:c?.afterCallDiscards?.[0]?.discard??null};
}
function fixture(s,a,b){
 const p=createV3IndependentDevelopmentRequest(s),i=p.request.input;
 const proof=createV3PublicContrastFixture(p,choice(i,a),choice(i,b));
 return {p,proof,answer:makeV3SyntheticAnswer(p,proof)};
}
test('frozen 36 independent public scenes: all legal decision types have a v3 feasible comparison',()=>{
 if(!sources.length)return;
 assert.equal(sources.length,36);
 let riichi=0,call=0,discard=0,terminal=0;
 for(const s of sources){
  const i=s.request.input;let a,b;
  const ri=i.actions.find(x=>x.group===37);
  const pass=i.actions.find(x=>x.group===45);
  const win=i.actions.find(x=>x.group===43);
  if(ri){
   a=ri;b=i.actions.find(x=>x.group<=36&&x.detail===ri.detail.slice(3));
   assert(b,'same-tile dama option must exist for '+i.id);riichi++;
  }else if(pass){
   a=win??i.actions.find(x=>[38,39,40,41,42].includes(x.group));b=pass;call++;
   if(win)terminal++;
  }else{
   [a,b]=i.actions.filter(x=>x.group<37).slice(0,2);
   assert(a&&b);discard++;
  }
  const {p,proof,answer}=fixture(s,a,b);
  const checked=verifyV3IndependentDevelopmentAnswer(p,answer);
  assert.equal(checked.publicFacts,'verified');
  assert.equal(checked.semanticQuality,'not_certified');
  if(ri){assert.equal(checked.distinctVerifiableDifferences>=1,true);
   assert.equal(proof.comparisons.find(x=>x.type==='actionKind').relation,'different');
   assert(proof.comparisons.filter(x=>x.type==='shape').every(x=>x.relation==='same'),
     'same discard must not fabricate a shape improvement');}
  if(pass){assert(checked.distinctVerifiableDifferences>=1);
   if(win)assert.equal(proof.comparisons.some(x=>x.type==='shape'),false,
      'terminal ron must not cite unavailable future shape');}
 }
 assert.deepEqual({riichi,call,discard,terminal},{riichi:12,call:12,discard:12,terminal:1});
});
test('same shanten, ukeire, dora still supports a concrete PUBLIC seat-safety distinction instead of a fictitious metric',()=>{
 if(!sources.length)return;
 const s=sources.find(x=>x.request.input.id==='pilot-41'),i=s.request.input;
 const a=i.actions.find(x=>x.key==='a6-0'),b=i.actions.find(x=>x.key==='a23-0');
 const {p,proof}=fixture(s,a,b);
 assert(proof.comparisons.filter(x=>x.type==='shape').every(x=>x.relation==='same'));
 const g={type:'seatGenbutsu',seat:1,recommended:false,alternative:true,relation:'different'};
 proof.comparisons.push(g);
 const checked=verifyV3PublicContrast(p,proof);
 assert.equal(checked.meaningfullyDistinctPublicFacts,1);
 assert.equal(checked.tacticChoice,'not_certified');
 for(const mutation of [
  v=>v.comparisons.at(-1).seat=0,
  v=>v.comparisons.at(-1).recommended=true,
  v=>v.comparisons.at(-1).relation='same',
  v=>v.comparisons[1].recommended+=1,
  v=>v.comparisons.push({type:'probability',value:0.25}),
  v=>v.comparisons.at(-1).estimatedDanger=0.22
 ]){const x=clone(proof);mutation(x);assert.throws(()=>verifyV3PublicContrast(p,x),/v3-proof/);}
});
test('a terminal ron-vs-pass claim has no invented post-win efficiency; false shape and candidate swapping fail closed',()=>{
 if(!sources.length)return;
 const s=sources.find(x=>x.request.input.id==='pilot-63'),i=s.request.input;
 const a=i.actions.find(x=>x.group===43),b=i.actions.find(x=>x.group===45);
 const {p,proof,answer}=fixture(s,a,b);
 assert.equal(proof.comparisons.length,1);
 assert.equal(proof.comparisons[0].recommended,'win');
 assert.equal(proof.comparisons[0].alternative,'pass');
 assert.equal(verifyV3IndependentDevelopmentAnswer(p,answer).distinctVerifiableDifferences,1);
 const bad=clone(proof);
 bad.comparisons.push({type:'shape',metric:'shanten',recommended:0,alternative:0,relation:'same'});
 assert.throws(()=>verifyV3PublicContrast(p,bad),/shape values absent/);
 const wrong=clone(proof);wrong.alternative.key=a.key;
 assert.throws(()=>verifyV3PublicContrast(p,wrong),/identical concrete choices|false action-kind comparison/);
});
test('conditional point claims and hypothetical rank are audited without converting either to win rate or tactical oracle',()=>{
 if(!sources.length)return;
 const s=sources.find(x=>x.request.input.id==='pilot-43'),i=s.request.input;
 const a=i.actions.find(x=>x.group<=36&&i.evidence.find(e=>e.id==='calc-'+x.key)?.value?.conditionalNormalWins?.length);
 const b=i.actions.find(x=>x.group<=36&&x.key!==a.key);
 const {p,proof}=fixture(s,a,b);
 const calc=i.evidence.find(x=>x.id==='calc-'+a.key).value;
 const win=calc.conditionalNormalWins.find(x=>x.tsumo),tile=win.tile,mode='tsumo';
 function c(key){
  const v=i.evidence.find(x=>x.id==='calc-'+key).value;
  const m=v.conditionalNormalWins?.find(x=>x.tile===tile)?.[mode];
  return m?{status:'conditionally_scored',basePoints:m.basePoints,yaku:[...m.yaku]}:
   v.conditionalNormalWins?.find(x=>x.tile===tile)?{status:'no_scored_win_under_assumptions'}:{status:'not_supplied'};
 }
 proof.comparisons.push({type:'conditionalPoints',tile,mode,recommended:c(a.key),
  alternative:c(b.key),relation:sha(c(a.key))===sha(c(b.key))?'same':'different'});
 const board=i.evidence.find(x=>x.id==='board').value,sc=i.evidence.find(x=>x.id==='rank-scenarios').value;
 const r=sc.ron[0],own=board.ownSeat;
 proof.comparisons.push({type:'rankScenario',ronIndex:0,opponent:r.other,ownWinRank:r.winRanks[own],
  ownDealInRank:r.lossRanks[own],winPointChange:r.winPoints[own]-board.scores[own].points,
  dealInPointChange:r.lossPoints[own]-board.scores[own].points});
 const checked=verifyV3PublicContrast(p,proof);
 assert.equal(checked.publicSettlementContextFacts,1);
 assert.equal(checked.probability,'not_calibrated');
 const wrong=clone(proof);wrong.comparisons.find(x=>x.type==='rankScenario').ownWinRank=4;
 assert.throws(()=>verifyV3PublicContrast(p,wrong),/false rank scenario projection/);
 const wrongScore=clone(proof);wrongScore.comparisons.find(x=>x.type==='conditionalPoints').recommended.basePoints=99999;
 assert.throws(()=>verifyV3PublicContrast(p,wrongScore),/false conditional score/);
});
test('no distinct measured public difference must NOT be upgraded to tactical-certainty',()=>{
 if(!sources.length)return;
 const s=sources.find(x=>x.request.input.id==='pilot-41'),i=s.request.input;
 const a=i.actions.find(x=>x.key==='a6-0'),b=i.actions.find(x=>x.key==='a23-0');
 const {p,proof}=fixture(s,a,b);
 const r=verifyV3PublicContrast(p,proof);
 assert.equal(r.meaningfullyDistinctPublicFacts,0);
 assert.equal(r.contrastStatus,'no_distinguishing_public_fact_established');
 assert.equal(r.tacticChoice,'not_certified');
});
