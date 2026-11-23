import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {buildOneShotRequest,costCeilingUSD,checkFrozenPacket,extractRawOutput,run} from './v14-v44-api-onecase.mjs';
import {P2A_V44_FIXED_EIGHT as CASES} from '../../src/coach/v14-v44-evaluation-plan.mjs';
const frozen=process.env.V14_FOLLOWUP_PUBLIC;
const dir=process.env.V14_V44_QUESTIONS_DIR;
test('all 8 exact immutable question packets generate valid independent requests in dry run without any API',async()=>{
 assert.ok(frozen&&dir,'CI must provide original public source and frozen packets');
 for(const caseId of CASES){
  const p=path.join(dir,caseId+'.json');
  const packet=JSON.parse(await fs.readFile(p,'utf8'));
  const checked=checkFrozenPacket(packet,caseId);
  const body=buildOneShotRequest(packet);
  assert.equal(body.model,'gpt-6-sol');
  assert.equal(body.store,false);
  assert.equal(body.input.length,2);
  assert.ok(body.input[1].content.includes(packet.requestHash));
  assert.equal(body.text.format.schema.properties.requestHash.enum[0],packet.requestHash);
  const bound=costCeilingUSD(body);
  assert.ok(bound.upperUSD<=0.30);
  assert.equal(bound.budgetUSD,0.30);
  assert.equal(checked.caseId,caseId);
  const result=await run(['--mode=dry-run','--question='+p,'--frozen='+frozen,'--case='+caseId],{});
  assert.equal(result.networkRequests,0);
  assert.ok(result.costPreflight.upperUSD<=0.30);
  assert.equal(result.notCountedAsModelResponse,true);
 }
});
test('tampering and unapproved API access fail closed',async()=>{
 const packet=JSON.parse(await fs.readFile(path.join(dir,'pilot-46.json'),'utf8'));
 const copy=structuredClone(packet);
 copy.request.publicBrief.caseId='pilot-70';
 assert.throws(()=>checkFrozenPacket(copy,'pilot-46'),/original/);
 assert.throws(()=>buildOneShotRequest(packet,'gpt-5'),/only GPT-6/);
 const over=buildOneShotRequest(packet);
 over.max_output_tokens=30000;
 assert.throws(()=>costCeilingUSD(over),/unapproved output token cap/);
 assert.throws(()=>extractRawOutput({status:'incomplete',output:[]}),/completed/);
 await assert.rejects(()=>run(['--mode=live','--question='+path.join(dir,'pilot-46.json'),
  '--frozen='+frozen,'--case=pilot-46'],{}),/consent confirmation/);
 await assert.rejects(()=>run(['--mode=live','--question='+path.join(dir,'pilot-46.json'),
  '--frozen='+frozen,'--case=pilot-46','--ack=I_APPROVE_ONE_API_REQUEST'],
  {GITHUB_ACTIONS:'true',OPENAI_API_KEY:'dummy'}),/disabled in public GitHub Actions/);
});
