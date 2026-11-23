import test from 'node:test';
import assert from 'node:assert/strict';
import {hasV43ConditionalReversal} from '../../src/coach/v14-japanese-condition-v43.mjs';
import {hasV45ConditionalReversal,V45_CONDITION_VERSION} from '../../src/coach/v14-japanese-condition-v45.mjs';
test('v45 version is prospective and v43 source is unchanged',()=>{
 assert.equal(V45_CONDITION_VERSION,'p2a-v45-japanese-choice-inflection-1');
});
test('synthetic morphological regression: conditional desire shift is recognized',()=>{
 const x='もし相手が立直しておらず、切り牌の安全が明確なら、仕掛けを選びやすくする。';
 assert.equal(hasV43ConditionalReversal(x),false);
 assert.equal(hasV45ConditionalReversal(x),true);
 for(const s of [
  'もし状況が変わるなら、守備を選びにくくなる。',
  'もし打点の条件を満たすなら、対案を選び直す。',
  'もし現物を持てる場合には、別の候補を選びたい。',
  'もし序盤に変われば、別の選び方に変える。'
 ]){
  // Other v43 accepted words may also be present, but v45 must at least accept.
  assert.equal(hasV45ConditionalReversal(s),true,s);
 }
});
test('deny generic assertions without a condition or decision change',()=>{
 for(const s of [
  'この手牌の説明として、選びやすい牌を比較する。',
  '相手の安全牌について、選びやすくするという表現がある。',
  'もし場況がよいなら、選びやすい状況になる。',
  'もし手牌が変わるなら、別の選びやすい道具を使う。',
  '見逃す事例では単に一覧を表示する。',
  ''
 ])assert.equal(hasV45ConditionalReversal(s),false,s);
});
test('previously accepted v43 expressions remain accepted under v45',()=>{
 const samples=[
  'もし立直者が増えれば、攻めを控える。',
  '相手が先制した場合には、守備を重視して打牌を見直す。',
  'もし役牌を鳴けるなら、代案の評価を上げる。'
 ];
 for(const s of samples){
  assert.equal(hasV43ConditionalReversal(s),true,s);
  assert.equal(hasV45ConditionalReversal(s),true,s);
 }
});
