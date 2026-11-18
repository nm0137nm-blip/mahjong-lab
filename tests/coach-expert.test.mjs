import {test} from 'node:test';
import assert from 'node:assert/strict';
import {expert,prompt,grade,twoDrawProgress} from '../scripts/coach/audit.mjs';
test('expert lesson references are not passed to the model',()=>{
 assert.equal(expert.length,5);
 for(const c of expert){
   assert.ok(c.source.startsWith('https://'));assert.ok(c.coverage);
   assert.ok(c.options.includes(c.expertRecommendation));
   const p=prompt([c],'v3');
   assert.doesNotMatch(p,/"expertRecommendation"|"rubric"|"source"|"coverage"|"oracle"/);
 }
});
test('source diagram transcriptions produce legal engine shapes',()=>{
 const pick=id=>expert.find(c=>c.id===id);
 assert.equal(pick('X01').verified.shanten,0);
 assert.deepEqual(pick('X01').verified.waits,['s2','s5']);
 assert.equal(pick('X04').verified.各候補[0].実ドラ[0],'p2');
 assert.equal(pick('X05').verified.各候補[0].実ドラ[0],'m5');
 // Expert recommendation is a benchmark, never the only acceptable
 // strategic answer for a partially transcribed scene.
 const c=pick('X04'),r={id:c.id,facts:c.expected,recommendation:'打z6',confidence:'medium',reasoning:'fixture',next_rule:'fixture'};
 assert.equal(grade([r],[c]).objectivePass,1);
});

test('reconstructed user decision: compute two-draw paths, not just equal immediate ukeire',()=>{
 const results=['m1','s1','m2'].map(p=>twoDrawProgress('m1245999p45s18899',p,['s2']));
 for(const r of results){assert.equal(r.baseShanten,2);assert.equal(r.firstUkeire,20);assert.equal(r.orderedPaths,r.paths.reduce((n,p)=>n+p.firstCopies*p.secondCopies,0));assert.ok(r.paths.every(p=>p.nextShanten===1));}
 console.log('COACH_TWO_DRAW_DIAGNOSTIC '+JSON.stringify(results));
});
