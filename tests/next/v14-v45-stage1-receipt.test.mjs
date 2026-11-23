import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createV45FrozenStage1} from './v14-v45-stage1-freeze.mjs';
import {assessV45FirstRealStage1,summarizeV45Stage1Receipts} from '../../src/coach/v14-v45-stage1-receipt.mjs';
import {P2A_V45_FIXED_EIGHT,P2A_V45_PACKET_HASHES,P2A_V45_RESEARCH_PLAN} from '../../src/coach/v14-v45-evaluation-plan.mjs';
const source=process.env.V14_FOLLOWUP_PUBLIC?
 JSON.parse(fs.readFileSync(process.env.V14_FOLLOWUP_PUBLIC,'utf8')):null;
const hash=s=>createHash('sha256').update(s).digest('hex');
test('fixed eight and packet requestHash are hardcoded, validated from original 36',()=>{
 assert.equal(P2A_V45_FIXED_EIGHT.length,8);
 assert.equal(P2A_V45_PACKET_HASHES.length,8);
 assert.equal(P2A_V45_RESEARCH_PLAN.stage1.requiredContractPassCount,8);
 assert(P2A_V45_RESEARCH_PLAN.stage1.firstCriticalFailure.includes('NO_GO'));
 assert(P2A_V45_RESEARCH_PLAN.overall.cost.includes('first eight'));
 if(!source)return;
 const p=createV45FrozenStage1(source);
 for(const [i,q] of p.questions.entries()){
  assert.equal(q.caseId,P2A_V45_FIXED_EIGHT[i]);
  assert.equal(q.packet.requestHash,P2A_V45_PACKET_HASHES[i]);
  assert.equal(hash(JSON.stringify(q.packet.request)),P2A_V45_PACKET_HASHES[i]);
 }
});
test('malformed manual JSON remains a real first-fatal and no auto correction/retry',()=>{
 if(!source)return;
 const x=assessV45FirstRealStage1(source,P2A_V45_FIXED_EIGHT[0],'{invalid JSON',{
  provider:'ChatGPT manual',modelDisplay:'GPT-6',independentTemporaryChat:true,
  replySubmittedAsJsonFile:true,observedLocalTimestamp:'2026-11-24T07:00+09:00'});
 assert.equal(x.verdict,'STAGE1_NO_GO_INVALID_JSON');
 assert.equal(x.rawReplySha256,hash('{invalid JSON'));
 assert.equal(x.rawReplyPreserved,'{invalid JSON');
 assert.equal(x.noAutomaticRepair,true);
 assert.equal(x.actualIndependentModelAttemptCount,1);
 const sum=summarizeV45Stage1Receipts([x]);
 assert.equal(sum.fatal,true);
 assert.equal(sum.actualAttempts,1);
 assert.equal(sum.verdict,'PREDECLARED_PHASE_NO_GO_AFTER_FIRST_FATAL');
 assert.throws(()=>summarizeV45Stage1Receipts([{
  ...x,caseId:P2A_V45_FIXED_EIGHT[1]}]),/responses not in preregistered order/);
});
test('manual Stage1 contract does not count API attempts or claim skill from numeric gate',()=>{
 assert.equal(P2A_V45_RESEARCH_PLAN.modelRecording.provider,'ChatGPT manual one temporary chat per single question');
 assert.equal(P2A_V45_RESEARCH_PLAN.stage1.requiredContractPassCount,8);
 assert.equal(P2A_V45_RESEARCH_PLAN.l4.allThreeRatersRequired,true);
 assert.equal(P2A_V45_RESEARCH_PLAN.l35.changedMin,4);
 assert.equal(P2A_V45_RESEARCH_PLAN.l35.maintainedMin,4);
 assert(P2A_V45_RESEARCH_PLAN.overall.cost.includes('no paid model API'));
});
