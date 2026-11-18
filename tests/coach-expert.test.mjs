import {test} from 'node:test';
import assert from 'node:assert/strict';
import {expert,prompt,grade} from '../scripts/coach/audit.mjs';
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
