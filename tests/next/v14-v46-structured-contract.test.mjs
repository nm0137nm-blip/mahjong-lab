import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createV3IndependentDevelopmentRequest} from '../../src/coach/v14-independent-request-v3.mjs';
import {createV46CompactDevelopmentPacket,verifyAndRenderV46CompactModelResponse,V46_COMPACT_RESPONSE} from '../../src/coach/v14-compact-model-contract-v46.mjs';
import {createV46PublicFactRegistry} from '../../src/coach/v14-anchored-tactical-text-v46.mjs';
import {verifyStructuredCondition} from '../../src/coach/v14-structured-condition-v46.mjs';
import {createV4DeterministicSourceComparison} from '../../src/coach/v14-source-comparison-proof-v4.mjs';
import {createV44SourceShapeContrast} from '../../src/coach/v14-source-shape-contrast-v44.mjs';
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const read=()=>JSON.parse(fs.readFileSync(process.env.V14_FOLLOWUP_PUBLIC,'utf8'));
const source=(input,id)=>input.evidence.find(e=>e.id===id)?.value;
const ref=id=>'[['+id+']]';
// Test-only generated fixtures, no model output or tactical labels.
function fixture(raw){
 const envelope=createV3IndependentDevelopmentRequest(raw);
 const packet=createV46CompactDevelopmentPacket(envelope);
 const input=envelope.request.input,own=source(input,'board').ownSeat;
 const registry=createV46PublicFactRegistry(envelope);
 const seats=[0,1,2,3].filter(x=>x!==own);
 const choices=input.actions.map(a=>({key:a.key,afterCallDiscard:source(input,'calc-'+a.key)?.afterCallDiscards?.[0]?.discard??null}));
 let pair;
 for(const a of choices){for(const b of choices){
  if(a.key===b.key)continue;
  try{
   const diff=createV4DeterministicSourceComparison(envelope,a,b),shape=createV44SourceShapeContrast(envelope,a,b);
   if(!diff.publicDifferences&&!shape.verifiedAdditionalDifferences)continue;
   const ids=[a,b].flatMap(c=>Object.keys(registry).filter(k=>k.startsWith('candidate:'+c.key+':')));
   if(!diff.publicDifferences&&!shape.witnesses.some(w=>w.sourceFactIds.every(id=>ids.includes(id))))continue;
   const extra=[a,b].filter(c=>c.afterCallDiscard!==null).map(c=>'candidate:'+c.key+':afterCallDiscard');
   if(!ids.some(id=>!id.endsWith(':kind')))continue;
   pair={a,b,ids:[...ids,...extra]};break;
  }catch{}
 }if(pair)break;}
 assert(pair,'no synthetic legal distinct pair '+input.id);
 const {a,b,ids}=pair;
 const condition=(seat,mode='switch')=>{
  const id='opponent:seat'+seat+':riichi',current=source(input,'public-value-'+seat).riichi;
  return {predicates:[{factId:id,op:'eq',value:!current}],
   effect:mode==='switch'?{mode:'switch',from:'recommendation',to:'alternative'}:{mode:'reweight',target:'alternative',direction:'increase'},
   explanation:ref(id)+'が現状と異なる仮定では、対案へ判断を傾ける。これは機械検証専用の架空説明である。'};
 };
 const answer={version:V46_COMPACT_RESPONSE,requestHash:packet.requestHash,
  recommendation:a,alternative:b,mostImportantOpponent:seats[0],
  tactics:{comparison:ids.map(ref).join(' と ')+'を比較する機械検証用の架空文である。',
   opponents:seats.map((seat,i)=>({seat,importance:i===0?'potentially_relevant':'not_established',
    analysis:ref('opponent:seat'+seat+':pointGapFromOwn')+'と'+ref('opponent:seat'+seat+':meldCount')+'を確認する。',
    tradeoff:ref('opponent:seat'+seat+':riichi')+'と'+ref('candidate:'+a.key+':kind')+'を照合する架空説明。',
    changeCondition:condition(seat,i===0?'reweight':'switch')})),
   bottomLine:ref('candidate:'+a.key+':kind')+'を用いる架空の機械検証例である。',
   reversal:{seat:seats[0],condition:condition(seats[0])},
   lesson:'これは麻雀戦術の正答ではなく、型の確認だけを行う。'}};
 return {envelope,packet,answer,seats,input};
}
test('v46 complete contract on all original public cases, synthetic only; no v45 regrading',()=>{
 const data=read();assert.equal(data.length,36);
 assert.equal(sha(data),'271b4a304ed86dc41be2e72766e2b5cc496966bdf8a0ce5a8d5a5d0334e6103a');
 for(const raw of data){
  const f=fixture(raw),r=verifyAndRenderV46CompactModelResponse(f.envelope,f.packet,f.answer);
  assert.equal(r.mostImportantOpponent,f.seats[0]);assert.equal(r.output.structuredReversal.explicitSwitch,true);
  assert.equal(r.output.opponents[0].structuredChange.explicitSwitch,false);
  assert.equal(r.output.structuredReversal.semanticCertification,false);
  assert.equal(r.actualTacticalSkill,'not_certified_pending_independent_anonymous_blind_review');
  assert.equal(f.packet.request.conditionFacts.length,21);
  assert(!JSON.stringify(f.packet).includes('DECOY_NOT_ALLOWED'));
 }
});
test('same structured condition accepts varied prose without decision-word regex',()=>{
 const f=fixture(read()[0]);
 for(const phrase of ['副露へ判断を傾ける。','対案の比重を大きくする。','押し引きの重みが変わる。','この仮定では対案の価値が上昇する。']){
  const a=structuredClone(f.answer);
  a.tactics.opponents[0].changeCondition.explanation=ref(a.tactics.opponents[0].changeCondition.predicates[0].factId)+'という公開条件を想定する。'+phrase;
  assert.doesNotThrow(()=>verifyAndRenderV46CompactModelResponse(f.envelope,f.packet,a));
 }
});
test('strict rejection of bad fact, wrong seat, old prose shape, true trigger, impossible bounds, invalid effect, fake amount and missing anchors',()=>{
 const f=fixture(read()[0]),c=a=>a.tactics.opponents[0].changeCondition,p=a=>c(a).predicates[0];
 const cases=[
  a=>p(a).factId='opponent:seat'+f.seats[0]+':tenpaiProbability',
  a=>p(a).factId='opponent:seat'+f.seats[1]+':riichi',
  a=>a.tactics.opponents[0].changeCondition='古い自然言語のみの条件',
  a=>p(a).value=source(f.input,'public-value-'+f.seats[0]).riichi,
  a=>{p(a).factId='opponent:seat'+f.seats[0]+':meldCount';p(a).value=5;},
  a=>p(a).op='gt',
  a=>p(a).value=0,
  a=>c(a).predicates.push({...p(a)}),
  a=>c(a).effect={mode:'reassess'},
  a=>c(a).effect={mode:'switch',from:'alternative',to:'recommendation'},
  a=>c(a).explanation='条件の説明には根拠を入れない。',
  a=>c(a).explanation+='勝率80%になる。',
  a=>a.tactics.reversal.condition.effect={mode:'reweight',target:'alternative',direction:'increase'},
  a=>a.mostImportantOpponent=null,
  a=>a.mostImportantOpponent=f.seats[1],
  a=>a.tactics.opponents[0].tradeoff='根拠を引用しない定型文である。',
  a=>a.alternative.key='illegal-key'
 ];
 for(const mutate of cases){const a=structuredClone(f.answer);mutate(a);assert.throws(()=>verifyAndRenderV46CompactModelResponse(f.envelope,f.packet,a));}
});
test('tie/uncertainty is explicitly allowed without making up a top opponent',()=>{
 const f=fixture(read()[0]),a=structuredClone(f.answer);
 a.tactics.opponents[1].importance='potentially_relevant';a.mostImportantOpponent=null;
 assert.equal(verifyAndRenderV46CompactModelResponse(f.envelope,f.packet,a).mostImportantOpponent,null);
});
test('old v45 verifier retains old lexeme gate and frozen version; v46 has no lexeme import',()=>{
 const a=fs.readFileSync('src/coach/v14-anchored-tactical-text-v45.mjs','utf8'),b=fs.readFileSync('src/coach/v14-anchored-tactical-text-v46.mjs','utf8');
 assert(a.includes('hasV45ConditionalReversal'));assert(!b.includes('hasV45ConditionalReversal'));assert(!b.includes('hasV46ConditionalReversal'));
 assert(b.includes('verifyStructuredCondition'));
});
