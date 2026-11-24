import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createPublicKey} from 'node:crypto';
import {ORDER,MARKER,MARKER_TEXT,guard,bound,actualUpperMicroUSD,checkFrozenPacket,buildOneShotRequest} from './v14-v46-stage1-api-capped.mjs';
import {IDS,HASHES,assertFrozenV46Source} from '../../src/coach/v14-v46-stage1-receipt.mjs';
test('exact eight unseen cases and one-time permission',()=>{
 assert.deepEqual(ORDER.map(x=>x.id),IDS);
 assert.equal(new Set(ORDER.map(x=>x.id)).size,8);
 const env={GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'push',GITHUB_RUN_ATTEMPT:'1',GITHUB_REF:'refs/heads/feat/coach-p2a-v46-stage1-api-capped',V46_STAGE1_APPROVAL:'EIGHT_MAX_40_CENTS_20261124',OPENAI_API_KEY:'dummy'};
 guard(env,'A\t'+MARKER,MARKER_TEXT);
 for(const e of [{GITHUB_RUN_ATTEMPT:'2'},{GITHUB_EVENT_NAME:'workflow_dispatch'},{GITHUB_REF:'refs/heads/main'},{OPENAI_API_KEY:''},{V46_STAGE1_APPROVAL:'expired'}])assert.throws(()=>guard({...env,...e},'A\t'+MARKER,MARKER_TEXT));
 assert.throws(()=>guard(env,'M\t'+MARKER,MARKER_TEXT));
 assert.throws(()=>guard(env,'A\t'+MARKER+'\nA\tother',MARKER_TEXT));
 assert.throws(()=>guard(env,'A\t'+MARKER,'wrong'));
});
test('padded highest 30m rate and output reasoning cap',()=>{
 for(const n of [1,5000,6000,8000,8800]){
  const b=bound(n);assert(b.maxMicroUSD<=48000&&b.outputCap>=2400&&b.outputCap<=3600);
  assert.equal(b.maxMicroUSD,Math.ceil(b.padded*2.5)+10*b.outputCap);
 }
 for(const n of [0,-1,10000,NaN,1.1])assert.throws(()=>bound(n));
 assert.equal(actualUpperMicroUSD({input_tokens:6000,output_tokens:3000}),45000);
 assert.throws(()=>actualUpperMicroUSD({output_tokens:1000}));
});
test('all frozen packets and typed conditions preserved in stateless structured payload',()=>{
 const source=JSON.parse(fs.readFileSync(process.env.V46_SOURCE,'utf8'));
 const frozen=assertFrozenV46Source(source);
 for(let i=0;i<8;i++){
  const packet=frozen[i].packet;
  assert.deepEqual(packet,JSON.parse(fs.readFileSync(process.env.V46_QUESTIONS+'/'+IDS[i]+'.json','utf8')));
  assert.equal(packet.requestHash,HASHES[i]);checkFrozenPacket(packet,IDS[i]);
  const p=buildOneShotRequest(packet),content=JSON.parse(p.input[1].content),s=p.text.format.schema;
  assert.equal(p.model,'gpt-6-sol');assert.equal(p.store,false);assert.equal(p.service_tier,'default');
  assert.equal(p.prompt_cache_options.ttl,'30m');assert.equal(p.reasoning.effort,'medium');
  assert(!p.tools&&!p.previous_response_id&&!p.conversation);
  for(const k of ['availableFactIds','conditionFacts','publicBrief','responseShape','warnings'])assert.deepEqual(content[k],packet.request[k]);
  assert.equal(content.requestHash,packet.requestHash);
  assert(p.input[0].content.startsWith(packet.request.system));
  assert.equal(s.properties.version.enum[0],'p2a-v46-compact-stage1-response-1');
  assert.deepEqual(s.properties.mostImportantOpponent.type,['integer','null']);
  assert(s.properties.tactics.properties.opponents.items.properties.changeCondition.properties.effect.anyOf.length===2);
  assert.deepEqual(s.properties.tactics.properties.reversal.properties.condition.properties.effect.properties.mode.enum,['switch']);
  assert.throws(()=>checkFrozenPacket({...packet,requestHash:'wrong'},IDS[i]));
 }
});
test('RSA recipient is valid',()=>{
 const p=createPublicKey(fs.readFileSync('research/p2a-v46-api/recipient-public.pem'));
 assert.equal(p.asymmetricKeyType,'rsa');assert.equal(p.asymmetricKeyDetails.modulusLength,4096);
});
