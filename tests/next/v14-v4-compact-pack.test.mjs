import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {buildV4DraftPublicPack} from './v14-v4-compact-pack.mjs';
const sources=process.env.V14_FOLLOWUP_PUBLIC?
 JSON.parse(fs.readFileSync(process.env.V14_FOLLOWUP_PUBLIC,'utf8')):[];
const h=x=>createHash('sha256').update(x).digest('hex');
test('prospective public-only 8 question files preserve order, provenance and nonzero honba coverage without a model response',()=>{
 if(!sources.length)return;
 const p=buildV4DraftPublicPack(sources),q=buildV4DraftPublicPack(sources);
 assert.deepEqual(p,q);
 assert.equal(p.manifest.status,'DEVELOPMENT_PACKAGE_NOT_PREREGISTERED_DO_NOT_SEND_TO_MODELS_YET');
 assert.equal(p.questions.length,8);
 assert.deepEqual(p.questions.map(q=>q.id),p.manifest.selection.selectedIds);
 assert(!p.questions.map(q=>q.id).includes('pilot-48'));
 assert(p.manifest.selection.positiveHonbaCaseCount>=3);
 assert(p.manifest.selection.kyotakuPresentCaseCount>=1);
 assert.equal(p.manifest.genuineIndependentChatGPTReplies,0);
 for(const [i,row] of p.questions.entries()){
  assert.equal(row.packet.request.publicBrief.caseId,row.id);
  assert.equal(row.packetHash,row.packet.requestHash);
  assert.equal(row.sha256,h(JSON.stringify(row.packet)));
  assert.equal(row.packet.request.version,'p2a-v4-independent-public-brief-1');
  assert.equal(row.modelAnswer,null);
  assert(!JSON.stringify(row.packet.request.publicBrief).includes('privateHands'));
  assert(!JSON.stringify(row.packet.request.publicBrief).includes('mortalReference'));
  assert.equal(p.manifest.questions[i].sha256,row.sha256);
 }
});
test('pre-selected trial cannot re-use answer-stained pilot48 after revising a public action',()=>{
 if(!sources.length)return;
 const modified=structuredClone(sources);
 const x=modified.find(x=>x.request.input.id==='pilot-42');
 x.request.input.actions[0].detail='fake';
 assert.throws(()=>buildV4DraftPublicPack(modified),/source public hash mismatch|untrusted frozen public/);
});
