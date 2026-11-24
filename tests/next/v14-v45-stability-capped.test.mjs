import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createPublicKey} from 'node:crypto';
import {ORDER,MARKER,MARKER_TEXT,guard,bound,actualUpperMicroUSD,checkFrozenPacket,buildOneShotRequest}
 from './v14-v45-stability-capped.mjs';
import {createV45FrozenStage1} from './v14-v45-stage1-freeze.mjs';
test('exact fixed order, unique eight, no retry',()=>{
 assert.deepEqual(ORDER.map(x=>x.id),['pilot-41-r1','pilot-41-r2','pilot-45-r1','pilot-45-r2','pilot-54-r1','pilot-54-r2','pilot-55-r1','pilot-55-r2']);
});
test('fail closed one-time marker, rerun, dispatch, wrong branch or key',()=>{
 const e={GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'push',GITHUB_RUN_ATTEMPT:'1',GITHUB_REF:'refs/heads/feat/coach-p2a-v45-stability-capped',V45_STABILITY_APPROVAL:'EIGHT_MAX_40_CENTS_20261124',OPENAI_API_KEY:'dummy'};
 const change='A\t'+MARKER+'\n';
 guard(e,change,MARKER_TEXT);
 for(const patch of [{GITHUB_RUN_ATTEMPT:'2'},{GITHUB_EVENT_NAME:'workflow_dispatch'},{GITHUB_REF:'refs/heads/main'},{OPENAI_API_KEY:''},{V45_STABILITY_APPROVAL:'expired'}])
  assert.throws(()=>guard({...e,...patch},change,MARKER_TEXT));
 assert.throws(()=>guard(e,'M\t'+MARKER,MARKER_TEXT));
 assert.throws(()=>guard(e,change+'A\tother',MARKER_TEXT));
 assert.throws(()=>guard(e,change,'wrong'));
});
test('padded maximum 30m cache write cost and all output tokens; reject inadequate cap',()=>{
 for(const n of [1,3791,5000,6165,6500,8000,8800]){
  const b=bound(n);
  assert(b.outputCap>=2400&&b.outputCap<=3600);
  assert(b.maxMicroUSD<=48000);
  assert(b.padded>=n);
  assert.equal(b.maxMicroUSD,Math.ceil(b.padded*2.5)+b.outputCap*10);
 }
 for(const n of [0,-1,10000,NaN,1.1])assert.throws(()=>bound(n));
 assert.equal(actualUpperMicroUSD({input_tokens:6000,output_tokens:3000}),45000);
 assert.throws(()=>actualUpperMicroUSD({output_tokens:1000}));
});
test('all four immutable packets use the same exact stateless input per repeat; no old replies or model labels',()=>{
 assert(process.env.V14_FOLLOWUP_PUBLIC);
 const source=JSON.parse(fs.readFileSync(process.env.V14_FOLLOWUP_PUBLIC,'utf8'));
 const sealed=createV45FrozenStage1(source);
 for(const {caseId} of ORDER.filter(x=>x.rep===1)){
  const packet=sealed.questions.find(q=>q.caseId===caseId).packet;
  const artifact=JSON.parse(fs.readFileSync(process.env.V45_QUESTIONS+'/'+caseId+'.json','utf8'));
  assert.deepEqual(packet,artifact);
  checkFrozenPacket(packet,caseId);
  const p=buildOneShotRequest(packet);
  assert.deepEqual(p,buildOneShotRequest(packet));
  assert.equal(p.model,'gpt-6-sol');
  assert.equal(p.store,false);
  assert.equal(p.service_tier,'default');
  assert.equal(p.prompt_cache_options.ttl,'30m');
  assert.equal(p.reasoning.effort,'medium');
  assert(!p.previous_response_id&&!p.conversation&&!p.tools);
  assert.equal(p.text.format.schema.properties.version.enum[0],'p2a-v45-compact-stage1-response-1');
  assert.equal(p.text.format.schema.properties.requestHash.enum[0],packet.requestHash);
  assert(p.input[0].content.startsWith(packet.request.system));
  assert.equal(JSON.parse(p.input[1].content).requestHash,packet.requestHash);
  assert.throws(()=>checkFrozenPacket({...packet,requestHash:'wrong'},caseId));
 }
});
test('recipient public key valid RSA4096',()=>{
 const p=createPublicKey(fs.readFileSync('research/p2a-v45-stability/recipient-public.pem'));
 assert.equal(p.asymmetricKeyType,'rsa');assert.equal(p.asymmetricKeyDetails.modulusLength,4096);
});
