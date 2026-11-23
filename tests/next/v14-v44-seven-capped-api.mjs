// P2a-v4.4 API-transport exploratory sequence, exactly seven NEW cases.
// Previously answered pilot-46 remains untouched. The original CHATGPT TEMPORARY
// CHAT preregistered gate is not retconned into an API gate.
// Every inferencing POST is contingent on accurate FREE input-token counting
// and a hard output-token cap; budget <= 5 cents/call. No retries.
// Never publish source prompt, raw model outputs, keys, or L4 hidden controls.
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {P2A_V44_FIXED_EIGHT as CASES} from '../../src/coach/v14-v44-evaluation-plan.mjs';
import {createV44FrozenStage1} from './v14-v44-stage1-freeze.mjs';
import {checkFrozenPacket,buildOneShotRequest,extractRawOutput} from './v14-v44-api-onecase.mjs';
import {assessV44FirstRealStage1} from '../../src/coach/v14-v44-stage1-receipt.mjs';
import {makeEncryptedArchive,sanitizeApiFailure} from './v14-v44-pilot46-single-live-actions.mjs';

export const BATCH_VERSION='p2a-v44-api-exploratory-frozen-seven-v1';
export const CASE_ORDER=Object.freeze(CASES.slice(1));
export const PER_CALL_CAP_USD=0.05;
export const INPUT_DOLLARS_PER_M=2;
export const OUTPUT_DOLLARS_PER_M=10;
export const BUDGET_PREFLIGHT_CAP_USD=0.048;  // buffer under explicit 5c authorization
export const MAX_OUTPUT_TOKENS=3200;
export const MIN_OUTPUT_TOKENS=2400;
export const APPROVAL_MARKER='research/approvals/p2a-v44-api-seven-only-20261124.run';
export const APPROVAL_MARKER_TEXT=
 'P2A_V44_SEVEN_UNSEEN_API_CASES_MAX_USD_0_05_EACH_STOP_ON_FIRST_FAILURE_APPROVED_2026_11_24\n';
