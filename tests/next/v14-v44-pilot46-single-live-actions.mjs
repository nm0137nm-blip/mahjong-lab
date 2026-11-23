// Exactly one authorized GPT-6 Sol API pilot. Runs only from the explicit one-shot
// GitHub push workflow; NEVER publishes plaintext raw replies, secrets or prompts.
// Fail closed on reruns. A manually re-run job is intentionally rejected.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomBytes,publicEncrypt,createCipheriv,constants} from 'node:crypto';
import {createV44FrozenStage1} from './v14-v44-stage1-freeze.mjs';
import {assessV44FirstRealStage1} from '../../src/coach/v14-v44-stage1-receipt.mjs';
import {checkFrozenPacket,buildOneShotRequest,costCeilingUSD,extractRawOutput}
  from './v14-v44-api-onecase.mjs';
const fail=s=>{throw Error('p2a-v44-one-shot: '+s);};
const hash=b=>createHash('sha256').update(b).digest('hex');
const expectBranch='refs/heads/feat/coach-p2a-v44-api-transport-dryrun';
const expectedApproval='$0.30_PILOT46_NEWKEY_2026-11-24';
const RETRY_MARKER='research/approvals/pilot46-newkey-onepost-20261124.run';
const RETRY_MARKER_SHA='a1f2af884f50046d5a700ba3d9454a2142f7a7923799f3d8b36895f0d26b7e43';
// Safe for public CI logs: never include raw response body, error.message,
 // request payload or credential.
