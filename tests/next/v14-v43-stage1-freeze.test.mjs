import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createV43FrozenStage1,V43_SOURCE_SHA} from './v14-v43-stage1-freeze.mjs';
import {selectV43ProspectiveSmoke,V43_FROZEN_IDS} from '../../src/coach/v14-v43-smoke-selection.mjs';
const frozen=process.env.V14_FOLLOWUP_PUBLIC?JSON.parse(fs.readFileSync(process.env.V14_FOLLOWUP_PUBLIC,'utf8')):[];
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
test('unchanged original 36 scenarios and pure-public no-GPT-answer 3-replacement panel',()=>{
 if(!frozen.length)return;
 assert.equal(hash(frozen),V43_SOURCE_SHA);
 const x=selectV43ProspectiveSmoke(frozen);
 assert.deepEqual(x.selectedIds,V43_FROZEN_IDS);
 assert.deepEqual(x.selectedIds,['pilot-43','pilot-49','pilot-57','pilot-62','pilot-63','pilot-71','pilot-70','pilot-67']);
 assert.deepEqual(x.selectedIds.slice(3),['pilot-62','pilot-63','pilot-71','pilot-70','pilot-67']);
 for(const id of ['pilot-48','pilot-42','pilot-50','pilot-52','pilot-47','pilot-59'])
  assert(!x.selectedIds.includes(id));
 assert.equal(x.priorModelResponseUse,false);
 assert.equal(x.teacherS42LabelsUsed,false);
 assert.equal(x.independentModelAnswersAtFreeze,0);
});
test('v43 eight bounded response-as-file public prompts hash-bound to genuine source; controls sealed',()=>{
 if(!frozen.length)return;
 const a=createV43FrozenStage1(frozen),b=createV43FrozenStage1(frozen);
 assert.deepEqual(a,b);
 assert.equal(a.questions.length,8);
 assert.deepEqual(a.questions.map(q=>q.caseId),V43_FROZEN_IDS);
 assert.equal(a.publicManifest.rows.length,8);
 assert.equal(a.publicManifest.sourceHonbaPositive,3);
 assert.equal(a.publicManifest.sourceKyotakuPositive,4);
 assert.equal(a.publicManifest.newV43IndependentResponsesAtFreeze,0);
 assert.equal(a.verifierManifest.weakControls.controls.length,8);
 assert.equal(a.publicManifest.fileDeliveryRequired,true);
 for(const [i,q] of a.questions.entries()){
  assert.equal(q.packet.request.version,'p2a-v43-independent-public-brief-1');
  assert.equal(q.packet.request.responseShape.version,'p2a-v43-compact-stage1-response-1');
  assert.equal(q.packet.requestHash,hash(q.packet.request));
  assert.equal(q.packet.request.sourcePublicInputHash,q.envelope.request.sourcePublicInputHash);
  assert.equal(q.packet.request.delivery.filename,'mahjong_P2a_v43_stage1_'+q.caseId+'_response.json');
  assert.equal(a.publicManifest.rows[i].packetHash,q.packet.requestHash);
  assert.equal(a.publicManifest.rows[i].fullPacketSha256,hash(q.packet));
  assert(!JSON.stringify(q.packet).includes('DECOY_NOT_ALLOWED'));
  assert(!JSON.stringify(q.packet).includes('hiddenHands'));
  assert(!JSON.stringify(q.packet).includes('referenceChanged'));
  assert(Buffer.byteLength(JSON.stringify(q.packet),'utf8')<=46000);
 }
});
test('modified or reordered original 36 cannot silently change experiment questions',()=>{
 if(!frozen.length)return;
 const a=structuredClone(frozen);
 a[0].request.input.id='pilot-999';
 assert.throws(()=>createV43FrozenStage1(a),/original public source changed/);
 const b=structuredClone(frozen).reverse();
 assert.throws(()=>createV43FrozenStage1(b),/original public source changed/);
});
