import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyStructuredCondition as v} from '../../src/coach/v14-structured-condition-v46.mjs';
const input={actions:[{key:'a1-0'},{key:'a2-0'}],evidence:[
 {id:'board',value:{ownSeat:2}},
 {id:'public-value-0',value:{riichi:true,meldCount:0,points:25000,pointGapFromOwn:1000}}
]};
const base=()=>({predicates:[{factId:'opponent:seat0:riichi',op:'eq',value:false}],
 effect:{mode:'reweight',target:'alternative',direction:'increase'},
 explanation:'親の立直がなければ、鳴く選択へ判断を傾ける。'});
test('natural Japanese not a keyword gate; explicit reweight not an explicit switch',()=>{
 const r=v(input,0,base());assert.equal(r.explicitSwitch,false);
 assert.equal(r.semanticCertification,false);assert.equal(r.witness[0].current,true);
});
test('actual switch is distinguished from weighting',()=>{
 const c=base();c.effect={mode:'switch',from:'recommendation',to:'alternative'};
 assert.equal(v(input,0,c).explicitSwitch,true);
});
test('reject current state, wrong seat, unknown facts, type mismatch, duplicate, vague effect',()=>{
 for(const mutate of [
 c=>c.predicates[0].value=true,c=>c.predicates[0].factId='opponent:seat1:riichi',
 c=>c.predicates[0].factId='opponent:seat0:tenpaiProbability',
 c=>c.predicates[0].value=0,c=>c.predicates.push({...c.predicates[0]}),
 c=>c.effect={mode:'reassess'},c=>c.effect={mode:'switch',from:'recommendation',to:'recommendation'},
 c=>c.explanation='',c=>c.predicates[0].op='gt'
 ]){const c=base();mutate(c);assert.throws(()=>v(input,0,c));}
});
test('conjunctive threshold is source-bound, not a tactical certificate',()=>{
 const c=base();c.predicates.push({factId:'opponent:seat0:meldCount',op:'gte',value:2});
 assert.equal(v(input,0,c).witness.length,2);
 c.predicates[1].value=-1;assert.throws(()=>v(input,0,c));
 assert.throws(()=>v(input,2,base()));
});
