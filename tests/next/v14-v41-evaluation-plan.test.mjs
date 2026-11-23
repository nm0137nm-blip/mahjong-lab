import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createV3IndependentDevelopmentRequest} from '../../src/coach/v14-independent-request-v3.mjs';
import {createV41CompactDevelopmentPacket} from '../../src/coach/v14-compact-model-contract-v41.mjs';
import {createV41FrozenStage1} from './v14-v41-stage1-freeze.mjs';
import {P2A_V41_RESEARCH_PLAN as plan,P2A_V41_FIXED_EIGHT as ids,
 P2A_V41_PACKET_HASHES as hashes,P2A_V41_BASE_SOURCE_HASH} from '../../src/coach/v14-v41-evaluation-plan.mjs';
const frozen=process.env.V14_FOLLOWUP_PUBLIC?JSON.parse(fs.readFileSync(process.env.V14_FOLLOWUP_PUBLIC,'utf8')):[];
const h=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
test('eight new frozen source-bound model request hashes are byte-for-byte exactly pinned before any v41 response',()=>{
 if(!frozen.length)return;
 assert.equal(h(frozen),P2A_V41_BASE_SOURCE_HASH);
 const packageData=createV41FrozenStage1(frozen);
 assert.deepEqual(packageData.publicManifest.selectedIds,ids);
 assert.equal(ids.length,8);
 assert.deepEqual(packageData.publicManifest.rows.map(x=>x.packetHash),hashes);
 for(const [i,caseId] of ids.entries()){
  const e=createV3IndependentDevelopmentRequest(frozen.find(x=>x.request.input.id===caseId));
  assert.equal(createV41CompactDevelopmentPacket(e).requestHash,hashes[i]);
 }
 assert(!ids.includes('pilot-42')&&!ids.includes('pilot-48'));
});
test('original v4 historical fail stays archived and v41 has unchanged high-confidence fact gate',()=>{
 assert.match(plan.historicalV4,/CLOSED_NO_GO/);
 assert.equal(plan.modelAnswerCountAtFreeze,0);
 assert.equal(plan.stage1.requiredContractPassCount,8);
 assert.equal(plan.stage1.toleratedMaterialArithmeticOrFactualErrors,0);
 assert.equal(plan.stability.plannedManualChats,8);
 assert.equal(plan.stage2.plannedManualChats,8);
 assert.equal(plan.l35.changedMin,4);
 assert.equal(plan.l35.maintainedMin,4);
 assert.equal(plan.l4.raters.length,3);
 assert.equal(plan.l4.axes.length,4);
 assert.equal(plan.l4.allowedWeakControlsMisratedExpertByAtLeast2of3Raters,0);
 assert.match(plan.overall.researchPhaseCompleteGO,/user waived an EXTRA/);
});
