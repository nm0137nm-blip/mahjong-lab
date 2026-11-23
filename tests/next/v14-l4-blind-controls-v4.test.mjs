import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createV3IndependentDevelopmentRequest} from '../../src/coach/v14-independent-request-v3.mjs';
import {selectV4ProspectiveSmoke} from '../../src/coach/v14-v4-smoke-selection.mjs';
import {createV4BlindControlBatch} from '../../src/coach/v14-l4-blind-controls-v4.mjs';
const inputs=process.env.V14_FOLLOWUP_PUBLIC?
 JSON.parse(fs.readFileSync(process.env.V14_FOLLOWUP_PUBLIC,'utf8')):[];
const h=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
function batch(){
 const selected=selectV4ProspectiveSmoke(inputs).selectedIds;
 const envelopes=inputs.filter(x=>selected.includes(x.request.input.id))
  .map(createV3IndependentDevelopmentRequest);
 return createV4BlindControlBatch(envelopes,selected);
}
test('all eight controls locked before any real model answers and exactly two of four attacks',()=>{
 if(!inputs.length)return;
 const a=batch(),b=batch();
 assert.deepEqual(a,b);
 assert.equal(a.controls.length,8);
 assert.deepEqual(a.controls.map(x=>x.kind),[
  'generic_public_template','wrong_opponent_attribution',
  'fabricated_unmeasured_probability','reversed_known_rank_condition',
  'generic_public_template','wrong_opponent_attribution',
  'fabricated_unmeasured_probability','reversed_known_rank_condition']);
 for(const r of a.controls){
  assert.equal(r.lockedBytesHash,h(r.maskedPresentation));
  assert.equal(r.maskedPresentation.opponents.length,3);
  assert.equal(new Set(r.maskedPresentation.opponents.map(x=>x.seat)).size,3);
  assert.equal(r.maskedPresentation.caseId,r.caseId);
  assert.equal(r.role,'DECOY_NOT_ALLOWED_AS_REAL_CHATGPT_BENCHMARK_RESULT');
 }
});
test('weak controls actually include intended defect and never embed S42 reference or hidden hand',()=>{
 if(!inputs.length)return;
 const b=batch();
 for(const r of b.controls){
  const text=JSON.stringify(r.maskedPresentation);
  assert(!text.includes('mortalQ')&&!text.includes('privateHands')&&!text.includes('oracle'));
  switch(r.kind){
   case 'generic_public_template':
    assert(text.includes('危険なら降り'));
    break;
   case 'wrong_opponent_attribution':
    assert(text.includes('別の席の数字'));
    break;
   case 'fabricated_unmeasured_probability':
    assert(text.includes('95%'));
    break;
   case 'reversed_known_rank_condition':
    assert(text.includes('順位が落ちる')||text.includes('順位は絶対に変わらない'));
    break;
  }
 }
});
test('blinding manifest enforces one control per original case with no labels leaking into a ChatGPT input',()=>{
 if(!inputs.length)return;
 const b=batch();
 assert.deepEqual(b.originalCaseOrder,selectV4ProspectiveSmoke(inputs).selectedIds);
 assert(!Object.hasOwn(b,'realModelResponses'));
 assert(!b.controls.some(x=>Object.hasOwn(x.maskedPresentation,'origin')));
});
