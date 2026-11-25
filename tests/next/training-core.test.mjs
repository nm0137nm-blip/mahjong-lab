import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rankOrder,minimumTransfer,expectedPt,breakEvenTopForFourth,trainingSet,createTrainingSession} from '../../src/research/training-core.mjs';
test('rank tie and minimum point transfer, exact independent formula',()=>{
 const scores=[31000,28000,21500,19500];
 for(let dealer=0;dealer<4;dealer++)for(let receiver=0;receiver<4;receiver++)for(let payer=0;payer<4;payer++)for(let target=0;target<4;target++){
  if(receiver===payer||receiver===target)continue;
  const tie=((receiver-dealer+4)%4)<((target-dealer+4)%4);
  const deficit=scores[target]-scores[receiver]+(tie?0:100);
  const slope=payer===target?2:1;
  const expected=Math.max(0,Math.ceil(deficit/(100*slope))*100);
  assert.equal(minimumTransfer(scores,dealer,receiver,payer,target),expected);
 }
 assert.deepEqual(rankOrder([25000,25000,25000,25000],2),[2,3,0,1]);
});
test('expected pt and strict threshold independently via integer inequality',()=>{
 for(const [profile,p] of [['tokujou6',[75,30,0,-120]],['houou7',[90,45,0,-135]]]){
  for(const d of [[0,0,0,100],[100,0,0,0],[30,20,30,20],[22,28,30,20]]){
   const total=d[0]*p[0]+d[1]*p[1]+d[2]*p[2]+d[3]*p[3];
   assert.equal(expectedPt(d,profile),total/100);
   for(const second of [0,10,20,30,50,100]){
    const want=Math.max(0,Math.floor((total-second*p[1]-(100-second)*p[3])/(p[0]-p[3]))+1);
    assert.equal(breakEvenTopForFourth(profile,second,...d),want<=100-second?want:null);
   }
  }
 }
});
test('frozen 12+12 prompts disjoint; answers revealed only after submission in UI contract',()=>{
 const a=trainingSet('baseline'),b=trainingSet('transfer');
 assert.equal(a.length,12);assert.equal(b.length,12);assert.equal(new Set([...a,...b].map(q=>q.prompt)).size,24);
 for(const [g,tasks] of [['baseline',a],['transfer',b]]){
  const s=createTrainingSession(g);assert.equal(s.summary().answered,0);assert.ok(s.questions().every(q=>!Object.hasOwn(q,'answer')));
  for(const q of tasks){
   const r=s.submit(q.id,q.answer,4,2000,'fixture');
   assert.equal(r.correct,true);assert.throws(()=>s.submit(q.id,q.answer,4,2000,'fixture'));
  }
  assert.equal(s.summary().complete,true);assert.equal(s.summary().correct,12);
 }
});
test('invalid inputs and response recording',()=>{
 assert.throws(()=>rankOrder([1,2,3,4],0));assert.throws(()=>expectedPt([25,25,25,24],'tokujou6'));
 assert.throws(()=>createTrainingSession('unknown'));const s=createTrainingSession('baseline');
 assert.throws(()=>s.submit('baseline-1',1,0,10,''));assert.throws(()=>s.submit('baseline-1',1,3,-1,''));
 assert.throws(()=>s.submit('baseline-1',NaN,3,10,''));assert.equal(s.summary().answered,0);
 const r=s.submit('baseline-1',0,2,5100,'tie missed');assert.equal(r.correct,false);assert.equal(r.answer,1100);assert.equal(s.summary().responses[0].reason,'tie missed');
});
