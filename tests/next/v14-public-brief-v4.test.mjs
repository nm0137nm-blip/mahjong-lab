import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createV3IndependentDevelopmentRequest} from '../../src/coach/v14-independent-request-v3.mjs';
import {createV4PublicBrief} from '../../src/coach/v14-public-brief-v4.mjs';
const all=process.env.V14_FOLLOWUP_PUBLIC?
 JSON.parse(fs.readFileSync(process.env.V14_FOLLOWUP_PUBLIC,'utf8')):[];
test('deterministically condenses all 36 public source cases without model labels',()=>{
 if(!all.length)return;
 let maxBytes=0;
 for(const a of all){
  const source=createV3IndependentDevelopmentRequest(a);
  const output=createV4PublicBrief(source),next=createV4PublicBrief(source);
  assert.deepEqual(output,next);
  assert.equal(output.fullLegalCount,a.request.input.actions.length);
  assert(output.detailedCount<=4&&output.detailedCount>0);
  assert.equal(output.brief.opponents.length,3);
  assert.equal(output.brief.selectionUsesMortal,false);
  assert.equal(output.brief.selectionUsesModelAnswers,false);
  const plain=JSON.stringify(output.brief);
  for(const forbidden of ['mortalQ','modelReference','verifierLineage','hiddenHand','futureResult'])
   assert(!plain.includes(forbidden));
  maxBytes=Math.max(maxBytes,output.bytes);
  assert(output.bytes<20000);
 }
 assert(maxBytes>0);
});
test('pilot48 still places same-tile riichi and dama as deterministic detailed pair',()=>{
 const v=all.find(x=>x.request.input.id==='pilot-48');if(!v)return;
 const e=createV3IndependentDevelopmentRequest(v);
 const x=createV4PublicBrief(e),ids=x.brief.detailedCandidates.map(c=>c.key);
 assert.equal(x.brief.selectionRule,'strongest_public_reach_and_same_tile_silent');
 assert(ids.includes('a37-1'));
 assert(ids.includes('a13-0'));
 assert.equal(x.brief.allLegalActions.length,13);
 assert(x.bytes<Buffer.byteLength(JSON.stringify(e),'utf8')/2);
 assert.equal(x.brief.dealerProvenance.dealerSeat,0);
});
test('input mutation cannot silently update source digest or alter brief',()=>{
 const v=all.find(x=>x.request.input.id==='pilot-48');if(!v)return;
 const e=createV3IndependentDevelopmentRequest(v);
 const wrong=structuredClone(e);wrong.request.input.actions[0].detail='another';
 assert.throws(()=>createV4PublicBrief(wrong),/untrusted public packet/);
});

test('call candidate brief includes all legal concrete after-call discards, not a fictional pre-choice tenpai',()=>{
 const v=all.find(x=>x.request.input.id==='pilot-59');if(!v)return;
 const e=createV3IndependentDevelopmentRequest(v),res=createV4PublicBrief(e);
 const call=res.brief.detailedCandidates.find(x=>x.key==='a41-0');
 assert(call);
 assert.equal(call.shanten,null);
 assert(call.afterCallDiscards.length>0);
 const m4=call.afterCallDiscards.find(x=>x.discard==='m4');
 assert(m4);
 assert.equal(m4.shanten,0);
 assert.equal(m4.ownRiverFuriten,false);
 assert(m4.conditionalNormalWins.some(x=>x.tile==='p0'));
 assert.equal(res.brief.dealerProvenance.dealerSeat,0);
});
