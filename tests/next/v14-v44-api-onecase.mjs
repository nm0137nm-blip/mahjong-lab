// P2a-v4.4 API transport experiment. Fail closed: no request unless explicitly enabled.
// Never run live from a public GitHub Actions repository (raw answers are private).
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {P2A_V44_FIXED_EIGHT as CASES,P2A_V44_PACKET_HASHES as HASHES} from '../../src/coach/v14-v44-evaluation-plan.mjs';
import {createV44FrozenStage1} from './v14-v44-stage1-freeze.mjs';
import {assessV44FirstRealStage1} from '../../src/coach/v14-v44-stage1-receipt.mjs';
const fail = message => {throw Error('v44-api-transport: '+message);};
const sha=x=>createHash('sha256').update(x).digest('hex');
export function checkFrozenPacket(packet,caseId){
 const index=CASES.indexOf(caseId);
 if(index<0)fail('unregistered case');
 if(!packet||!packet.request||packet.requestHash!==HASHES[index]||
   packet.request.publicBrief?.caseId!==caseId||
   sha(JSON.stringify(packet.request))!==packet.requestHash)
   fail('packet SHA/requestHash is not the preregistered original');
 if(packet.request.delivery?.filename!=='mahjong_P2a_v44_stage1_'+caseId+'_response.json')
   fail('output name mismatch');
 return {caseId,packetHash:packet.requestHash,firstAttemptIndex:index};
}
export function buildOneShotRequest(packet,model='gpt-6-sol'){
 if(!/^gpt-6(?:-|$)/.test(model))fail('only GPT-6 family models permitted');
 const text=JSON.stringify({requestHash:packet.requestHash,
  availableFactIds:packet.request.availableFactIds,
  publicBrief:packet.request.publicBrief,
  responseShape:packet.request.responseShape,
  warnings:packet.request.warnings,
  deliveryNote:'Return exactly one JSON object; it will be saved unchanged as the raw response.'});
 const choice={type:'object',additionalProperties:false,required:['key','afterCallDiscard'],
  properties:{key:{type:'string'},afterCallDiscard:{type:['string','null']}}};
 const opponent={type:'object',additionalProperties:false,
  required:['seat','importance','analysis','tradeoff','changeCondition'],
  properties:{seat:{type:'integer'},importance:{type:'string',enum:['potentially_relevant','not_established']},
   analysis:{type:'string'},tradeoff:{type:'string'},changeCondition:{type:'string'}}};
 const schema={type:'object',additionalProperties:false,
  required:['version','requestHash','recommendation','alternative','tactics'],
  properties:{version:{type:'string',enum:['p2a-v44-compact-stage1-response-1']},
   requestHash:{type:'string',enum:[packet.requestHash]},
   recommendation:choice,alternative:choice,
   tactics:{type:'object',additionalProperties:false,
    required:['comparison','opponents','bottomLine','reversal','lesson'],
    properties:{comparison:{type:'string'},opponents:{type:'array',items:opponent},
     bottomLine:{type:'string'},reversal:{type:'string'},lesson:{type:'string'}}}}};
 return {model,store:false,reasoning:{effort:'medium'},max_output_tokens:12000,
  input:[{role:'system',content:packet.request.system},{role:'user',content:text}],
  text:{format:{type:'json_schema',name:'mahjong_v44_one_case',strict:true,schema}}};
}
// Conservative credit preflight for this one specifically authorized pilot-46 experiment.
// Charges are based on actual tokens and can vary; this is an intentionally
// overcounting bound, not a substitute for the Platform's billing controls.
const APPROVED_MAX_USD=0.30;
const INPUT_RATE_PER_M=2.00;
const OUTPUT_RATE_PER_M=10.00;
export function costCeilingUSD(payload){
 if(payload.model!=='gpt-6-sol')fail('unapproved model');
 const outputCap=payload.max_output_tokens;
 if(!Number.isInteger(outputCap)||outputCap<1||outputCap>12000)
   fail('unapproved output token cap');
 // UTF-8 byte count overestimates visible input tokens; 5,000 tokens
 // conservatively allow for formatting/schema/request overhead.
 const inputTokenBound=Buffer.byteLength(JSON.stringify(payload),'utf8')+5000;
 const upper=inputTokenBound*INPUT_RATE_PER_M/1e6+
   outputCap*OUTPUT_RATE_PER_M/1e6;
 if(upper>APPROVED_MAX_USD)fail('predicted maximum token cost exceeds one-call $0.30 approval');
 return {inputTokenBound,outputCap,upperUSD:Number(upper.toFixed(6)),
  budgetUSD:APPROVED_MAX_USD,billableTools:0,noAutoRetries:true};
}

