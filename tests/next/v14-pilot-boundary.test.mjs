import test from 'node:test';
import assert from 'node:assert/strict';
import {independentRequest,lockIndependent,comparisonRequest,storeComparison} from '../../src/coach/v14-pilot-boundary.mjs';
const raw=()=>({id:'d-1',phase:'turn',scene:{snapshotVersion:2,round:'東1局',ownSeat:0,activeSeat:0,hand:['m1','m2','m3','m4','p1','p2','p3','p4','p5','s1','s2','s3','z1','z2'],drawn:'z2',selfMelds:[],dora:['s4'],remaining:69,honba:0,kyotaku:0,pendingReach:false,initialOrder:[0,1,2,3],scores:Array.from({length:4},()=>({points:25000})),rivers:Array.from({length:4},()=>({riichi:false,discards:[],melds:[]})),publicEvents:[{種類:'自摸',席:0}]},actions:[{action:0,details:['m1']},{action:1,details:['m2']}]});
const meta={provider:'test fixture',model:'mock schema only',version:'v1',temperature:null,seed:null,execution:'unit test not inference'};
const answer=()=>({recommendation:'a0-0',confidence:'low',claims:[{type:'hypothesis',seat:1,action:'a0-0',against:'a1-0',evidenceIds:['seat-1','own'],metric:'win',direction:'unknown',condition:'不明',falsifier:'不明',statement:'試験用'}],sections:{objective:'例',relative:'例',comparison:'例',tradeoff:'例',reversal:'例',lesson:'例'}});
function ref(e){return {pilotId:e.request.input.id,requestHash:e.requestHash,key:{id:'d-1',phase:'turn',model_sha256:'30381bf21389e2d25d3edf48fed11bf772336ef3daeee67d1bdae7fb9dd30cb4',best:0,q:Array.from({length:46},(_,i)=>i===0?1:i===1?0:null)}};}
test('independent physical projection invariant under injected future/model/choice and nested unknown values',()=>{
 const x=raw(),e=independentRequest(x,'pilot-01');
 Object.assign(x,{facts:{secret:'BAD'},reference:{q:[-101]},oracle:{hand:'BAD'},discard:'m1',mortalOpinion:{tile:'m2'}});Object.assign(x.scene,{ura:['z7'],wall:['m9'],privateHand:'BAD'});x.scene.publicEvents[0].牌='z7';x.actions[0].label='BAD';
 assert.deepEqual(independentRequest(x,'pilot-01'),e);assert(!JSON.stringify(e).includes('BAD'));assert(!JSON.stringify(e).includes('mortalOpinion'));
 assert.notEqual(independentRequest(x,'pilot-02').requestHash,e.requestHash);
});
test('visible physical count and exact red capacity',()=>{
 const x=raw();x.scene.hand=['m5','m5','m5','m5'];assert.throws(()=>independentRequest(x,'pilot-01'),/visible multiplicity/);
});
test('separate comparison and immutable first answer',()=>{
 const x=raw(),e=independentRequest(x,'pilot-01'),a=answer(),l=lockIndependent(e,a,meta),r=ref(e);
 a.recommendation='a1-0';assert.equal(l.record.answer.recommendation,'a0-0');
 const c=comparisonRequest(e,l,r,x,'a1-0');
 assert.equal(c.request.reference.recommendedAction,0);assert.equal(c.request.independent.record.answer.recommendation,'a0-0');
 assert.equal(storeComparison(e,l,c,{comparison:'試験'}).independentHash,l.recordHash);
 const wrong={...r,pilotId:'pilot-02'};assert.throws(()=>comparisonRequest(e,l,wrong,x),/reference scope/);
 const c2=structuredClone(c);c2.request.input.evidence[0].value.round='南4局';assert.throws(()=>storeComparison(e,l,c2,{comparison:'試験'}),/integrity/);
 l.record.answer.recommendation='a1-0';assert.throws(()=>comparisonRequest(e,l,r,x),/integrity/);
});
test('fail closed schema and illegal actions, no tactical score awarded for mock',()=>{
 const e=independentRequest(raw(),'pilot-01');
 for(const fn of [a=>a.recommendation='a99-0',a=>a.claims[0].evidenceIds=['nonexistent'],a=>a.claims[0].seat=5,a=>a.claims[0].q=1,a=>a.sections.hidden='x']){
  const a=answer();fn(a);assert.throws(()=>lockIndependent(e,a,meta),/invalid/);
 }
});
