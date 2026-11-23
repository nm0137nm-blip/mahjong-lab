import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createV43FrozenStage1,V43_SOURCE_SHA} from './v14-v43-stage1-freeze.mjs';
import {P2A_V43_RESEARCH_PLAN as plan,P2A_V43_FIXED_EIGHT as ids,
 P2A_V43_PACKET_HASHES as hashes} from '../../src/coach/v14-v43-evaluation-plan.mjs';
const frozen=process.env.V14_FOLLOWUP_PUBLIC?
 JSON.parse(fs.readFileSync(process.env.V14_FOLLOWUP_PUBLIC,'utf8')):[];
const h=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
test('v43 precommitted request hashes match every byte of original-source 8 and no exposed cases',()=>{
 if(!frozen.length)return;
 assert.equal(h(frozen),V43_SOURCE_SHA);
 const pack=createV43FrozenStage1(frozen);
 assert.deepEqual(pack.publicManifest.selectedIds,ids);
 assert.deepEqual(pack.publicManifest.rows.map(x=>x.packetHash),hashes);
 assert.equal(ids.length,8);
 assert.deepEqual(ids,['pilot-43','pilot-49','pilot-57','pilot-62','pilot-63','pilot-71','pilot-70','pilot-67']);
 assert(!ids.some(x=>['pilot-48','pilot-42','pilot-50','pilot-52','pilot-47','pilot-59'].includes(x)));
 assert.equal(pack.publicManifest.newV43IndependentResponsesAtFreeze,0);
});
test('v43 historical NO-GO unchanged and gate thresholds remain strict',()=>{
 assert.match(plan.historicalV42,/CLOSED_NO_GO/);
 assert.equal(plan.modelAnswerCountAtFreeze,0);
 assert.equal(plan.stage1.requiredContractPassCount,8);
 assert.equal(plan.stage1.toleratedMaterialArithmeticOrFactualErrors,0);
 assert.match(plan.stage1.firstCriticalFailure,/immediate_NO_GO/);
 assert.match(plan.stage1.fileOnlyAnswer,/UTF-8 JSON file attachment/);
 assert.match(plan.stage1.eachSeatTradeoffCitations,/SAME opponent/);
 assert.equal(plan.l35.changedMin,4);
 assert.equal(plan.l35.maintainedMin,4);
 assert.equal(plan.l4.raters.length,3);
 assert.equal(plan.l4.allowedWeakControlsMisratedExpertByAtLeast2of3Raters,0);
});