const sha=s=>createHash('sha256').update(s).digest('hex');
const fail=s=>{const err=new Error('BATCH_'+s);err.shortCode='BATCH_'+s;throw err;};
export function guardOneTime(env,changed,marker){
 if(env.GITHUB_ACTIONS!=='true'||env.GITHUB_EVENT_NAME!=='push'||
    env.GITHUB_RUN_ATTEMPT!=='1'||
    env.GITHUB_REF!=='refs/heads/feat/coach-p2a-v44-api-seven-capped'||
    env.V44_SEVEN_APPROVAL!=='SEVEN_AT_MOST_005_20261124'||
    !env.OPENAI_API_KEY)fail('PRECONDITIONS');
 if(marker!==APPROVAL_MARKER_TEXT)fail('MARKER_CONTENT');
 // Check the triggering commit genuinely ADDED only this new marker.
 // Unlike unreliable webhook head_commit.added, read the actual git tree.
 const changedRows=changed.split('\n').filter(Boolean);
 if(changedRows.length!==1||changedRows[0]!==('A\t'+APPROVAL_MARKER))
    fail('NOT_FIRST_ADDITION');
}
export function budgetFromExactTokenCount(count){
 if(!Number.isInteger(count)||count<1||count>200000)fail('TOKEN_COUNT_INVALID');
 // The official input-token count includes message-format/schema tokens.
 // Extra 5% + 256 tokens is a conservative buffer for accounting variations.
 const inputCeiling=Math.ceil(count*1.05)+256;
 const inputCostCeiling=inputCeiling*INPUT_DOLLARS_PER_M/1e6;
 const remaining=BUDGET_PREFLIGHT_CAP_USD-inputCostCeiling;
 const outputLimit=Math.min(MAX_OUTPUT_TOKENS,
   Math.floor((remaining*1e6)/OUTPUT_DOLLARS_PER_M));
 if(outputLimit<MIN_OUTPUT_TOKENS)fail('OUTPUT_ALLOWANCE_TOO_SHORT_FOR_FAIR_FROZEN_TEST');
 const preflightUSD=inputCostCeiling+
   outputLimit*OUTPUT_DOLLARS_PER_M/1e6;
 if(preflightUSD>PER_CALL_CAP_USD||preflightUSD>BUDGET_PREFLIGHT_CAP_USD+1e-9)
   fail('PER_CALL_COST_CAP');
 return {inputTokensExact:count,inputTokensPadded:inputCeiling,
   outputTokensHardCap:outputLimit,
   preflightMaxUSD:Number(preflightUSD.toFixed(7)),
   perCallMaxUSD:PER_CALL_CAP_USD,
   paidGenerationAttemptsAllowed:1,retries:0};
}
export function estimateUsageUSD(usage){
 const input=usage?.input_tokens,output=usage?.output_tokens;
 if(!Number.isInteger(input)||!Number.isInteger(output))fail('USAGE_MISSING');
 return Number(((input*INPUT_DOLLARS_PER_M+
    output*OUTPUT_DOLLARS_PER_M)/1e6).toFixed(7));
}
async function jsonPost(url,body,env,timeoutMs){
 const res=await fetch(url,{
  method:'POST',
  headers:{Authorization:'Bearer '+env.OPENAI_API_KEY,'Content-Type':'application/json'},
  body:JSON.stringify(body),signal:AbortSignal.timeout(timeoutMs)});
 let json=null;
 try{json=await res.json();}catch{}
 return {status:res.status,ok:res.ok,body:json};
}
const safeWrite=async (p,data)=>{
 await fs.writeFile(p,JSON.stringify(data,null,2)+'\n',{flag:'wx',mode:0o600});
};
export async function run(env=process.env){
 const changed=execFileSync('git',
   ['diff-tree','--no-commit-id','--name-status','-r','HEAD'],
   {encoding:'utf8'});
 const marker=await fs.readFile(APPROVAL_MARKER,'utf8');
 guardOneTime(env,changed,marker);
 const frozen=JSON.parse(await fs.readFile(env.V14_FOLLOWUP_PUBLIC,'utf8'));
 const sealed=createV44FrozenStage1(frozen);
 if(CASES.length!==8||CASE_ORDER.length!==7)fail('FIXED_CASE_SET_CHANGED');
 const publicDir=env.V14_V44_QUESTIONS_DIR;
 const outDir=env.V44_SEVEN_ENCRYPTED_DIR;
 const recipient=await fs.readFile('research/p2a-v44-seven/recipient-public.pem','utf8');
 await fs.mkdir(outDir,{recursive:true,mode:0o700});
 const manifest={
  version:BATCH_VERSION,kind:'API_EXPLORATORY_NOT_MANUAL_STAGE1',
  inputSource:'immutable original 36 cases and original fixed eight, no Mortal/controls',
  originalManualStage1Responses:0,priorPilot46ApiResponse:'PRESERVED_SEPARATELY',
  targetNewCases:CASE_ORDER,records:[],requestsAttempted:0,
  budget:{perCaseUSD:PER_CALL_CAP_USD,maxNewRequests:7,maximumNewSpendUSD:0.35},
  verdict:'PREPARED_NO_GENERATION',stopOnFirstFailure:true,autoRetries:0
 };
 // Persist a safe manifest before any model inference to preserve partial progress.
 await safeWrite(path.join(outDir,'batch-intent.json'),manifest);
 let stopped=false;
 for(const [i,caseId] of CASE_ORDER.entries()){
  const entry={caseId,orderedIndex:i+1,state:'PREPARED',actualRequestCount:0};
  manifest.records.push(entry);
  // Never use earlier answer text as input and never vary this case order.
  const original=sealed.questions[i+1]?.packet;
  const fromArtifact=JSON.parse(await fs.readFile(path.join(publicDir,caseId+'.json'),'utf8'));
  checkFrozenPacket(fromArtifact,caseId);
  if(JSON.stringify(fromArtifact)!==JSON.stringify(original))fail('FROZEN_PACKET_MISMATCH');
  const payload=buildOneShotRequest(original,'gpt-6-sol');
  // This endpoint is documented free and performs NO model generation.
  const counted=await jsonPost('https://api.openai.com/v1/responses/input_tokens',
    {model:payload.model,input:payload.input,text:payload.text},env,30000);
  if(!counted.ok||!Number.isInteger(counted.body?.input_tokens)||
    counted.body?.object!=='response.input_tokens'){
    entry.state='STOPPED_FREE_COUNT_FAILED';
    entry.httpStatus=counted.status;
    entry.error=sanitizeApiFailure(counted.body,counted.status);
    manifest.verdict='STOPPED_BEFORE_PAID_INFERENCE';
    stopped=true;break;
  }
  const bound=budgetFromExactTokenCount(counted.body.input_tokens);
  payload.max_output_tokens=bound.outputTokensHardCap;
  entry.budget=bound;
  entry.state='POST_AUTHORIZED_ONCE';
  manifest.requestsAttempted+=1;
  console.log('BEGIN_ONE_AUTHORIZED_POST',JSON.stringify({
    caseId,ordinal:i+2,inputTokens:bound.inputTokensExact,
    outputTokensCap:bound.outputTokensHardCap,
    preflightMaxUSD:bound.preflightMaxUSD}));
  let result;
  try{
    result=await jsonPost('https://api.openai.com/v1/responses',payload,env,240000);
  }catch(e){
    // Ambiguous network failures are still counted as requests. Never retry.
    entry.state='STOPPED_AFTER_POST_NETWORK_ERROR';
    entry.networkErrorCategory=e?.name==='TimeoutError'?'TIMEOUT':'NETWORK_FAILURE';
    manifest.verdict='INCOMPLETE_NO_RETRY';stopped=true;break;
  }
  entry.actualRequestCount=1;
  if(!result.ok){
    entry.state='STOPPED_API_HTTP_ERROR';
    entry.error=sanitizeApiFailure(result.body,result.status);
    manifest.verdict='INCOMPLETE_API_ERROR';stopped=true;break;
  }
  const response=result.body;
  const responseBytes=JSON.stringify(response);
  let raw='',receipt=null,extractionError=null;
  try {
    raw=extractRawOutput(response);
    receipt=assessV44FirstRealStage1(frozen,caseId,raw,{
      provider:'OpenAI API',modelDisplay:response?.model||'not-recorded',
      independentTemporaryChat:false,replySubmittedAsJsonFile:false,
      effort:'medium',observedLocalTimestamp:new Date().toISOString()
    });
  }catch(e){extractionError='INCOMPLETE_OR_UNREADABLE_RESPONSE';}
  // Save the *unaltered* original API response and whole verifier receipt,
  // encrypted and write-only, before deciding whether the trial passed.
  const fullEvidence={caseId,version:BATCH_VERSION,
    frozenPacketHash:fromArtifact.requestHash,
    response,originalRawText:raw,receipt,extractionError};
  const cipher=makeEncryptedArchive(JSON.stringify(fullEvidence),recipient);
  await safeWrite(path.join(outDir,caseId+'-encrypted-original.json'),cipher);
  entry.state='MODEL_REPLY_RECORDED';
  entry.encryptedOriginalSHA256=sha(JSON.stringify(cipher));
  entry.rawReplySHA256=sha(raw);
  entry.model=response?.model??null;
  entry.responseStatus=response?.status??'not-recorded';
  entry.responseUsage=response?.usage?{
    inputTokens:response.usage.input_tokens??null,
    outputTokens:response.usage.output_tokens??null,
    totalTokens:response.usage.total_tokens??null}:null;
  try{
    entry.estimatedUSD=estimateUsageUSD(response?.usage);
  }catch(e){
    entry.estimatedUSD=null;
  }
  entry.verdict=receipt?.verdict??'STAGE1_NO_GO_UNREADABLE_RESPONSE';
  entry.semanticCertified=false;
  if(entry.estimatedUSD===null||entry.estimatedUSD>PER_CALL_CAP_USD){
    manifest.verdict='STOPPED_TOKEN_CHARGE_GUARD_ANOMALY';
    entry.state='STOPPED_COST_ANOMALY';stopped=true;
  }else if(entry.verdict!=='CONTRACT_AND_PUBLIC_FACT_GATE_PASS'){
    manifest.verdict='STOPPED_FIRST_FATAL_CONTRACT';
    entry.state='FIRST_FATAL_STOP';stopped=true;
  }else{
    entry.state='PUBLIC_CONTRACT_PASS_ONLY';
  }
  // Never print raw answer or opponent details; preserve exact per-scene receipt
  // privately for subsequent independent blind L4.
  console.log('CASE_SUMMARY',JSON.stringify({
    caseId,state:entry.state,verdict:entry.verdict,
    estimatedUSD:entry.estimatedUSD,rawReplySHA256:entry.rawReplySHA256}));
  // Persist safe checkpoint so any later interruption cannot erase prior records.
  await safeWrite(path.join(outDir,'checkpoint-'+caseId+'.json'),{
    ...manifest,records:manifest.records.map(r=>({...r,error:undefined}))
  });
  if(stopped)break;
 }
 if(!stopped)manifest.verdict='SEVEN_API_EXPLORATORY_PUBLIC_CONTRACT_PASS';
 manifest.completedCases=manifest.records.filter(x=>x.state==='PUBLIC_CONTRACT_PASS_ONLY').length;
 manifest.stoppedAt=stopped?manifest.records.at(-1)?.caseId:null;
 manifest.estimatedNewSpendUSD=Number(manifest.records.reduce((a,x)=>a+(x.estimatedUSD||0),0).toFixed(7));
 // Official human ChatGPT temporary-chat plan and blinded semantic gate NOT touched.
 manifest.researchPhaseGO=false;
 manifest.reason='Stage1 API exploratory/public-fact only; stability, Stage2, heldout L3.5 and three-rater L4 not certified';
 await safeWrite(path.join(outDir,'batch-safe-final.json'),manifest);
 console.log('BATCH_FINAL',JSON.stringify({
  verdict:manifest.verdict,completedCases:manifest.completedCases,
  attemptedPaidPosts:manifest.requestsAttempted,
  estimatedNewSpendUSD:manifest.estimatedNewSpendUSD,
  stoppedAt:manifest.stoppedAt,manualChatOriginalStage1Count:0,
  researchPhaseGO:false}));
 if(stopped)process.exitCode=2;
 return manifest;
}
if(process.argv[1]?.endsWith('v14-v44-seven-capped-api.mjs')){
 run().catch(e=>{
   // Never log external text/secret. Only allowlisted local failure class.
   const safe=e?.shortCode??'BATCH_SETUP_FAILURE';
   console.error('SAFE_SETUP_FAILURE',safe);
   process.exitCode=1;
 });
}
