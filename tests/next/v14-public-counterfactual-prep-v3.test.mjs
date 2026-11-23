import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {prepareV3DevelopmentCounterfactualPairs} from '../../src/coach/v14-public-counterfactual-prep-v3.mjs';
const source=process.env.V14_FOLLOWUP_PUBLIC;
const cases=source?JSON.parse(fs.readFileSync(source,'utf8')):[];
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const get=(i,k)=>i.evidence.find(x=>x.id===k)?.value;
const clone=x=>structuredClone(x);
const sum=b=>b.scores.reduce((v,x)=>v+x.points,0)+b.kyotaku*1000;
function reconstructRank(points,order,seat){
 return 1+points.filter((x,i)=>i!==seat&&(x>points[seat]||x===points[seat]&&
  order.indexOf(i)<order.indexOf(seat))).length;
}
test('exactly 8 preregistered public counterfactuals, four reach escrow and four prior-round score alternatives; never invent changed/maintained Mortal labels',()=>{
 if(!source)return;
 const p=prepareV3DevelopmentCounterfactualPairs(cases);
 assert.equal(p.pairCount,8);
 assert.equal(p.pairs.length,8);
 assert.equal(new Set(p.pairs.map(x=>x.sourceCaseId)).size,8);
 assert.equal(p.pairs.filter(x=>x.kind==='riichi_escrow').length,4);
 assert.equal(p.pairs.filter(x=>x.kind==='prior_round_points').length,4);
 assert.equal(p.pairs.some(x=>x.sourceCaseId==='pilot-48'),false);
 for(const x of p.pairs){
  assert.equal(x.labelStatus,'NO_MORTAL_REPLAY_NO_CHANGE_OR_MAINTAIN_GROUP_ASSIGNED');
  assert.equal(sha(x.baseline.request),x.baseline.requestHash);
  assert.equal(sha(x.alternative.request),x.alternative.requestHash);
  assert.notEqual(x.baseline.requestHash,x.alternative.requestHash);
  const a=x.baseline.request.input,b=x.alternative.request.input;
  assert.deepEqual(a.actions,b.actions);
  assert.deepEqual(get(a,'visible'),get(b,'visible'));
  assert.deepEqual(get(a,'own'),get(b,'own'));
  assert.equal(sum(get(a,'board')),sum(get(b,'board')));
  assert.equal(get(b,'board').scores.some(s=>s.points<0),false);
  assert.equal(get(b,'rank-scenarios').ron.length,15);
  assert.equal(get(b,'rank-scenarios').tsumo.length,12);
  for(let seat=0;seat<4;seat++)if(seat!==get(b,'board').ownSeat){
   const own=get(b,'board').ownSeat,scores=get(b,'board').scores;
   assert.equal(get(b,'public-value-'+seat).pointGapFromOwn,scores[seat].points-scores[own].points);
  }
  for(const r of get(b,'rank-scenarios').ron){
   assert.deepEqual(r.winRanks,r.winPoints.map((_,seat)=>reconstructRank(r.winPoints,get(b,'board').initialOrder,seat)));
   assert.deepEqual(r.lossRanks,r.lossPoints.map((_,seat)=>reconstructRank(r.lossPoints,get(b,'board').initialOrder,seat)));
  }
  if(x.kind==='riichi_escrow'){
   const aa=get(a,'board'),bb=get(b,'board');
   assert.equal(aa.kyotaku,bb.kyotaku+1);
   assert.equal(bb.scores[x.changedSeat].points,aa.scores[x.changedSeat].points+1000);
   assert.equal(get(a,'seat-'+x.changedSeat).riichi,true);
   assert.equal(get(b,'seat-'+x.changedSeat).riichi,false);
   const reachA=get(a,'history').filter(z=>z.種類==='打牌'&&z.席===x.changedSeat&&z.立直宣言);
   const reachB=get(b,'history').filter(z=>z.種類==='打牌'&&z.席===x.changedSeat&&z.立直宣言);
   assert.equal(reachA.length,1);assert.equal(reachB.length,0);
  }else{
   const aa=get(a,'board'),bb=get(b,'board'),own=aa.ownSeat;
   assert.equal(bb.kyotaku,aa.kyotaku);
   assert.equal(bb.scores[own].points,aa.scores[own].points-3900);
   assert.equal(bb.scores[x.changedSeat].points,aa.scores[x.changedSeat].points+3900);
   assert.notEqual(aa.round,'東1局');
   assert.deepEqual(get(a,'history'),get(b,'history'));
  }
 }
});
test('mutating frozen source hash or the public rank record rejects preparation before any Mortal or ChatGPT calls',()=>{
 if(!source)return;
 const original=clone(cases);
 original[0].requestHash='tampered';
 assert.throws(()=>prepareV3DevelopmentCounterfactualPairs(original),/untrusted public source/);
 const other=clone(cases);
 other[0].request.input.actions[0].key='fake action';
 assert.throws(()=>prepareV3DevelopmentCounterfactualPairs(other),/untrusted public source/);
});
