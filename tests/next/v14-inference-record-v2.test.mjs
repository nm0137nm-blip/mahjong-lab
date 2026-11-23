import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sealSingleInference,verifySingleInference,auditBatchSingleInference,INFERENCE_RECORD_VERSION} from '../../src/coach/v14-inference-record-v2.mjs';
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const clone=x=>structuredClone(x);
const env=n=>{const request={stage:'independent',input:{id:'pilot-'+String(n).padStart(2,'0')}};return {request,requestHash:sha(request)};};
const ans=e=>({id:e.request.input.id,requestHash:e.requestHash,answer:{recommendation:'a1-0',comment:'unit fixture only, not real model inference'}});
const metadata=n=>({sessionId:'dev-session-'+n,transport:'manual_chat',provider:'test fixture',modelId:'unit stub not a deployed model',modelVersion:null,effort:null,temperature:null,seed:null,startedAt:'2026-11-23T00:00:00+09:00',endedAt:'2026-11-23T00:00:01+09:00',providerRequestId:null,sourceAssertion:'user_reported',usage:null});
test('single case record is input/output bound, but no provider truth or tactical capability is inferred',()=>{
 const e=env(1),r=sealSingleInference(e,ans(e),metadata(1));
 assert.equal(r.packet.version,INFERENCE_RECORD_VERSION);
 assert.equal(r.packet.elapsedMs,1000);
 assert.equal(r.packet.attestation,'user_reported_not_independently_authenticated');
 assert.equal(verifySingleInference(e,r).recordHash,r.packetHash);
 assert.equal(r.packet.gate,'dev_metadata_only_no_model_tactical_certification');
});
test('rejects answer/input mutation and fake self-reported provider attestation',()=>{
 const e=env(1),a=ans(e),m=metadata(1),r=sealSingleInference(e,a,m);
 const changedInput=clone(e);changedInput.request.input.id='pilot-02';
 assert.throws(()=>verifySingleInference(changedInput,r),/invalid immutable input/);
 const tampered=clone(r);tampered.packet.answerEnvelope.answer.recommendation='a2-0';
 assert.throws(()=>verifySingleInference(e,tampered),/tampered record/);
 const x=clone(m);x.sourceAssertion='provider_metadata';
 assert.throws(()=>sealSingleInference(e,a,x),/incomplete or unverifiable/);
 const badA=clone(a);badA.requestHash='corrupt';
 assert.throws(()=>sealSingleInference(e,badA,m),/not bound/);
});
test('independent sessions are enforced and missing questions are counted or rejected',()=>{
 const e1=env(1),e2=env(2),r1=sealSingleInference(e1,ans(e1),metadata(1)),r2=sealSingleInference(e2,ans(e2),metadata(2));
 const good=auditBatchSingleInference([e1,e2],[r1,r2]);
 assert.equal(good.received,2);assert.deepEqual(good.missing,[]);
 assert.equal(good.allProviderClaimsAuthenticated,false);
 assert.equal(good.independentTacticalGrade,'not_measured');
 const shared=clone(r2);shared.packet.meta.sessionId='dev-session-1';shared.packetHash=sha(shared.packet);
 assert.throws(()=>auditBatchSingleInference([e1,e2],[r1,shared]),/reused session/);
 assert.throws(()=>auditBatchSingleInference([e1,e2],[r1]),/missing cases/);
 const missing=auditBatchSingleInference([e1,e2],[r1],{strict:false});
 assert.deepEqual(missing.missing,['pilot-02']);
 assert.throws(()=>auditBatchSingleInference([e1,e2],[r1,r1]),/duplicate or unknown/);
});
test('timestamps, service tags, configured usage and extra fields are strict',()=>{
 const e=env(1),a=ans(e);
 for(const attack of [
   m=>m.startedAt='2026-11-23 12:00',
   m=>m.endedAt='2026-11-22T00:00:00+09:00',
   m=>m.sourceAssertion='official',
   m=>m.transport='not_an_api',
   m=>m.temperature=Infinity,
   m=>m.usage={inputTokens:12,outputTokens:-1,billedCost:0,billedCostCurrency:'JPY'},
   m=>m.signedProviderAttestation='invented'
 ]){
  const m=metadata(1);attack(m);assert.throws(()=>sealSingleInference(e,a,m),/inference-record/);
 }
 const api=metadata(1);api.transport='api';api.sourceAssertion='provider_metadata';api.providerRequestId='provider-unit-request';api.usage={inputTokens:12,outputTokens:35,billedCost:null,billedCostCurrency:null};
 const r=sealSingleInference(e,a,api);
 assert.equal(r.packet.attestation,'provider_metadata_as_submitted_not_cryptographically_attested');
});
