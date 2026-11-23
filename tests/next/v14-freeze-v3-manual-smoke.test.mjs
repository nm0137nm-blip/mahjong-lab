import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {buildV3ManualSmokePack,validateV3ManualSmokePack} from './v14-freeze-v3-manual-smoke.mjs';
import {createV3IndependentDevelopmentRequest} from '../../src/coach/v14-independent-request-v3.mjs';
import {sealSingleInference} from '../../src/coach/v14-inference-record-v3.mjs';
const ready=Boolean(process.env.V14_FOLLOWUP_PUBLIC);
const frozen=ready?JSON.parse(fs.readFileSync(process.env.V14_FOLLOWUP_PUBLIC,'utf8')):[];
const clone=x=>structuredClone(x);
test('preregistered 8 cases, 24 separate sessions, no model answers and no verifier references',()=>{
 if(!ready)return;
 const p=buildV3ManualSmokePack(frozen);
 assert.equal(p.questions.length,8);
 assert.deepEqual(p.manifest.selected,{reach:['pilot-48','pilot-52','pilot-49'],
  reaction:['pilot-54','pilot-60','pilot-63'],discard:['pilot-66','pilot-69']});
 assert.equal(p.manifest.genuineChatGPTCalls,0);
 assert.equal(p.manifest.actualResponses,0);
 assert.equal(p.manifest.paidCalls,0);
 assert.equal(p.sessions.length,24);
 assert.equal(new Set(p.sessions.map(x=>x.sessionKey)).size,24);
 for(const q of p.questions){
  assert.equal(q.packet.request.input.id,q.caseId);
  assert.equal(q.packet.request.stage,'independent-v3-dev');
  assert.equal(q.packet.requestHash,q.packetHash);
  assert(!Object.hasOwn(q.packet.request,'q'));
  assert(!Object.hasOwn(q.packet.request,'reference'));
  assert(!Object.hasOwn(q.packet.request.input,'lineage'));
  assert.equal(q.packet.request.input.evidence.some(e=>e.id.includes('oracle')),false);
  assert.equal(q.packet.request.input.evidence.some(e=>e.id.includes('mortal')),false);
 }
 assert.equal(validateV3ManualSmokePack(frozen,p).realModelCalls,0);
});
test('tampering one case public input or manipulating the response manifest must fail',()=>{
 if(!ready)return;
 const p=buildV3ManualSmokePack(frozen),mut=clone(p);
 mut.questions[0].packet.request.input.actions[0].detail='z9';
 assert.throws(()=>validateV3ManualSmokePack(frozen,mut),/package mutated/);
 const bad=clone(frozen);bad[0].requestHash='forged';
 assert.throws(()=>buildV3ManualSmokePack(bad),/public source hash/);
 const bad2=clone(frozen);bad2[0].request.input.actions[0].group=45;
 assert.throws(()=>buildV3ManualSmokePack(bad2),/source hash/);
});
test('v3 inference receipt rejects a v2 request even when it has a recomputed and valid hash',()=>{
 if(!ready)return;
 const v1=frozen[0],v3=createV3IndependentDevelopmentRequest(v1),bad=clone(v3);
 bad.request.stage='independent-v2-dev';
 bad.requestHash=createHash('sha256').update(JSON.stringify(bad.request)).digest('hex');
 const meta={sessionId:'synthetic-stage-test',transport:'manual_chat',provider:'unit test',
  modelId:'NO_MODEL_CALLED',modelVersion:null,effort:null,temperature:null,seed:null,
  startedAt:'2026-11-23T00:00:00+09:00',endedAt:'2026-11-23T00:00:01+09:00',
  providerRequestId:null,sourceAssertion:'user_reported',usage:null};
 const noAnswer={id:v3.request.input.id,requestHash:bad.requestHash,answer:{}};
 assert.throws(()=>sealSingleInference(bad,noAnswer,meta),/invalid immutable input/);
});
