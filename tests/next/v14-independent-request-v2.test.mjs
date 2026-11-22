import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createV2IndependentDevelopmentRequest,verifyV2IndependentDevelopmentAnswer,ANSWER_VERSION} from '../../src/coach/v14-independent-request-v2.mjs';
import {makeArithmeticFixture} from '../../src/coach/v14-evidence-proof-v2.mjs';
const clone=x=>structuredClone(x);
const all=process.env.V14_STAGE1?JSON.parse(fs.readFileSync(process.env.V14_STAGE1,'utf8')):[];
function sample(e){
 const p=makeArithmeticFixture(e);
 return {version:ANSWER_VERSION,requestHash:e.requestHash,evidenceProof:p,
  importantSeats:[],
  uncertainSeats:[{seat:p.opponentObservations[0].seat,reason:'現状では相手の公開情報が選択の決定因子と証明できない。'}],
  educational:{reason:'自手の特定の牌姿数値のみが比較でき、最善手かどうかは未実証。',
   opponentTradeoff:'他家については観測できる事実と実際の危険の推定を区別する。',
   boundary:'未知の和了・放銃頻度により判断が変わる可能性がある。',
   lesson:'候補を数字だけで断定せず、相手の見えた情報と未知情報を分ける。'}};
}
test('stage1 public input is bitwise-equivalent; prompt changes never insert reference labels or hidden facts',()=>{
 if(!all.length)return;
 assert.equal(all.length,30);
 for(const legacy of all){
  const e=createV2IndependentDevelopmentRequest(legacy);
  assert.deepEqual(e.request.input,legacy.request.input);
  assert.equal(e.request.sourcePublicInputHash,createV2IndependentDevelopmentRequest(legacy).request.sourcePublicInputHash);
  assert.equal(e.request.stage,'independent-v2-dev');
  assert(!Object.hasOwn(e.request,'reference'));
  assert(!Object.hasOwn(e.request,'userAction'));
  const a=sample(e),result=verifyV2IndependentDevelopmentAnswer(e,a);
  assert.equal(result.calculationProof.deterministicGate,'pass');
  assert.equal(result.explanationQuality,'not_certified');
  assert.equal(result.noForcedAllThreeSeats,true);
 }
});
test('importance partition accepts no falsely forced opponent and rejects unsupported seat or duplicate',()=>{
 if(!all.length)return;
 const e=createV2IndependentDevelopmentRequest(all[0]),a=sample(e),seat=a.uncertainSeats[0].seat;
 const b=clone(a);b.uncertainSeats=[];b.importantSeats=[{seat,whyMatters:'この席が立直した場合には候補の価値を再検討する必要がある。',
   changeCondition:'相手のリーチ宣言がなく、牌河の変化がなければ判断を変えない仮説。'}];
 const r=verifyV2IndependentDevelopmentAnswer(e,b);
 assert.equal(r.naturalLanguageImpact,'not_certified');
 for(const f of [
  x=>x.importantSeats=[{seat:9,whyMatters:'重要であることの証明があるはずだ。',changeCondition:'条件が変われば別候補が有利かもしれない。'}],
  x=>x.importantSeats=[{seat,whyMatters:'重要であると断定するが根拠はない。',changeCondition:'条件が変わると変化するかもしれない。'}],
  x=>x.requestHash='wrong',
  x=>x.evidenceProof.comparisons[0].alternative+=1,
  x=>x.educational.reason='一般論',
  x=>x.isCertifiedByMortal=true
 ]){
  const mutated=clone(a);f(mutated);
  assert.throws(()=>verifyV2IndependentDevelopmentAnswer(e,mutated),/independent-v2|v2-proof/);
 }
});
test('tampered source hashes and fake archived model data are rejected before answer evaluation',()=>{
 if(!all.length)return;
 const a=clone(all[0]);a.request.input.oracle={privateHand:['s1']};
 assert.throws(()=>createV2IndependentDevelopmentRequest(a),/untrusted frozen public source/);
 const b=createV2IndependentDevelopmentRequest(all[0]),response=sample(b);
 b.request.input.reference={q:[12,34]};
 assert.throws(()=>verifyV2IndependentDevelopmentAnswer(b,response),/tampered request/);
});

test('30 perfectly grounded but generic answers may pass facts; not one is certified for tactical depth',()=>{
 if(!all.length)return;
 let syntacticallyGood=0,certified=0;
 for(const old of all){
  const e=createV2IndependentDevelopmentRequest(old),a=sample(e);
  a.educational.reason='麻雀では状況に応じて、手牌効率と打点のバランスを取ることが大切です。';
  a.educational.opponentTradeoff='すべての他家の速度と得点を意識し、慎重に押し引きすることが重要です。';
  a.educational.boundary='状況が変わったときには、同じ打牌が最善ではなくなることがあります。';
  a.educational.lesson='目先の受け入れだけでなく、常に場況全体を総合判断しましょう。';
  const q=verifyV2IndependentDevelopmentAnswer(e,a);
  if(q.calculationProof.deterministicGate==='pass')syntacticallyGood++;
  if(q.explanationQuality==='certified')certified++;
 }
 assert.equal(syntacticallyGood,30);
 assert.equal(certified,0); // Deterministic facts cannot validate generic causal narratives.
});
