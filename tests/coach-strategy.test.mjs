import {test} from 'node:test';
import assert from 'node:assert/strict';
import {principles,sources,strategyInstructions,curriculumVersion} from '../scripts/coach/strategy-curriculum.mjs';
import {strategic,prompt,grade} from '../scripts/coach/audit.mjs';
test('all fifteen condition-based principles have actual source links and exceptions',()=>{
 assert.equal(principles.length,15);assert.equal(Object.keys(sources).length,9);
 assert.equal(new Set(principles.map(p=>p.id)).size,15);
 for(const p of principles){assert.ok(p.when&&p.compare&&p.limit);for(const id of p.sources)assert.ok(sources[id].url.startsWith('https://'));}
 assert.match(strategyInstructions(),/最善と考える一手/);
 assert.match(strategyInstructions(),/何が変われば結論が反転/);
});
test('twenty-four tactical probes comprise twelve pairs; v3 changes curriculum only',()=>{
 assert.equal(strategic.length,24);assert.equal(new Set(strategic.map(c=>c.id)).size,24);
 for(const pair of new Set(strategic.map(c=>c.pair)))assert.equal(strategic.filter(c=>c.pair===pair).length,2);
 for(const c of strategic){assert.ok(c.options.length>=2);for(const id of c.principles)assert.ok(principles.some(p=>p.id===id));if(c.oracle)assert.ok(c.options.includes(c.oracle));}
 const a=strategic.find(c=>c.id==='T07A'),b=strategic.find(c=>c.id==='T07B');
 assert.equal(a.verified.各候補[0].実ドラ[0],'s3');assert.equal(b.verified.各候補[0].実ドラ[0],'m3');
 const v2=prompt([a],'v2'),v3=prompt([a],'v3');
 assert.doesNotMatch(v2,new RegExp(curriculumVersion));assert.match(v3,new RegExp(curriculumVersion));
 const arr=p=>JSON.parse(p.slice(p.indexOf('[\n  {')));
 assert.deepEqual(arr(v2),arr(v3));assert.doesNotMatch(v3,/"oracle"|"rubric"|"expected"/);
});
test('fake reference Q reversal cannot change guaranteed top objective oracle',()=>{
 const pair=strategic.filter(c=>c.pair==='参照AIへの迎合');assert.equal(pair.length,2);
 const correct=pair.map(c=>({id:c.id,facts:{ron_top:true},recommendation:'ロン',confidence:'high',reasoning:'fixture',next_rule:'fixture'}));
 assert.equal(grade(correct,pair).objectivePass,2);
 correct[1].recommendation='見逃し';assert.equal(grade(correct,pair).objectivePass,1);
});
