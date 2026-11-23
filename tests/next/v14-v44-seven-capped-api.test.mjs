import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {generateKeyPairSync,privateDecrypt,createDecipheriv,constants} from 'node:crypto';
import {BATCH_VERSION,CASE_ORDER,guardOneTime,budgetFromExactTokenCount,
  estimateUsageUSD,PER_CALL_CAP_USD,APPROVAL_MARKER_TEXT,APPROVAL_MARKER}
 from './v14-v44-seven-capped-api.mjs';
import {makeEncryptedArchive} from './v14-v44-pilot46-single-live-actions.mjs';
import {P2A_V44_FIXED_EIGHT} from '../../src/coach/v14-v44-evaluation-plan.mjs';
const standard={GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'push',GITHUB_RUN_ATTEMPT:'1',
 GITHUB_REF:'refs/heads/feat/coach-p2a-v44-api-seven-capped',
 V44_SEVEN_APPROVAL:'SEVEN_AT_MOST_005_20261124',
 OPENAI_API_KEY:'TEST_ONLY_KEY_NEVER_SENT'};
test('API research track is exactly seven untouched pilot51..74 after pilot46',()=>{
 assert.equal(BATCH_VERSION,'p2a-v44-api-exploratory-frozen-seven-v1');
 assert.deepEqual(CASE_ORDER,P2A_V44_FIXED_EIGHT.slice(1));
 assert.equal(CASE_ORDER.length,7);
 assert.ok(!CASE_ORDER.includes('pilot-46'));
});
test('approved original commit only, no modification, no manual rerun, no missing secret',()=>{
 guardOneTime(standard,'A\t'+APPROVAL_MARKER+'\n',APPROVAL_MARKER_TEXT);
 for(const bad of [
  {...standard,GITHUB_RUN_ATTEMPT:'2'},
  {...standard,GITHUB_REF:'refs/heads/main'},
  {...standard,V44_SEVEN_APPROVAL:'NO_APPROVAL'},
  {...standard,OPENAI_API_KEY:''}])
  assert.throws(()=>guardOneTime(bad,'A\t'+APPROVAL_MARKER+'\n',APPROVAL_MARKER_TEXT),/BATCH_PRECONDITIONS/);
 assert.throws(()=>guardOneTime(standard,'M\t'+APPROVAL_MARKER+'\n',APPROVAL_MARKER_TEXT),/BATCH_NOT_FIRST_ADDITION/);
 assert.throws(()=>guardOneTime(standard,'A\t'+APPROVAL_MARKER+'\n','tampered'),/BATCH_MARKER_CONTENT/);
 assert.throws(()=>guardOneTime(standard,'A\t'+APPROVAL_MARKER+'\nA\textra.txt\n',APPROVAL_MARKER_TEXT),/BATCH_NOT_FIRST_ADDITION/);
});
test('free exact count bounds billed generation below five cents, including capped reasoning',()=>{
 for(const n of [3500,5785,7500,9000,10000,11000]){
  const guard=budgetFromExactTokenCount(n);
  assert.ok(guard.preflightMaxUSD<=0.048001);
  assert.ok(guard.preflightMaxUSD<PER_CALL_CAP_USD);
  assert.ok(guard.outputTokensHardCap>=2400&&guard.outputTokensHardCap<=3200);
 }
 assert.throws(()=>budgetFromExactTokenCount(20000),/BATCH_OUTPUT_ALLOWANCE_TOO_SHORT/);
 assert.throws(()=>budgetFromExactTokenCount(0),/BATCH_TOKEN_COUNT_INVALID/);
 assert.equal(estimateUsageUSD({input_tokens:5785,output_tokens:2336}),0.03493);
});
test('RSA private decrypt recovers raw receipt, public artifact never contains plaintext',()=>{
 const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048,
   publicKeyEncoding:{format:'pem',type:'spki'},
   privateKeyEncoding:{format:'pem',type:'pkcs8'}});
 const raw='private first answer and full receipt';
 const encoded=makeEncryptedArchive(JSON.stringify({raw}),publicKey);
 assert.ok(!JSON.stringify(encoded).includes(raw));
 const aes=privateDecrypt({key:privateKey,padding:constants.RSA_PKCS1_OAEP_PADDING,
   oaepHash:'sha256'},Buffer.from(encoded.wrappedKey,'base64'));
 const dec=createDecipheriv('aes-256-gcm',aes,Buffer.from(encoded.iv,'base64'));
 dec.setAuthTag(Buffer.from(encoded.tag,'base64'));
 const recovered=Buffer.concat([dec.update(Buffer.from(encoded.ciphertext,'base64')),dec.final()]).toString('utf8');
 assert.deepEqual(JSON.parse(recovered),{raw});
});
test('seven source packets and original contract are available when freeze source set',()=>{
 if(!process.env.V14_V44_QUESTIONS_DIR)return;
 const {P2A_V44_PACKET_HASHES}=await import('../../src/coach/v14-v44-evaluation-plan.mjs');
 CASE_ORDER.forEach((id,i)=>{
  const packet=JSON.parse(fs.readFileSync(
   process.env.V14_V44_QUESTIONS_DIR+'/'+id+'.json','utf8'));
  assert.equal(packet.requestHash,P2A_V44_PACKET_HASHES[i+1]);
  assert.equal(packet.request.publicBrief.caseId,id);
 });
});
