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
const read=()=>JSON.parse(fs.readFileSync(process.env.V46_SOURCE,'utf8'));
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
import {assertFrozenV46Source,assessV46FirstRealStage1,summarizeV46Stage1Receipts,IDS,HASHES,SOURCE_SHA} from '../../src/coach/v14-v46-stage1-receipt.mjs';
test('all eight new frozen prompts, receipts and exact bytes, synthetic only',()=>{
 const data=read();assert.equal(sha(data),SOURCE_SHA);
 const locked=assertFrozenV46Source(data);
 const receipts=[];
 for(let i=0;i<8;i++){
  const f=fixture(data[i]),id=IDS[i];
  assert.deepEqual(locked[i].packet,JSON.parse(fs.readFileSync(process.env.V46_QUESTIONS+'/'+id+'.json','utf8')));
  assert.equal(f.packet.requestHash,HASHES[i]);
  const raw=JSON.stringify(f.answer);
  const r=assessV46FirstRealStage1(data,id,raw,{provider:'SYNTHETIC_TEST_ONLY'});
  assert.equal(r.verdict,'CONTRACT_AND_PUBLIC_FACT_GATE_PASS',r.failure);
  assert.equal(r.rawReplyPreserved,raw);assert.equal(r.transportMode,'strict_json');
  assert.equal(r.semanticGrade,'NOT_ASSESSED_BY_MACHINE');
  assert.equal(r.mostImportantOpponent,f.seats[0]);
  receipts.push(r);
 }
 assert.equal(summarizeV46Stage1Receipts(receipts).canExpand,true);
 assert.equal(summarizeV46Stage1Receipts(receipts.slice(0,7)).canExpand,false);
 assert.throws(()=>summarizeV46Stage1Receipts(receipts.slice(1)));
 const bad=assessV46FirstRealStage1(data,IDS[0],'{');
 assert.equal(bad.verdict,'STAGE1_NO_GO_INVALID_JSON');
 assert.equal(summarizeV46Stage1Receipts([bad]).verdict,'NO_GO_FIRST_FATAL');
 assert.throws(()=>summarizeV46Stage1Receipts([bad,receipts[1]]));
 const x=fixture(data[0]);x.answer.mostImportantOpponent=99;
 assert.equal(assessV46FirstRealStage1(data,IDS[0],JSON.stringify(x.answer)).verdict,'STAGE1_NO_GO_INVALID_PUBLIC_CONTRACT');
 const tampered=structuredClone(data);tampered[0].request.input.id='wrong';
 assert.throws(()=>assertFrozenV46Source(tampered));
});
