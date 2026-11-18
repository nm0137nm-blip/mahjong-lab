import {test} from 'node:test';
import assert from 'node:assert/strict';
import {relative,prompt,grade} from '../scripts/coach/audit.mjs';
import {relativeInstructions} from '../scripts/coach/relative-value.mjs';
test('relative value layer compares same own hand in six contrast pairs',()=>{
 assert.equal(relative.length,12);
 assert.equal(new Set(relative.map(c=>c.pair)).size,6);
 for(const pair of new Set(relative.map(c=>c.pair)))assert.equal(relative.filter(c=>c.pair===pair).length,2);
 assert.match(relativeInstructions,/他家3人/);assert.match(relativeInstructions,/被ツモ/);assert.match(relativeInstructions,/テンパイまでに押す牌/);
 const a=relative.find(c=>c.id==='RV01A'),b=relative.find(c=>c.id==='RV01B');
 assert.equal(a.scene.自手,b.scene.自手);assert.deepEqual(a.scene.点棒,b.scene.点棒);
 assert.notEqual(a.scene.他家,b.scene.他家);
 const p3=prompt([a],'v3'),p4=prompt([a],'v4');
 assert.doesNotMatch(p3,/相対的な手の価値：必須判断手順/);assert.match(p4,/相対的な手の価値：必須判断手順/);
 const arr=p=>JSON.parse(p.slice(p.indexOf('[\n  {')));
 assert.deepEqual(arr(p3),arr(p4));
 assert.doesNotMatch(p4,/"rubric"|"oracle"|"expected"/);
});
test('relative-value grading checks fields but never substitutes for tactical review',()=>{
 const c=relative.find(x=>x.id==='RV06A');
 const answer={id:c.id,facts:c.expected,recommendation:'候補A',confidence:'high',reasoning:'fixture',next_rule:'fixture',relative_value:'高い',main_threat:'fixture',tradeoff:'fixture',reversal_condition:'fixture'};
 const good=grade([answer],[c]);assert.equal(good.objectivePass,1);assert.equal(good.manualReviewPending,1);
 delete answer.main_threat;assert.equal(grade([answer],[c]).objectivePass,0);
 answer.main_threat='fixture';answer.recommendation='候補B';assert.equal(grade([answer],[c]).objectivePass,0);
});
test('relative rank arithmetic and threat facts have checked reference values',()=>{
 const pick=id=>relative.find(c=>c.id===id);
 for(const id of ['RV03A','RV03B']){
   const c=pick(id);assert.equal(c.expected.self_if_deal_in,c.scene.点棒.南-5200);assert.equal(c.expected.west_if_win,c.scene.点棒.西+5200);
   assert.equal(c.expected.self_rank,1+Object.values(c.scene.点棒).filter(p=>p>c.scene.点棒.南).length);
 }
 for(const id of ['RV05A','RV05B']){
   const c=pick(id);assert.equal(c.expected.self_after_parent_mangan_tsumo,22000-4000);
   assert.equal(c.expected.parent_after_mangan_tsumo,c.scene.他家.親+12000+1000);
 }
 assert.equal(pick('RV04A').expected.visible_dora_han,0);assert.equal(pick('RV04B').expected.visible_dora_han,3);
});
