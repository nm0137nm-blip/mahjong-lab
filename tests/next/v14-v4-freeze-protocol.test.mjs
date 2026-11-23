import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {prepareV4PreregisteredPublicPrivate} from './v14-v4-freeze-protocol.mjs';
import {P2A_V4_FIXED_EIGHT,P2A_V4_PACKET_HASHES} from '../../src/coach/v14-v4-evaluation-plan.mjs';
const frozen=process.env.V14_FOLLOWUP_PUBLIC?
 JSON.parse(fs.readFileSync(process.env.V14_FOLLOWUP_PUBLIC,'utf8')):[];
const h=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
test('public and private compartments separately hash-lock same original eight requests, preserve zero model replies',()=>{
 if(!frozen.length)return;
 const a=prepareV4PreregisteredPublicPrivate(frozen),b=prepareV4PreregisteredPublicPrivate(frozen);
 assert.deepEqual(a,b);
 assert.deepEqual(a.publicManifest.selectedIds,P2A_V4_FIXED_EIGHT);
 assert.deepEqual(a.publicManifest.sourcePacketHashes,P2A_V4_PACKET_HASHES);
 assert.equal(a.model.length,8);
 assert.equal(a.publicManifest.allRealResponsesAtFreeze,0);
 assert.equal(a.verifierManifest.fixedControls.controls.length,8);
 assert.equal(a.verifierManifest.allRealL4JudgesAtFreeze,0);
 assert.equal(a.publicManifest.sourceControlBatchSha256,h(a.verifierManifest.fixedControls));
 assert.equal(a.verifierManifest.sourcePackSha256,h(a.model.map(x=>({id:x.caseId,packet:x.packet}))));
});
test('model request never contains sealed weak-control text or grader scores',()=>{
 if(!frozen.length)return;
 const a=prepareV4PreregisteredPublicPrivate(frozen);
 for(const m of a.model){
  const text=JSON.stringify(m.packet);
  assert(!text.includes('DECOY_NOT_ALLOWED'));
  assert(!text.includes('fabricated_unmeasured_probability'));
  assert(!text.includes('wrong_opponent_attribution'));
  assert(!text.includes('sourceControlBatchSha256'));
  assert(!text.includes('Mortal Q values'));
  assert(!text.includes('privateHands'));
  assert(m.packet.request.responseShape);
 }
});
test('tampered or order-changed original case feed fails strict publication freeze',()=>{
 if(!frozen.length)return;
 const x=structuredClone(frozen);
 x[0].request.input.id='pilot-evil';
 assert.throws(()=>prepareV4PreregisteredPublicPrivate(x),/frozen source changed/);
 const y=structuredClone(frozen).reverse();
 assert.throws(()=>prepareV4PreregisteredPublicPrivate(y),/frozen source changed/);
});
