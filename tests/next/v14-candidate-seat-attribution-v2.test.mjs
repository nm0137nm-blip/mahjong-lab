import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createV2IndependentDevelopmentRequest,ANSWER_VERSION} from '../../src/coach/v14-independent-request-v2.mjs';
import {PROOF_VERSION,makeArithmeticFixture} from '../../src/coach/v14-evidence-proof-v2.mjs';
import {scanTradeoffWitnesses,buildTradeoffWitness} from '../../src/coach/v14-public-tradeoff-witness-v2.mjs';
import {attachCandidateSeatTradeoff,verifyCandidateSeatTradeoff,diagnoseFactualTradeoffCoverage} from '../../src/coach/v14-candidate-seat-attribution-v2.mjs';
const es=process.env.V14_STAGE1?JSON.parse(fs.readFileSync(process.env.V14_STAGE1,'utf8')):[];
const clone=x=>structuredClone(x);
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const relation=(a,b)=>a>b?'higher':a<b?'lower':'same';
function positive(e,w){
 const field='riichi',opponent=e.request.input.evidence.find(x=>x.id==='public-value-'+w.seat).value;
 return {
 version:ANSWER_VERSION,requestHash:e.requestHash,
 evidenceProof:{version:PROOF_VERSION,requestHash:e.requestHash,
  recommendation:w.genbutsuAction,alternative:w.otherAction,
  comparisons:[{metric:w.metric,recommended:w.genbutsuValue,alternative:w.otherValue,
    relation:relation(w.genbutsuValue,w.otherValue),
    recommendedAfterCallDiscard:null,alternativeAfterCallDiscard:null}],
  opponentObservations:[{seat:w.seat,field,value:opponent.riichi,assessment:'potentially_relevant'}],
  reversal:{unknownFactors:['pWin','pDealIn'],ifThen:'放銃と自分の和了は未校正なので、この数値だけで押すべきかは決められない。'},
  explanation:'特定相手に対する現物を残すと受け入れや打点などの数値が悪化し得るという事実のみ確認する。'
 },
 importantSeats:[{seat:w.seat,
  whyMatters:'この相手には現物があり、自手効率を犠牲にする具体的な候補比較が成立する。',
  changeCondition:'この相手が追加で捨て牌を増やした場合は現物と候補の損得が変わる可能性がある。'}],
 uncertainSeats:[],
 educational:{reason:'現物と非現物の候補間に自手の形・価値の差がある事実を確認する。',
  opponentTradeoff:'この特定相手に限って現物という安全性があり、代わりに自手の数値が下がる。',
  boundary:'和了や放銃頻度が不明なので、現物が正解だと断定できない。',
  lesson:'確定的な安全性と自手効率の代償を別々に比較する。'}
 };
}
test('all 888 public tradeoff witnesses can be bound to the ACTUAL recommended/alternative and seat in a known-good fact-only fixture',()=>{
 if(!es.length)return;
 let n=0,caseIds=new Set(),seatCases=new Set();
 for(const old of es){
  const e=createV2IndependentDevelopmentRequest(old);
  for(const w of scanTradeoffWitnesses(e)){
   const a=positive(e,w),c=attachCandidateSeatTradeoff(e,a,w),v=verifyCandidateSeatTradeoff(e,a,w,c);
   assert.equal(c.factualTradeoff,'verified');
   assert.equal(v.concreteCandidateOpponentTradeoff,'verified');
   assert.equal(v.semanticLanguageQuality,'not_certified');
   assert.equal(v.riskProbability,'unknown');
   n++;caseIds.add(e.request.input.id);seatCases.add(e.request.input.id+':'+w.seat);
  }
 }
 assert.equal(n,888);
 assert.equal(caseIds.size,22);
 assert.equal(seatCases.size,58);
});
test('all 30 generic fact padded responses have zero linked opponent tradeoffs, despite passing their ordinary typed arithmetic',()=>{
 if(!es.length)return;
 let zero=0;
 for(const old of es){
  const e=createV2IndependentDevelopmentRequest(old),p=makeArithmeticFixture(e);
  const a={version:ANSWER_VERSION,requestHash:e.requestHash,evidenceProof:p,importantSeats:[],
   uncertainSeats:[{seat:p.opponentObservations[0].seat,reason:'現状の情報でこの他家の真の影響はよく分かりません。'}],
   educational:{reason:'手牌効率と打点を総合的に見ながら麻雀を進めるべきです。',
    opponentTradeoff:'相手の速度と点数を見ながら慎重に押し引きするべきです。',
    boundary:'状況によって判断を臨機応変に変更していく必要があります。',
    lesson:'一つの材料だけでなく、全体を見て判断することが大切です。'}};
  const d=diagnoseFactualTradeoffCoverage(e,a,scanTradeoffWitnesses(e));
  assert.equal(d.candidateSeatFactualLinks,0);
  assert.equal(d.answerProseSemantics,'unmeasured');
  zero++;
 }
 assert.equal(zero,30);
});
test('valid cited facts for irrelevant candidates or wrong seat do not satisfy the candidate-opponent attribution gate',()=>{
 if(!es.length)return;
 const e=createV2IndependentDevelopmentRequest(es.find(x=>x.request.input.id==='pilot-01'));
 const w=buildTradeoffWitness(e,'a4-0','a3-0',0,'ukeireUpperBound'),a=positive(e,w);
 const c=attachCandidateSeatTradeoff(e,a,w);
 assert.equal(verifyCandidateSeatTradeoff(e,a,w,c).bestAction,'not_certified');
 for(const mutation of [
  x=>x.seat=2,
  x=>x.safeValue=x.nonGenbutsuValue,
  x=>x.metric='winProbability',
  x=>x.genbutsuSide='alternative_genbutsu_with_shape_sacrifice',
  x=>x.answerHash='forged',
  x=>x.semanticExplanation='expert_certified',
  x=>x.extraRate=.2
 ]){
  const f=clone(c);mutation(f);
  assert.throws(()=>verifyCandidateSeatTradeoff(e,a,w,f),/factual-attribution-v2/);
 }
 const notRelated=clone(a);
 const metrics=new Map(e.request.input.evidence.filter(x=>x.id.startsWith('calc-')).map(x=>[x.id.slice(5),x.value.ukeireUpperBound]));
 const legal=e.request.input.actions.filter(x=>x.key!==w.genbutsuAction&&x.key!==w.otherAction&&Number.isFinite(metrics.get(x.key)));
 const first=legal[0],second=legal.find(x=>metrics.get(x.key)!==metrics.get(first.key));
 assert(first&&second,'need a genuinely unrelated calculated contrast');
 notRelated.evidenceProof.recommendation=first.key;
 notRelated.evidenceProof.alternative=second.key;
 notRelated.evidenceProof.comparisons[0].recommended=metrics.get(first.key);
 notRelated.evidenceProof.comparisons[0].alternative=metrics.get(second.key);
 notRelated.evidenceProof.comparisons[0].relation=relation(notRelated.evidenceProof.comparisons[0].recommended,notRelated.evidenceProof.comparisons[0].alternative);
 assert.throws(()=>attachCandidateSeatTradeoff(e,notRelated,w),/factual-attribution-v2|v2-proof/);
});
test('opponent label contradictions, wrong comparator value, or valid but generic hand-only response cannot yield causal-skill certification',()=>{
 if(!es.length)return;
 const e=createV2IndependentDevelopmentRequest(es.find(x=>x.request.input.id==='pilot-01'));
 const w=buildTradeoffWitness(e,'a4-0','a3-0',0,'ukeireUpperBound'),a=positive(e,w);
 for(const mutation of [
  x=>x.evidenceProof.opponentObservations[0].assessment='not_established',
  x=>x.importantSeats=[],
  x=>x.evidenceProof.comparisons[0].alternative+=1,
  x=>x.evidenceProof.comparisons[0].relation='higher',
  x=>x.evidenceProof.opponentObservations[0].seat=2,
  x=>x.requestHash='bad'
 ]){
  const z=clone(a);mutation(z);
  assert.throws(()=>attachCandidateSeatTradeoff(e,z,w),/independent-v2|v2-proof|factual-attribution/);
 }
 const generic=clone(a);
 generic.educational.opponentTradeoff='相手の速度と得点を考えて状況に合わせて押し引きを判断することが重要です。';
 const linked=attachCandidateSeatTradeoff(e,generic,w);
 assert.equal(linked.semanticExplanation,'not_certified');
 assert.equal(linked.actualSeatCausality,'not_certified');
});
