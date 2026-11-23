import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {selectV45ProspectiveSmoke,V45_EIGHT,V45_EXCLUDED,V45_SOURCE_SHA}
 from '../../src/coach/v14-v45-smoke-selection.mjs';
import {createV45FrozenStage1} from './v14-v45-stage1-freeze.mjs';
import {hasV45ConditionalReversal} from '../../src/coach/v14-japanese-condition-v45.mjs';
const h=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const original=process.env.V14_FOLLOWUP_PUBLIC?
  JSON.parse(fs.readFileSync(process.env.V14_FOLLOWUP_PUBLIC,'utf8')):null;
test('v45 8 new source-only scene selection excludes 13 answered + entire v44 frozen 8',()=>{
 assert.equal(V45_EXCLUDED.length,21);
 assert.equal(new Set(V45_EXCLUDED).size,21);
 assert.deepEqual(V45_EIGHT,['pilot-41','pilot-45','pilot-54','pilot-55','pilot-60',
  'pilot-66','pilot-73','pilot-76']);
 assert.equal(new Set(V45_EIGHT).size,8);
 assert(V45_EIGHT.every(id=>!V45_EXCLUDED.includes(id)));
 if(!original)return;
 assert.equal(h(original),V45_SOURCE_SHA);
 const res=selectV45ProspectiveSmoke(original);
 assert.deepEqual(res.selectedIds,V45_EIGHT);
 assert.deepEqual(res.categoryCounts,{reach:2,call:3,discard:3});
 assert.equal(res.candidateUnusedPool.length,15);
 assert.equal(res.excludedPreviouslyFrozenOrGPTAnswered.length,21);
 assert.equal(res.noMortalLabels,true);
 assert.equal(res.gpt6ResponsesOnTheseEightAtFreeze,0);
});
test('all eight compact v45 packets bind to immutable source and fresh request hash',()=>{
 if(!original)return;
 const a=createV45FrozenStage1(original);
 const b=createV45FrozenStage1(original);
 assert.deepEqual(a,b);
 assert.deepEqual(a.publicManifest.selectedIds,V45_EIGHT);
 assert.equal(a.questions.length,8);
 assert.equal(a.verifierManifest.weakControls.controls.length,8);
 assert.equal(a.publicManifest.sourceHonbaPositive,2);
 assert.equal(a.publicManifest.sourceKyotakuPositive,5);
 for(const [i,q] of a.questions.entries()){
  const p=q.packet;
  assert.equal(q.caseId,V45_EIGHT[i]);
  assert.equal(p.requestHash,h(p.request));
  assert.equal(p.request.version,'p2a-v45-independent-public-brief-1');
  assert.equal(p.request.responseShape.version,'p2a-v45-compact-stage1-response-1');
  assert.equal(p.request.delivery.filename,
   'mahjong_P2a_v45_stage1_'+V45_EIGHT[i]+'_response.json');
  assert.equal(p.request.sourcePublicInputHash,q.envelope.request.sourcePublicInputHash);
  assert.equal(a.publicManifest.rows[i].packetHash,p.requestHash);
  assert.equal(a.publicManifest.rows[i].fullPacketSha256,h(p));
  assert(!JSON.stringify(p).includes('DECOY_NOT_ALLOWED'));
  assert(!JSON.stringify(p).includes('Mortal Q'));
  assert(Buffer.byteLength(JSON.stringify(p),'utf8')<=46000);
 }
 assert.throws(()=>createV45FrozenStage1([...original].reverse()),/source changed/);
});
test('new v45 verifier links v45 grammar, while original v44 files retain frozen grammar',()=>{
 const v45=fs.readFileSync('src/coach/v14-anchored-tactical-text-v45.mjs','utf8');
 const v44=fs.readFileSync('src/coach/v14-anchored-tactical-text-v44.mjs','utf8');
 assert(v45.includes("from './v14-japanese-condition-v45.mjs'"));
 assert(v45.includes('hasV45ConditionalReversal(o.changeCondition)'));
 assert(v45.includes('hasV45ConditionalReversal(t.reversal)'));
 assert(v44.includes("from './v14-japanese-condition-v43.mjs'"));
 assert(v44.includes('hasV43ConditionalReversal(o.changeCondition)'));
 assert.equal(hasV45ConditionalReversal('もし相手が立直したなら、守備を選びやすくする。'),true);
});
