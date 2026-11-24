import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createPublicKey} from 'node:crypto';
import {IDS,assertFrozenV46Source} from '../../src/coach/v14-v46-stage1-receipt.mjs';
import {ORDER,MARKER,MARKER_TEXT,guard,bound,actualUpperMicroUSD,checkFrozenPacket,buildOneShotRequest} from './v14-v46-stage1-capped-api.mjs';
test('one shot exact order, marker only, fail closed',()=>{
 assert.deepEqual(ORDER.map(x=>x.id),IDS);
 const e={GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'push',GITHUB_RUN_ATTEMPT:'1',GITHUB_REF:'refs/heads/feat/coach-p2a-v46-stage1-capped-api',V46_STAGE1_APPROVAL:'EIGHT_MAX_40_CENTS_20261124',OPENAI_API_KEY:'dummy'};
 const change='A\t'+MARKER+'\n';
 guard(e,change,MARKER_TEXT);
 for(const patch of [{GITHUB_RUN_ATTEMPT:'2'},{GITHUB_EVENT_NAME:'workflow_dispatch'},{GITHUB_REF:'refs/heads/main'},{OPENAI_API_KEY:''},{V46_STAGE1_APPROVAL:'expired'}])assert.throws(()=>guard({...e,...patch},change,MARKER_TEXT));
 assert.throws(()=>guard(e,'M\t'+MARKER,MARKER_TEXT));
 assert.throws(()=>guard(e,change+'A\tother',MARKER_TEXT));
 assert.throws(()=>guard(e,change,'wrong'));
});
test('hard output caps with all input priced as 30m cache writes, including reasoning',()=>{
 for(const n of [1,3500,5500,6500,8000,8800]){
  const b=bound(n);assert(b.outputCap>=2400&&b.outputCap<=3600);
  assert(b.maxMicroUSD<=48000);
  assert.equal(b.maxMicroUSD,Math.ceil(b.padded*2.5)+b.outputCap*10);
 }
 for(const n of [0,10000,-1,NaN,1.1])assert.throws(()=>bound(n));
 assert.equal(actualUpperMicroUSD({input_tokens:6000,output_tokens:3000}),45000);
 assert.throws(()=>actualUpperMicroUSD({output_tokens:1}));
});
test('eight immutable packets and exact stateless schema, only public source',()=>{
 const source=JSON.parse(fs.readFileSync(process.env.V14_FOLLOWUP_PUBLIC,'utf8'));
 const locked=assertFrozenV46Source(source);
 for(let i=0;i<8;i++){
  const packet=locked[i].packet,id=IDS[i];
  assert.deepEqual(packet,JSON.parse(fs.readFileSync(process.env.V46_QUESTIONS+'/'+id+'.json','utf8')));
  checkFrozenPacket(packet,id);
  const p=buildOneShotRequest(packet);
  assert.deepEqual(p,buildOneShotRequest(packet));assert.equal(p.model,'gpt-6-sol');
  assert.equal(p.store,false);assert.equal(p.service_tier,'default');
  assert.equal(p.prompt_cache_options.ttl,'30m');assert.equal(p.reasoning.effort,'medium');
  assert(!p.previous_response_id&&!p.conversation&&!p.tools);
  const shape=p.text.format.schema.properties,body=JSON.parse(p.input[1].content);
  assert.equal(shape.version.enum[0],'p2a-v46-compact-stage1-response-1');
  assert.equal(shape.requestHash.enum[0],packet.requestHash);
  assert.deepEqual(shape.mostImportantOpponent.type,['integer','null']);
  assert.equal(shape.tactics.properties.opponents.items.properties.changeCondition.properties.effect.anyOf.length,2);
  assert.deepEqual(body.conditionFacts,packet.request.conditionFacts);
  assert.deepEqual(body.publicBrief,packet.request.publicBrief);
  assert.deepEqual(body.availableFactIds,packet.request.availableFactIds);
  assert.deepEqual(body.responseShape,packet.request.responseShape);
  assert(p.input[0].content.startsWith(packet.request.system));
  assert(!JSON.stringify(p).includes('DECOY_NOT_ALLOWED_AS_REAL_CHATGPT_BENCHMARK_RESULT'));
  assert.throws(()=>checkFrozenPacket({...packet,requestHash:'wrong'},id));
 }
});
test('valid recipient RSA4096 public key',()=>{
 const p=createPublicKey(fs.readFileSync('research/p2a-v46-api/recipient-public.pem'));
 assert.equal(p.asymmetricKeyType,'rsa');assert.equal(p.asymmetricKeyDetails.modulusLength,4096);
});
