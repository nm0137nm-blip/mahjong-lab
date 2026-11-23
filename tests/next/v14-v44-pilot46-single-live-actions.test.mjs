import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,privateDecrypt,createDecipheriv,constants} from 'node:crypto';
import {assertEnv,assertFreshMarker,makeEncryptedArchive,sanitizeApiFailure} from './v14-v44-pilot46-single-live-actions.mjs';
test('one-shot guard rejects missing token, unexpected branch and rerun before network',()=>{
 const proper={GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'push',
  GITHUB_REF:'refs/heads/feat/coach-p2a-v44-api-transport-dryrun',
  GITHUB_RUN_ATTEMPT:'1',
  ONE_SHOT_APPROVAL:'$0.30_PILOT46_RETRY_2026-11-24',
  OPENAI_API_KEY:'only_mock_never_sent'};
 assert.doesNotThrow(()=>assertEnv(proper));
 assert.throws(()=>assertEnv({...proper,OPENAI_API_KEY:''}),/missing API secret/);
 assert.throws(()=>assertEnv({...proper,GITHUB_RUN_ATTEMPT:'2'}),/mismatch/);
 assert.throws(()=>assertEnv({...proper,GITHUB_REF:'refs/heads/main'}),/mismatch/);
 assert.throws(()=>assertEnv({...proper,ONE_SHOT_APPROVAL:'any other amount'}),/mismatch/);
});
test('private reply is encrypted and decipherable only by recipient private key',()=>{
 const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048,
  publicKeyEncoding:{type:'spki',format:'pem'},
  privateKeyEncoding:{type:'pkcs8',format:'pem'}});
 const original=JSON.stringify({reply:'model answer example not for public logs',
  requestHash:'this is a test',fakeCreditCard:'not real'});
 const enc=makeEncryptedArchive(original,publicKey);
 assert.ok(!JSON.stringify(enc).includes('model answer example'));
 const key=privateDecrypt({key:privateKey,padding:constants.RSA_PKCS1_OAEP_PADDING,
  oaepHash:'sha256'},Buffer.from(enc.wrappedKey,'base64'));
 const d=createDecipheriv('aes-256-gcm',key,Buffer.from(enc.iv,'base64'));
 d.setAuthTag(Buffer.from(enc.tag,'base64'));
 const clear=Buffer.concat([d.update(Buffer.from(enc.ciphertext,'base64')),d.final()]).toString();
 assert.equal(clear,original);
});

test('429 diagnostics disclose only safe error type and code',()=>{
 const malicious={error:{type:'insufficient_quota',code:'credit_balance_exhausted',
  message:'REDACTED PRIVATE PROMPT AND SECRET INFO'}};
 const clean=sanitizeApiFailure(malicious,429);
 assert.equal(clean.errorCode,'credit_balance_exhausted');
 assert.equal(clean.errorType,'insufficient_quota');
 assert.ok(!JSON.stringify(clean).includes('PRIVATE'));
 assert.ok(!JSON.stringify(clean).includes('message'));
 const unsafe=sanitizeApiFailure({error:{code:'leaky key sk-example',type:'BAD DATA'}},429);
 assert.equal(unsafe.errorCode,null);
 assert.equal(unsafe.errorType,null);
});

test('only first committed added marker passes; modified/removed/re-run denied',()=>{
 const marker='research/approvals/pilot46-retry-20261124.run';
 const env={GITHUB_SHA:'SHA_EXACT_TEST'};
 const evt={head_commit:{id:'SHA_EXACT_TEST',added:[marker],modified:[],removed:[]}};
 assert.doesNotThrow(()=>assertFreshMarker(evt,env));
 assert.throws(()=>assertFreshMarker({...evt,head_commit:{...evt.head_commit,added:[],modified:[marker]}},env),/marker/);
 assert.throws(()=>assertFreshMarker(evt,{GITHUB_SHA:'WRONG'}),/marker/);
});
