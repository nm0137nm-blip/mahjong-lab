import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createPublicKey} from 'node:crypto';
import {ORDER,MARKER,MARKER_TEXT,guard,bound,actualUpperMicroUSD,checkFrozenPacket,buildOneShotRequest} from './v14-v46-stage1-capped.mjs';
import {assertFrozenV46Source,IDS,HASHES} from '../../src/coach/v14-v46-stage1-receipt.mjs';
test('fixed original eight only',()=>assert.deepEqual(ORDER.map(x=>x.id),IDS));
test('one-time authorization, fail closed',()=>{
 const env={GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'push',GITHUB_RUN_ATTEMPT:'1',GITHUB_REF:'refs/heads/feat/coach-p2a-v46-api-capped',V46_STAGE1_APPROVAL:'EIGHT_MAX_40_CENTS_20261124',OPENAI_API_KEY:'dummy'};
 const change='A\t'+MARKER+'\n';guard(env,change,MARKER_TEXT);
 for(const patch of [{GITHUB_RUN_ATTEMPT:'2'},{GITHUB_EVENT_NAME:'workflow_dispatch'},{GITHUB_REF:'refs/heads/main'},{OPENAI_API_KEY:''},{V46_STAGE1_APPROVAL:'expired'}])assert.throws(()=>guard({...env,...patch},change,MARKER_TEXT));
 assert.throws(()=>guard(env,'M\t'+MARKER,MARKER_TEXT));
 assert.throws(()=>guard(env,change+'A\tother',MARKER_TEXT));
 assert.throws(()=>guard(env,change,'wrong'));
});
test('padded token price conservative cap',()=>{
 for(const count of [1,4000,6000,8000,8800]){
 const b=bound(count);assert(b.outputCap>=2400&&b.outputCap<=3600);assert(b.maxMicroUSD<=48000);
 assert.equal(b.maxMicroUSD,Math.ceil(b.padded*2.5)+b.outputCap*10);
 }
 for(const n of [0,-1,10000,NaN,1.1])assert.throws(()=>bound(n));
 assert.equal(actualUpperMicroUSD({input_tokens:6000,output_tokens:3000}),45000);
});
test('all eight exact frozen packets and transport schema',()=>{
 const source=JSON.parse(fs.readFileSync(process.env.V46_SOURCE,'utf8')),sealed=assertFrozenV46Source(source);
 for(const [i,caseId] of IDS.entries()){
 const p=sealed[i].packet;
 assert.deepEqual(p,JSON.parse(fs.readFileSync(process.env.V46_QUESTIONS+'/'+caseId+'.json','utf8')));
 checkFrozenPacket(p,caseId);
 const api=buildOneShotRequest(p),s=api.text.format.schema;
 assert.equal(api.model,'gpt-6-sol');assert.equal(api.store,false);assert.equal(api.service_tier,'default');assert.equal(api.prompt_cache_options.ttl,'30m');assert.equal(api.reasoning.effort,'medium');
 assert(!api.previous_response_id&&!api.conversation&&!api.tools);
 assert(api.input[0].content.startsWith(p.request.system));
 const input=JSON.parse(api.input[1].content);
 for(const key of ['availableFactIds','conditionFacts','publicBrief','responseShape','warnings'])assert.deepEqual(input[key],p.request[key]);
 assert.equal(input.requestHash,HASHES[i]);assert.equal(s.properties.requestHash.enum[0],HASHES[i]);assert(s.required.includes('mostImportantOpponent'));
 assert.equal(s.properties.tactics.properties.opponents.items.properties.changeCondition.properties.effect.anyOf.length,2);
 assert.equal(s.properties.tactics.properties.reversal.properties.condition.properties.predicates.items.properties.value.anyOf.length,2);
 assert.throws(()=>checkFrozenPacket({...p,requestHash:'wrong'},caseId));
 }
 const key=createPublicKey(fs.readFileSync('research/p2a-v46-api/recipient-public.pem'));assert.equal(key.asymmetricKeyDetails.modulusLength,4096);
});