export function sanitizeApiFailure(body,httpStatus){
 const safe=x=>typeof x==='string'&&/^[a-z0-9_-]{1,64}$/.test(x)?x:null;
 return {httpStatus,errorType:safe(body?.error?.type),
   errorCode:safe(body?.error?.code),apiRequestAttempted:true,
   completed:false,retries:0};
}
export function assertEnv(env){
 if(env.GITHUB_ACTIONS!=='true'||env.GITHUB_EVENT_NAME!=='push'||
    env.GITHUB_REF!==expectBranch||env.GITHUB_RUN_ATTEMPT!=='1'||
    env.ONE_SHOT_APPROVAL!==expectedApproval)
   fail('approval scope, branch, event or run attempt mismatch (no request)');
 if(!env.OPENAI_API_KEY)fail('missing API secret (no request)');
}
// Validate immutable authorized marker bytes locally. The workflow path filter
// restricts activation; a rerun is already rejected by RUN_ATTEMPT. No event-body
// parser assumptions and no paid request before verifying content.
export function assertFreshMarker(text){
 if(hash(text)!==RETRY_MARKER_SHA)fail('approval marker content mismatch');
}
export function makeEncryptedArchive(clear,publicPem){
 const key=randomBytes(32),iv=randomBytes(12);
 const cipher=createCipheriv('aes-256-gcm',key,iv);
 const ct=Buffer.concat([cipher.update(Buffer.from(clear)),cipher.final()]);
 const wrapped=publicEncrypt({
  key:publicPem,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'
 },key);
 return {version:'p2a-v44-one-shot-aes256gcm-rsa4096-oaep-sha256',
   wrappedKey:wrapped.toString('base64'),iv:iv.toString('base64'),
   tag:cipher.getAuthTag().toString('base64'),ciphertext:ct.toString('base64'),
   ciphertextSHA256:hash(ct)};
}
export async function main(env=process.env){
 assertEnv(env);
 assertFreshMarker(await fs.readFile(RETRY_MARKER,'utf8'));
 const frozen=JSON.parse(await fs.readFile(env.V14_FOLLOWUP_PUBLIC,'utf8'));
 const packet=JSON.parse(await fs.readFile(path.join(env.V14_V44_QUESTIONS_DIR,'pilot-46.json'),'utf8'));
 checkFrozenPacket(packet,'pilot-46');
 const origin=createV44FrozenStage1(frozen).questions[0]?.packet;
 if(JSON.stringify(origin)!==JSON.stringify(packet))fail('frozen original source not identical (no request)');
 const payload=buildOneShotRequest(packet,'gpt-6-sol');
 const bound=costCeilingUSD(payload);
 if(bound.upperUSD>0.30||payload.max_output_tokens!==12000)
   fail('token budget exceeded or output cap changed (no request)');
 const recipient=await fs.readFile('./tests/next/v14-v44-pilot46-encryption-pub.pem','utf8');
 await fs.mkdir(env.PILOT46_ENCRYPTED_DIR,{recursive:true,mode:0o700});
 // No auto-retry; only this line makes a paid model request.
 console.log('One authorized GPT-6 Sol request, upper estimated cost USD',bound.upperUSD);
 const res=await fetch('https://api.openai.com/v1/responses',{
  method:'POST',
  headers:{'Content-Type':'application/json',Authorization:'Bearer '+env.OPENAI_API_KEY},
  body:JSON.stringify(payload),signal:AbortSignal.timeout(230000)
 });
 if(!res.ok){
  // Retain ONLY machine-readable error type/code, never the error message,
  // arbitrary body, key, request input, or user text in public Actions logs.
  let json=null;
  try { json=await res.json(); } catch {}
  const safeFailure=sanitizeApiFailure(json,res.status);
  console.log('API_SAFE_ERROR',JSON.stringify(safeFailure));
  process.exitCode=1;return safeFailure;
 }
 const response=await res.json();
 let raw='',error=null,receipt=null;
 try{
  raw=extractRawOutput(response);
  receipt=assessV44FirstRealStage1(frozen,'pilot-46',raw,{
    provider:'OpenAI API',modelDisplay:response.model??'not-recorded',
    independentTemporaryChat:false,replySubmittedAsJsonFile:false,
    observedLocalTimestamp:new Date().toISOString(),effort:'medium'});
 }catch(e){error=String(e);}
 const full={phase:'P2a-v4.4',track:'EXPLORATORY_API_SEPARATE_FROM_MANUAL_PREREG',
  inputPacketHash:packet.requestHash,model:response.model??null,
  responseId:response.id??null,usage:response.usage??null,
  status:response.status??null,incompleteDetails:response.incomplete_details??null,
  rawReply:raw,rawReplySHA256:hash(raw),verifiedReceipt:receipt,
  request:payload,apiResponse:response,extractionError:error,
  costPreflight:bound,requiresManualDenominatorUnchanged:true};
 const envelope=makeEncryptedArchive(JSON.stringify(full),recipient);
 const encPath=path.join(env.PILOT46_ENCRYPTED_DIR,'pilot-46-original-api-encrypted.json');
 await fs.writeFile(encPath,JSON.stringify(envelope)+'\n',{flag:'wx',mode:0o600});
 const usage=response.usage??{};
 const actualEst=(Number(usage.input_tokens)||0)*2/1e6+
     (Number(usage.output_tokens)||0)*10/1e6;
 const summary={phase:'P2a-v4.4',caseId:'pilot-46',
  track:'EXPLORATORY_API_SEPARATE_FROM_MANUAL_PREREG',
  model:response.model??'not-recorded',
  status:response.status??'not-recorded',
  verdict:receipt?.verdict??'NOT_VERIFIED_INCOMPLETE_OR_EXTRACTION_ERROR',
  verifierErrorPresent:Boolean(receipt?.failure||error),
  inputPacketHash:packet.requestHash,rawReplySHA256:hash(raw),
  responseId:response.id??null,
  usage:{input_tokens:usage.input_tokens??null,output_tokens:usage.output_tokens??null,
    total_tokens:usage.total_tokens??null},
  standardPriceEstimatedUSD:Number(actualEst.toFixed(6)),
  approvedBudgetUSD:0.30,preflightUpperUSD:bound.upperUSD,
  apiRequestsThisJob:1,autoRetries:0,originalReplyEncrypted:true,
  outputArtifactsIncludeNoPlaintext:true,
  manualOfficialV44Stage1ResponseCount:0,
  encryption:'RSA4096-OAEP-SHA256 + AES256-GCM'};
 await fs.writeFile(path.join(env.PILOT46_ENCRYPTED_DIR,'pilot-46-safe-summary.json'),
   JSON.stringify(summary,null,2)+'\n',{flag:'wx',mode:0o600});
 // Only summary printed, never raw output or key.
 console.log('SAFE_SUMMARY',JSON.stringify(summary));
 return summary;
}
if(process.argv[1]&&import.meta.url===new URL('file://'+path.resolve(process.argv[1])).href){
 main().catch(e=>{console.error('CONTROLLED_FAILURE',String(e));process.exitCode=1;});
}
