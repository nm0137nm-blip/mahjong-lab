import test from 'node:test';
import assert from 'node:assert/strict';
import {factsOnly,attachMortalReference} from '../../src/coach/p2a-facts-only.mjs';
const d=(tile,called=false)=>({tile,tsumogiri:false,riichi:false,called});
const base=()=>({id:'case-1',phase:'turn',scene:{snapshotVersion:2,round:'南4局',ownSeat:1,activeSeat:1,hand:['m0','m5'],drawn:'m5',selfMelds:[],dora:['p4'],remaining:10,honba:1,kyotaku:2,pendingReach:false,initialOrder:[2,1,3,0],scores:[{points:25000},{points:25000},{points:26000},{points:24000}],rivers:[{riichi:true,melds:[],discards:[d('m5',true)]},{riichi:false,melds:[],discards:[]},{riichi:false,melds:[],discards:[d('m0')]},{riichi:false,melds:[],discards:[]}],publicEvents:[{種類:'自摸',席:0,牌:'z7'},{種類:'打牌',席:0,牌:'m5',ツモ切り:true,立直宣言:false}]},actions:[{action:34,details:['m0']},{action:4,details:['m5','m5_']},{action:37,details:['立直']}]});
const key=()=>({id:'case-1',phase:'turn',model_sha256:'30381bf21389e2d25d3edf48fed11bf772336ef3daeee67d1bdae7fb9dd30cb4',best:4,q:Array.from({length:46},(_,i)=>i===4?1:i===34?1:i===37?.99:null)});
test('strict projection ignores private, derived and injected claims',()=>{
 const b=base(),expected=factsOnly(b),evil=structuredClone(b);
 Object.assign(evil,{facts:{risk:0.93},oracle:{hand:'SECRET'},reference:{q:999},prediction:9000});
 Object.assign(evil.scene,{privateHand:'SECRET',wall:['z7'],ura:['z7'],futureEvents:['SECRET']});
 evil.scene.rivers[0].discards[0].private='SECRET';evil.scene.publicEvents[0].牌='m1';evil.actions[0].label='SECRET';
 assert.deepEqual(factsOnly(evil),expected);
 assert.equal(expected.externalEstimate.status,'suppressed_unvalidated_P1');
 assert.equal(expected.publicFacts.rank,2);
 assert.deepEqual(expected.publicFacts.ownRiverGenbutsu,[{action:34,ownRiverSameTypeSeats:[0,2]},{action:4,ownRiverSameTypeSeats:[0,2]}]);
 assert.equal(expected.publicFacts.events[0].牌,undefined);
});
test('pending riichi rank withheld; tie order honored',()=>{
 let b=base();b.scene.scores[2].points=25000;
 assert.equal(factsOnly(b).publicFacts.rank,2);
 b.scene.pendingReach=true;assert.equal(factsOnly(b).publicFacts.rank,null);
});
test('reaction and special action groups',()=>{
 let b=base();b.phase='reaction';b.reaction={from:0,tile:'m3_*'};b.actions=[{action:38,details:['m3-45']},{action:41,details:['m333-']},{action:42,details:['m3333-']},{action:43,details:['ロン']},{action:45,details:['スルー']}];
 assert.equal(factsOnly(b).publicFacts.legalActions.length,5);
 b=base();b.actions=[{action:42,details:['m5555','m555-0']},{action:43,details:['ツモ']},{action:44,details:['九種九牌']}];
 assert.equal(factsOnly(b).publicFacts.legalActions.length,3);
});
test('invalid public records fail closed',()=>{
 for(const mutate of [b=>b.scene.rivers[0].discards[0].tile='SECRET',b=>b.scene.publicEvents.push({種類:'future',席:0}),b=>b.actions[0].details=['m5'],b=>b.actions.push(b.actions[0]),b=>b.scene.pendingReach='false',b=>b.scene.ownSeat=4,b=>b.scene.dora=['z0']]){
  const b=base();mutate(b);assert.throws(()=>factsOnly(b),/invalid public facts/);
 }
});
test('model group reference separate; identity/mask/rank verified; no Q leaked',()=>{
 const f=factsOnly(base()),k=key();let r=attachMortalReference(f,k,'case-1');
 assert.equal(r.mortalReference.status,'matched_group_only');
 assert.deepEqual(r.mortalReference.tiedBest,[4,34]);
 assert.deepEqual(r.mortalReference.orderedActions,[4,34,37]);
 assert.equal(JSON.stringify(r).includes('"q"'),false);
 for(const mutate of [k=>k.id='old',k=>k.phase='reaction',k=>k.model_sha256='wrong',k=>k.q[0]=0,k=>k.best=37,k=>k.q[4]=Infinity]){
  const k1=key();mutate(k1);assert.equal(attachMortalReference(f,k1,'case-1').mortalReference.status,'unavailable');
 }
});
