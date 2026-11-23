import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {makeOneCaseExport,verifyOneCaseExport} from './v14-onecase-export-v2.mjs';
import {sealSingleInference,auditBatchSingleInference} from '../../src/coach/v14-inference-record-v2.mjs';
import {createV2IndependentDevelopmentRequest,ANSWER_VERSION} from '../../src/coach/v14-independent-request-v2.mjs';
import {makeArithmeticFixture} from '../../src/coach/v14-evidence-proof-v2.mjs';
const all=process.env.V14_STAGE1?JSON.parse(fs.readFileSync(process.env.V14_STAGE1,'utf8')):[];
const copy=x=>structuredClone(x);
test('all 30 old public cases can be packaged as mutually independent one-case prompts without verifier data',()=>{
 if(!all.length)return;
 const out=makeOneCaseExport(all);
 assert.equal(out.messages.length,30);
 assert.equal(out.manifest.n,30);
 assert.equal(out.manifest.noModelExecuted,true);
 assert.equal(out.manifest.modelId,null);
 assert.equal(new Set(out.messages.map(x=>x.requestHash)).size,30);
 for(const m of out.messages){
  assert.equal(m.request.stage,'independent-v2-dev');
  assert.equal(m.answerTemplate.answer,'REPLACE_WITH_ONE_JSON_OBJECT_PER_CASE');
  assert.equal(Object.hasOwn(m.request,'reference'),false);
  assert.equal(Object.hasOwn(m.request,'oracle'),false);
  assert.equal(Object.hasOwn(m.request,'hiddenHands'),false);
  assert.equal(Object.hasOwn(m.request,'comparison'),false);
  assert.equal(Object.hasOwn(m.request,'pairedCondition'),false);
  assert.equal(Object.hasOwn(m,'teacherLabel'),false);
  assert.equal(Object.hasOwn(m,'mortalQ'),false);
  assert(!m.instructions.includes('pilot-01'));
 }
 assert.equal(verifyOneCaseExport(all,out).actualModelCalls,0);
});
test('manifest detects mutation, reused cases, malformed source and accidental secret reference label',()=>{
 if(!all.length)return;
 const out=makeOneCaseExport(all),bad=copy(out);
 bad.messages[0].request.input.evidence[0].value.ownSeat=99;
 assert.throws(()=>verifyOneCaseExport(all,bad),/does not match audited public source/);
 const more=copy(out);more.messages[0].oracle={future:123};
 assert.throws(()=>verifyOneCaseExport(all,more),/does not match audited public source/);
 const dupe=[all[0],all[0]];
 assert.throws(()=>makeOneCaseExport(dupe),/duplicate case id/);
 const fake=copy(all);fake[0].request.reference={q:[1]};
 assert.throws(()=>makeOneCaseExport(fake),/untrusted frozen public source/);
});
test('one-case record ingestion can reject a five-question shared model session even when individual answers are arithmetically valid',()=>{
 if(!all.length)return;
 const [x,y]=all.slice(0,2).map(createV2IndependentDevelopmentRequest);
 function fakeAnswer(e){
  const p=makeArithmeticFixture(e);
  return {id:e.request.input.id,requestHash:e.requestHash,answer:{
    version:ANSWER_VERSION,requestHash:e.requestHash,evidenceProof:p,
    importantSeats:[],uncertainSeats:[{seat:p.opponentObservations[0].seat,
      reason:'他家の実際の放銃率を決定づける根拠がなく現状では未確定。'}],
    educational:{reason:'算術比較は可能でも他家の危険度の推測は未認証である。',
      opponentTradeoff:'公開観測と隠し牌の不確実性を区別して解釈する。',
      boundary:'未知の条件によって選択が変わる可能性がある。',
      lesson:'開発QAの人工回答であり本物のコーチの推論ではない。'}
  }};
 }
 const m={sessionId:'manually-supplied-session-id',transport:'manual_chat',
  provider:'unit fixture',modelId:'synthetic',modelVersion:null,effort:null,temperature:null,seed:null,
  startedAt:'2026-11-23T00:00:00+09:00',endedAt:'2026-11-23T00:00:01+09:00',
  providerRequestId:null,sourceAssertion:'user_reported',usage:null};
 const a=sealSingleInference(x,fakeAnswer(x),m),b=sealSingleInference(y,fakeAnswer(y),m);
 assert.throws(()=>auditBatchSingleInference([x,y],[a,b]),/reused session/);
 const ok=sealSingleInference(y,fakeAnswer(y),{...m,sessionId:'second-independent-session'});
 const r=auditBatchSingleInference([x,y],[a,ok]);
 assert.equal(r.expected,2);
 assert.equal(r.received,2);
 assert.equal(r.allProviderClaimsAuthenticated,false);
 assert.equal(r.independentTacticalGrade,'not_measured');
});
