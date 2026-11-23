import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,privateDecrypt,createDecipheriv,constants} from 'node:crypto';
import {assertEnv,makeEncryptedArchive} from './v14-v44-pilot46-single-live-actions.mjs';
test('one-shot guard rejects missing token, unexpected branch and rerun before network',()=>{
 const proper={GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'push',
  GITHUB_REF:'refs/heads/feat/coach-p2a-v44-api-transport-dryrun',
  GITHUB_RUN_ATTEMPT:'1',
  ONE_SHOT_APPROVAL:'$0.30_PILOT46_ONLY_2026-11-23',
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
