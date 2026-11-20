// Pilot only: manipulate exactly one observed opponent declaration and its mandatory
// points/stick effects. Both versions must replay using the same physical history.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {simulate} from './v14-engine-rollout-probe.mjs';
import {independentRequest} from '../../src/coach/v14-pilot-boundary.mjs';
import {loadEngine} from '../../src/coach/v14-public-calculations.mjs';
const rows=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const output=process.argv[3],engine=loadEngine(),began=performance.now(),reports=[],publicPairs=[];
for(const row of rows){
 const s=row.scene,own=s.ownSeat,opp=s.rivers.findIndex((r,i)=>i!==own&&r.riichi);
 if(opp<0)continue;
 const b=structuredClone(row);b.scene.rivers[opp].riichi=false;
 const marked=b.scene.rivers[opp].discards.filter(d=>d.riichi);assert.equal(marked.length,1);marked[0].riichi=false;
 const ev=b.scene.publicEvents.filter(e=>e.種類==='打牌'&&e.席===opp&&e.立直宣言);assert.equal(ev.length,1);ev[0].立直宣言=false;
 b.scene.kyotaku--;b.scene.scores[opp].points+=1000;
 const originalPointSum=s.scores.reduce((q,x)=>q+x.points,0)+1000*s.kyotaku;
 assert.equal(b.scene.scores.reduce((q,x)=>q+x.points,0)+1000*b.scene.kyotaku,originalPointSum);
 assert(b.scene.kyotaku>=0);
 const choices=row.actions.filter(a=>a.action<37).map(a=>a.details[0]),pair=[choices[0],choices.at(-1)];
 const legal=[],failures=[],runs=[];
 // All four available synthetic histories must validate; only first two continued.
 for(const [n,sample] of row.samples.entries()){
  try{
   const a=simulate(row,sample,null),c=simulate(b,sample,null);
   assert.deepEqual(a,c);legal.push(n);
  }catch(e){failures.push({sample:n,stage:'history',error:String(e).slice(0,300)});}
 }
 if(legal.length===row.samples.length&&legal.length){
  const idA='pilot-'+String(31+2*publicPairs.length).padStart(2,'0'),idB='pilot-'+String(32+2*publicPairs.length).padStart(2,'0');
  const rawA={id:row.decision,phase:'turn',scene:row.scene,actions:row.actions},rawB={id:row.decision,phase:'turn',scene:b.scene,actions:b.actions};
  const ea=independentRequest(rawA,idA,engine),eb=independentRequest(rawB,idB,engine);
  assert.deepEqual(ea.request.input.actions,eb.request.input.actions);
  publicPairs.push({a:ea,b:eb,lineage:{shard:row.shard,decision:row.decision,changedSeat:opp,intervention:'remove declaration and restore stake; same subsequent public actions',validatedHistories:legal.length}});
 }
 for(const n of legal.slice(0,2)){
  for(const policy of ['standard','attack','defense']){
   try{
    const a=pair.map(p=>simulate(row,row.samples[n],p,policy)),b2=pair.map(p=>simulate(b,row.samples[n],p,policy));
    runs.push({sample:n,policy,a,b:b2,deltaA:a[0].net-a[1].net,deltaB:b2[0].net-b2[1].net});
   }catch(e){failures.push({sample:n,policy,stage:'continuation',error:String(e).slice(0,300)});}
  }
 }
 reports.push({shard:row.shard,decision:row.decision,changedSeat:opp,pair,plannedHistory:row.samples.length,validHistory:legal.length,plannedRuns:Math.min(2,row.samples.length)*3,completedRuns:runs.length,failures,runs});
 console.log('CONTRAST',row.shard,legal.length,runs.length,JSON.stringify(failures),JSON.stringify(runs.map(r=>[r.policy,r.deltaA,r.deltaB])));
}
const result={status:'development_contrast_feasibility_not_tactical_labels',plannedCases:4,cases:reports.length,validPairs:publicPairs.length,plannedRuns:reports.reduce((n,r)=>n+r.plannedRuns,0),completedRuns:reports.reduce((n,r)=>n+r.completedRuns,0),elapsedSeconds:(performance.now()-began)/1000,reports,limitations:['only closed no-call history, opponent declaration removed','only two synthetic trajectories per case and continuation policy','not a calibrated posterior','attack and defense vary discard strategy only, not all behavior','arbitrary first/last public candidate not tactical definition','no Mortal counterfactual evaluation, no gold label or certification']};
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
fs.writeFileSync(process.argv[4],JSON.stringify(publicPairs,null,2)+'\n');
console.log(JSON.stringify({...result,reports:reports.map(({runs,...r})=>r)},null,2));
assert.equal(result.cases,4);assert.equal(result.validPairs,4);assert.equal(result.completedRuns,result.plannedRuns);