export function extractRawOutput(response){
 if(response.status!=='completed')fail('model status is not completed; preserve failure, never auto-retry');
 const chunks=[];
 for(const row of response.output??[])for(const item of row.content??[]){
  if(item.type==='refusal')fail('model refusal');
  if(item.type==='output_text')chunks.push(item.text);
 }
 const raw=chunks.join('');
 if(!raw.trim())fail('empty response, do not fabricate an answer');
 return raw;
}
function argsFrom(argv){
 const args={};
 for(const a of argv){
  const m=/^--([a-z-]+)=(.*)$/.exec(a);if(!m)fail('argument must be --key=value');
  if(Object.hasOwn(args,m[1]))fail('duplicate argument '+m[1]);
  args[m[1]]=m[2];
 }
 return args;
}
export async function run(argv,env=process.env){
 const args=argsFrom(argv),mode=args.mode??'dry-run',caseId=args.case??'pilot-46';
 if(!['dry-run','live'].includes(mode))fail('unknown mode');
 const packet=JSON.parse(await fs.readFile(args.question,'utf8'));
 const checked=checkFrozenPacket(packet,caseId);
 if(!args.frozen)fail('original frozen36 required for source-certified verification');
 const frozen=JSON.parse(await fs.readFile(args.frozen,'utf8'));
 const recreated=createV44FrozenStage1(frozen).questions.find(q=>q.caseId===caseId);
 if(!recreated||JSON.stringify(recreated.packet)!==JSON.stringify(packet))
  fail('packet does not exactly match original frozen source');
 const payload=buildOneShotRequest(packet,args.model??'gpt-6-sol');
 const costPreflight=costCeilingUSD(payload);
 if(mode==='dry-run'){
  return {mode:'DRY_RUN_NO_EXTERNAL_API',networkRequests:0,charge:0,
   ...checked,model:payload.model,costPreflight,hasFrozenSource:true,
   instructionsBytes:Buffer.byteLength(payload.input[0].content),
   userInputBytes:Buffer.byteLength(payload.input[1].content),
   authenticVerifier:'assessV44FirstRealStage1',notCountedAsModelResponse:true};
 }
 if(env.GITHUB_ACTIONS)fail('live API disabled in public GitHub Actions: answer privacy');
 if(caseId!=='pilot-46')fail('approval is for pilot-46 only');
 if(args.ack!=='I_APPROVE_ONE_API_REQUEST')fail('missing one-call consent confirmation');
 if(!env.OPENAI_API_KEY)fail('OPENAI_API_KEY absent');
 if(!args.outdir)fail('private local outdir required');
 // No retry. No API usage without explicit live mode, approval, and a key.
 const result=await fetch('https://api.openai.com/v1/responses',{
  method:'POST',headers:{Authorization:'Bearer '+env.OPENAI_API_KEY,
   'Content-Type':'application/json'},
  body:JSON.stringify(payload),signal:AbortSignal.timeout(240000)});
 if(!result.ok)fail('API HTTP '+result.status+' (no automatic retry)');
 const response=await result.json();
 const raw=extractRawOutput(response);
 await fs.mkdir(args.outdir,{recursive:true,mode:0o700});
 const answerPath=path.join(args.outdir,packet.request.delivery.filename);
 await fs.writeFile(answerPath,raw,{flag:'wx',mode:0o600});
 const receipt=assessV44FirstRealStage1(frozen,caseId,raw,{
  provider:'OpenAI API',modelDisplay:response.model??'unverified',
  independentTemporaryChat:false,replySubmittedAsJsonFile:true,
  observedLocalTimestamp:new Date().toISOString(),effort:'medium'});
 // Separate experiment: API != original ChatGPT temporary-chat transport.
 const report={mode:'API_EXPLORATORY_DO_NOT_MERGE_WITH_MANUAL_STAGE1',
  ...checked,model:response.model??payload.model,responseId:response.id??null,
  rawSha256:sha(raw),usage:response.usage??null,costPreflight,
  verdict:receipt.verdict,failure:receipt.failure??null,
  apiCalls:1,independentStatelessRequest:true,officialV44ManualDenominatorUnchanged:true};
 await fs.writeFile(path.join(args.outdir,caseId+'-api-exploratory-receipt.json'),
  JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
 return report;
}
if(process.argv[1]&&process.argv[1].endsWith('v14-v44-api-onecase.mjs')){
 run(process.argv.slice(2)).then(x=>console.log(JSON.stringify(x,null,2)))
  .catch(e=>{console.error(String(e));process.exitCode=1;});
}
