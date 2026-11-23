import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {buildV3CandidateValueTable,verifyV3CandidateValueTable} from '../../src/coach/v14-conditional-table-v3.mjs';
const source=process.env.V14_FOLLOWUP_PUBLIC;
const cases=source?JSON.parse(fs.readFileSync(source,'utf8')):[];
const clone=x=>structuredClone(x);
const choose=(i,a)=>{
 const calc=i.evidence.find(e=>e.id==='calc-'+a.key).value;
 return {key:a.key,afterCallDiscard:calc.afterCallDiscards?.[0]?.discard??null};
};
export function allTables(){
 return cases.map(s=>{
  const i=s.request.input,acts=i.actions;
  const ri=acts.find(a=>a.group===37),pass=acts.find(a=>a.group===45);
  let a,b;
  if(ri){a=ri;b=acts.find(x=>x.group<37&&x.detail===ri.detail.slice(3));}
  else if(pass){a=acts.find(x=>x.group===43)??acts.find(x=>x.group>=38&&x.group<=42);b=pass;}
  else{[a,b]=acts.filter(x=>x.group<37).slice(0,2);}
  assert(a&&b,'concrete pair missing '+i.id);
  const own=i.evidence.find(e=>e.id==='board').value.ownSeat;
  const spec={recommendation:choose(i,a),alternative:choose(i,b),opponent:(own+1)%4};
  return buildV3CandidateValueTable(s,spec);
 });
}
test('36 natural dev public decision pairs have candidate-specific conditional shapes and independent hypothetical rank context',()=>{
 if(!cases.length)return;
 assert.equal(cases.length,36);
 const out=allTables();assert.equal(out.length,36);
 let scored=0,unknown=0,negativeOpenHan=0;
 for(let n=0;n<36;n++){
  const t=out[n],v=verifyV3CandidateValueTable(cases[n],t);
  assert.equal(v.actualProbabilityAndEV,'unknown');
  assert.equal(t.symbolicCandidateComparison.verdict,'not_calculated_no_EV_no_rank_utility');
  assert.equal(t.sensitivityOwnRonLossByTier.length,4);
  assert(!('winningProbability' in t));assert(!('expectedValue' in t));
  for(const c of t.candidates){
   scored+=c.ronWinningForms.scored.length;
   if(c.ronWinningForms.status==='not_quantified')unknown++;
   assert.equal(c.tsumoWinningForms.rankSimulation,'not_derived_no_payer_distribution');
  }
  negativeOpenHan+=Number(t.opponent.guaranteedVisibleHanIfAnyLegalWin<0);
 }
 assert.equal(negativeOpenHan,0);
 assert(scored>0);
 assert(unknown>0);
});
test('candidate win, public exposed han, opponent rank and loss-tier facts cannot be tampered',()=>{
 if(!cases.length)return;
 const ts=allTables(),sourceIndex=ts.findIndex(x=>x.candidates.some(c=>c.ronWinningForms.scored.length));
 assert(sourceIndex>=0);
 const t=ts[sourceIndex],s=cases[sourceIndex];
 const changes=[
  v=>v.opponent.exposedDoraHan++,
  v=>v.opponent.publicPointGapFromOwn++,
  v=>v.sensitivityOwnRonLossByTier[0].ownRankAfter=4,
  v=>v.sensitivityOwnRonLossByTier[1].illustrativeRonDefen=999,
  v=>v.candidates.find(c=>c.ronWinningForms.scored.length).ronWinningForms.scored[0].calculatedDefen++,
  v=>v.symbolicCandidateComparison.verdict='verified_expected_profit'
 ];
 for(const m of changes){const altered=clone(t);m(altered);assert.throws(()=>verifyV3CandidateValueTable(s,altered),/candidate score, opponent seat or rank table differs/);}
});
test('followup 36 candidate tables may be exported for independent Python audit, no new model execution',()=>{
 if(!cases.length)return;
 const out=allTables();
 if(process.env.V14_V3_CANDIDATE_TABLE_OUTPUT){
  const dest=path.resolve(process.env.V14_V3_CANDIDATE_TABLE_OUTPUT);
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.writeFileSync(dest,JSON.stringify(out,null,2)+'\n');
 }
 assert.equal(out.length,36);
});
