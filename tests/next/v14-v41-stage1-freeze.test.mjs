import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createV41FrozenStage1} from './v14-v41-stage1-freeze.mjs';
import {V41_EXPECTED_EIGHT,selectV41ProspectiveSmoke} from '../../src/coach/v14-v41-smoke-selection.mjs';
import {createV41CompactDevelopmentPacket} from '../../src/coach/v14-compact-model-contract-v41.mjs';
import {createV3IndependentDevelopmentRequest} from '../../src/coach/v14-independent-request-v3.mjs';
import {containsV41UnanchoredQuantity,findV41UnanchoredQuantity} from '../../src/coach/v14-numeric-guard-v41.mjs';
const frozen=process.env.V14_FOLLOWUP_PUBLIC?
 JSON.parse(fs.readFileSync(process.env.V14_FOLLOWUP_PUBLIC,'utf8')):[];
const h=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
test('v41 never changes earlier v4 answer or reuses already answered pilot42; first replacement source is SHA-first honba+ pilot50',()=>{
 if(!frozen.length)return;
 const selection=selectV41ProspectiveSmoke(frozen);
 assert.deepEqual(selection.selectedIds,V41_EXPECTED_EIGHT);
 assert.equal(selection.firstReplacementCaseId,'pilot-50');
 assert(!selection.selectedIds.includes('pilot-42'));
 assert(!selection.selectedIds.includes('pilot-48'));
 assert.deepEqual(selection.selectedIds.slice(1),['pilot-47','pilot-59','pilot-62','pilot-63','pilot-71','pilot-70','pilot-67']);
});
test('v41 frozen 8 public model questions deterministic, short, hash-bound, model-free and separate masked controls',()=>{
 if(!frozen.length)return;
 const a=createV41FrozenStage1(frozen),b=createV41FrozenStage1(frozen);
 assert.deepEqual(a,b);
 assert.equal(a.questions.length,8);
 assert.equal(a.publicManifest.rows.length,8);
 assert.equal(a.verifierManifest.weakControls.controls.length,8);
 assert.equal(a.publicManifest.newV41ModelAttemptsAtFreeze,0);
 assert.equal(a.publicManifest.originalV4ModelAttempts,1);
 for(const [i,x] of a.questions.entries()){
  assert.equal(x.caseId,V41_EXPECTED_EIGHT[i]);
  assert.equal(x.packet.request.version,'p2a-v41-independent-public-brief-1');
  assert.equal(x.packet.request.responseShape.version,'p2a-v41-compact-stage1-response-1');
  assert.equal(a.publicManifest.rows[i].packetHash,x.packet.requestHash);
  assert.equal(a.publicManifest.rows[i].serializedPacketSha256,h(x.packet));
  assert(!JSON.stringify(x.packet).includes('DECOY_NOT_ALLOWED'));
  assert(!JSON.stringify(x.packet).includes('sourceCluster'));
  assert(!JSON.stringify(x.packet).includes('hiddenHand'));
  assert(Buffer.byteLength(JSON.stringify(x.packet),'utf8')<46000);
 }
 assert.equal(a.publicManifest.counts.honbaPositive,3);
 assert.equal(a.publicManifest.counts.kyotakuPositive,5);
});
test('frozen source change fails closure before any new model response',()=>{
 if(!frozen.length)return;
 const d=structuredClone(frozen);d[0].request.input.id='pilot-999';
 assert.throws(()=>createV41FrozenStage1(d),/frozen source drift/);
});
test('ordinary Japanese numeral-containing words are accepted, but points and exact tile counts are rejected',()=>{
 const okay=['一致','一方','一般論','万が一','一盃口','二盃口','三色同順','四暗刻','一発','一層','全員が同じ'];
 const bad=['3900点','３９００点','1,000点','四巡','二枚','一万点','三千九百点','一萬','五筒','四索','十点','三翻','三本場'];
 for(const x of okay)assert.equal(findV41UnanchoredQuantity(x),null,x);
 for(const x of bad)assert.equal(containsV41UnanchoredQuantity(x),true,x);
});
