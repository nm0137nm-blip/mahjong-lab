import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createV3IndependentDevelopmentRequest} from '../../src/coach/v14-independent-request-v3.mjs';
import {createV4CompactDevelopmentPacket} from '../../src/coach/v14-compact-model-contract-v4.mjs';
import {selectV4ProspectiveSmoke} from '../../src/coach/v14-v4-smoke-selection.mjs';
import {P2A_V4_RESEARCH_PLAN as p,P2A_V4_FIXED_EIGHT as ids,
 P2A_V4_PACKET_HASHES as hashes,P2A_V4_BASE_SOURCE_HASH} from '../../src/coach/v14-v4-evaluation-plan.mjs';
const input=process.env.V14_FOLLOWUP_PUBLIC?
 JSON.parse(fs.readFileSync(process.env.V14_FOLLOWUP_PUBLIC,'utf8')):[];
const h=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
test('v4 prospective model case IDs and complete request bytes match externally verified earlier artifact hashes',()=>{
 if(!input.length)return;
 assert.equal(h(input),P2A_V4_BASE_SOURCE_HASH);
 const panel=selectV4ProspectiveSmoke(input);
 assert.deepEqual(panel.selectedIds,ids);
 assert.equal(hashes.length,8);
 for(let i=0;i<ids.length;i++){
  const x=input.find(x=>x.request.input.id===ids[i]);
  const p=createV4CompactDevelopmentPacket(createV3IndependentDevelopmentRequest(x));
  assert.equal(p.requestHash,hashes[i]);
 }
 assert(!ids.includes('pilot-48'));
});
test('preregistered phase gates demand a true distinct model result and no post-hoc regrading',()=>{
 assert.equal(p.modelAnswerCountAtFreeze,0);
 assert.equal(p.stage1.requiredContractPassCount,8);
 assert.equal(p.stage1.toleratedMaterialArithmeticOrFactualErrors,0);
 assert.match(p.stage1.firstCriticalFailure,/immediate_NO_GO/);
 assert.equal(p.stability.plannedManualChats,8);
 assert.equal(p.stage2.plannedManualChats,8);
 assert.equal(p.l35.changedMin,4);
 assert.equal(p.l35.maintainedMin,4);
 assert.equal(p.l4.raters.length,3);
 assert.equal(p.l4.axes.length,4);
 assert.equal(p.l4.allowedWeakControlsMisratedExpertByAtLeast2of3Raters,0);
 assert.equal(p.l4.stage1RealScenesMedianAtLeast9Needed,6);
 assert.match(p.overall.anyFailure,/CLOSE_NO_GO/);
 assert.match(p.overall.noProductionPromotion,/main/);
});
test('preregistered text never discloses exact Q values, future draws or hidden labels to model',()=>{
 assert.equal(p.inputBlinding.includes('NO Mortal Q'),true);
 assert.equal(p.stage2.exactModelQNeverExposed,true);
 assert.equal(p.l35.noModelQExposure,true);
 assert(!Object.hasOwn(p,'hiddenHands'));
 assert(p.overall.cost.includes('prior explicit'));
});
