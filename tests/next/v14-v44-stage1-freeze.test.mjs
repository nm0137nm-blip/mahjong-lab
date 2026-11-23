import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {selectV44ProspectiveSmoke,V44_EIGHT,V44_EXCLUDED_ANSWERED}
 from '../../src/coach/v14-v44-smoke-selection.mjs';
import {createV44FrozenStage1,V44_SOURCE_SHA} from './v14-v44-stage1-freeze.mjs';
const frozen=process.env.V14_FOLLOWUP_PUBLIC?
 JSON.parse(fs.readFileSync(process.env.V14_FOLLOWUP_PUBLIC,'utf8')):[];
const h=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
test('source selection is fully blind and excludes all previously GPT-exposed 13 scenes',()=>{
 if(!frozen.length)return;
 assert.equal(h(frozen),V44_SOURCE_SHA);
 const p=selectV44ProspectiveSmoke(frozen);
 assert.deepEqual(p.selectedIds,V44_EIGHT);
 assert.deepEqual(p.selectedIds,['pilot-46','pilot-51','pilot-56','pilot-64','pilot-53','pilot-69','pilot-65','pilot-74']);
 assert.equal(new Set(p.selectedIds).size,8);
 assert.equal(V44_EXCLUDED_ANSWERED.length,13);
 for(const old of V44_EXCLUDED_ANSWERED)assert(!p.selectedIds.includes(old));
 assert.equal(p.selectionUsesMortal,false);
 assert.equal(p.selectionUsesPastModelReplies,false);
 assert.equal(p.newGPT6AnswersAtFreeze,0);
 assert.deepEqual(p.categoryCounts,{reach:2,call:3,discard:3});
});
test('eight new source-bound v44 prompts are deterministic, separate from sealed weak control, and JSON file-only',()=>{
 if(!frozen.length)return;
 const x=createV44FrozenStage1(frozen),y=createV44FrozenStage1(frozen);
 assert.deepEqual(x,y);
 assert.equal(x.questions.length,8);
 assert.deepEqual(x.publicManifest.selectedIds,V44_EIGHT);
 assert.equal(x.publicManifest.newV44IndependentResponsesAtFreeze,0);
 assert.equal(x.publicManifest.sourceHonbaPositive,3);
 assert(x.publicManifest.sourceKyotakuPositive>=4);
 assert.equal(x.verifierManifest.weakControls.controls.length,8);
 assert.equal(x.publicManifest.fileDeliveryRequired,true);
 for(let i=0;i<8;i++){
  const q=x.questions[i],p=q.packet;
  assert.equal(q.caseId,V44_EIGHT[i]);
  assert.equal(p.request.version,'p2a-v44-independent-public-brief-1');
  assert.equal(p.request.responseShape.version,'p2a-v44-compact-stage1-response-1');
  assert.equal(p.requestHash,h(p.request));
  assert.equal(p.request.delivery.filename,'mahjong_P2a_v44_stage1_'+q.caseId+'_response.json');
  assert.equal(p.request.sourcePublicInputHash,q.envelope.request.sourcePublicInputHash);
  assert.equal(x.publicManifest.rows[i].packetHash,p.requestHash);
  assert.equal(x.publicManifest.rows[i].fullPacketSha256,h(p));
  assert(p.request.system.includes('standardShanten'));
  assert(p.request.system.includes('UTF-8'));
  assert(!JSON.stringify(p).includes('DECOY_NOT_ALLOWED'));
  assert(Buffer.byteLength(JSON.stringify(p),'utf8')<=46000);
 }
});
test('source file alteration or case order changes rejected before any GPT output',()=>{
 if(!frozen.length)return;
 const x=structuredClone(frozen);
 x[0].request.input.id='pilot-999';
 assert.throws(()=>createV44FrozenStage1(x),/original public source changed/);
 assert.throws(()=>createV44FrozenStage1(structuredClone(frozen).reverse()),/original public source changed/);
});
