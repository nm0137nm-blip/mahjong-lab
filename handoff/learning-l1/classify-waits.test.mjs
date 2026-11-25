import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyStructuralWaits as classify} from './classify-waits.mjs';
const counts=xs=>{const a=Array(34).fill(0);for(const x of xs)a[x]++;return a};
const f=tail=>counts([9,10,11,18,19,20,27,27,27,28,28,...tail]);
const examples=[
['ryanmen',f([1,2]),0,'ryanmen'],['ryanmen other',f([1,2]),3,'ryanmen'],
['penchan',f([0,1]),2,'penchan'],['penchan reverse',f([7,8]),6,'penchan'],
['kanchan',f([3,5]),4,'kanchan'],
['shanpon',counts([9,10,11,18,19,20,27,27,27,28,28,29,29]),28,'shanpon'],
['tanki',counts([0,1,2,9,10,11,18,19,20,27,27,27,28]),28,'tanki'],
['chiitoitsu',counts([0,0,3,3,6,6,10,10,13,13,20,20,28]),28,'chiitoitsu'],
['kokushi',counts([0,8,9,17,18,26,27,28,29,30,31,32,33]),33,'kokushi']];
for(const [n,c,t,kind] of examples)test(n,()=>assert.ok(classify(c).waits.some(x=>x.tile===t&&x.types.includes(kind))));
test('own kan blocks four copies',()=>{const r=classify(counts([1,2,9,10,11,18,19,20,28,28]),counts([0,0,0,0]),1);assert.ok(!r.waits.some(x=>x.tile===0)&&r.waits.some(x=>x.tile===3))});
test('kokushi thirteen waits',()=>assert.equal(classify(counts([0,8,9,17,18,26,27,28,29,30,31,32,33])).waits.length,13));
test('reject bad count',()=>assert.throws(()=>classify(Array(34).fill(0))));
