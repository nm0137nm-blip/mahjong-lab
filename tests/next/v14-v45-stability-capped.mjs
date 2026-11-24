// Separate v45 cross-transport Stability, preserving original Stage1.
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {P2A_V45_FIXED_EIGHT as CASES,P2A_V45_PACKET_HASHES as HASHES} from '../../src/coach/v14-v45-evaluation-plan.mjs';
import {createV45FrozenStage1} from './v14-v45-stage1-freeze.mjs';
import {assessV45FirstRealStage1} from '../../src/coach/v14-v45-stage1-receipt.mjs';
import {makeEncryptedArchive,sanitizeApiFailure} from './v14-v44-pilot46-single-live-actions.mjs';
import {extractRawOutput} from './v14-v44-api-onecase.mjs';
const fail = message => {throw Error('v45-api-transport: '+message);};
const sha=x=>createHash('sha256').update(x).digest('hex');
export function checkFrozenPacket(packet,caseId){
 const index=CASES.indexOf(caseId);
 if(index<0)fail('unregistered case');
 if(!packet||!packet.request||packet.requestHash!==HASHES[index]||
   packet.request.publicBrief?.caseId!==caseId||
   sha(JSON.stringify(packet.request))!==packet.requestHash)
   fail('packet SHA/requestHash is not the preregistered original');
 if(packet.request.delivery?.filename!=='mahjong_P2a_v45_stage1_'+caseId+'_response.json')
   fail('output name mismatch');
 return {caseId,packetHash:packet.requestHash,firstAttemptIndex:index};
}
export function buildOneShotRequest(packet,model='gpt-6-sol'){
 if(model!=='gpt-6-sol')fail('only GPT-6 family models permitted');
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
  properties:{version:{type:'string',enum:['p2a-v45-compact-stage1-response-1']},
   requestHash:{type:'string',enum:[packet.requestHash]},
   recommendation:choice,alternative:choice,
   tactics:{type:'object',additionalProperties:false,
    required:['comparison','opponents','bottomLine','reversal','lesson'],
    properties:{comparison:{type:'string'},opponents:{type:'array',items:opponent},
     bottomLine:{type:'string'},reversal:{type:'string'},lesson:{type:'string'}}}}};
 return {model,store:false,reasoning:{effort:'medium'},service_tier:'default',prompt_cache_options:{ttl:'30m'},max_output_tokens:3600,
  input:[{role:'system',content:packet.request.system+'\nAPIでの出力形式のみ上書きします。ファイル生成・リンクの代わりに指定されたJSONオブジェクトをそのまま返してください。他の指示は全て保持します。'},{role:'user',content:text}],
  text:{format:{type:'json_schema',name:'mahjong_v45_one_case',strict:true,schema}}};
}

export const ORDER=Object.freeze(CASES.slice(0,4).flatMap(caseId=>[1,2].map(rep=>Object.freeze({caseId,rep,id:caseId+'-r'+rep}))));
export const MARKER='research/approvals/p2a-v45-stability-eight-20261124.run';
export const MARKER_TEXT='APPROVED_V45_STABILITY_MAX_8_POSTS_USD_0_05_EACH_TOTAL_0_40_20261124\n';
export function guard(env,changed,marker){
 if(env.GITHUB_ACTIONS!=='true'||env.GITHUB_EVENT_NAME!=='push'||
 env.GITHUB_RUN_ATTEMPT!=='1'||env.GITHUB_REF!=='refs/heads/feat/coach-p2a-v45-stability-capped'||
 env.V45_STABILITY_APPROVAL!=='EIGHT_MAX_40_CENTS_20261124'||!env.OPENAI_API_KEY||
 changed.trim()!=='A\t'+MARKER||marker!==MARKER_TEXT)fail('one-shot guard rejected');
}
export function bound(count){
 if(!Number.isInteger(count)||count<1||count>200000)fail('invalid exact count');
 const padded=Math.ceil(count*1.05)+256;
 // 30m cache writes have the highest permitted input rate; use integer microdollars.
 const inputMax=Math.ceil(padded*2.5);
 const outputCap=Math.min(3600,Math.floor((48000-inputMax)/10));
 if(outputCap<2400)fail('insufficient output allowance under budget');
 const maxMicroUSD=inputMax+outputCap*10;
 if(maxMicroUSD>48000)fail('cost exceeds safety margin');
 return {count,padded,outputCap,maxMicroUSD};
}
const write=async(p,x)=>fs.writeFile(p,JSON.stringify(x,null,2)+'\n',{flag:'wx',mode:0o600});
async function post(endpoint,payload,key,ms){
 const r=await fetch('https://api.openai.com/v1/responses'+endpoint,{method:'POST',
 headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
 body:JSON.stringify(payload),signal:AbortSignal.timeout(ms)});
 let body=null;try{body=await r.json();}catch{}
 return {ok:r.ok,status:r.status,body};
}
export function actualUpperMicroUSD(usage){
 if(!Number.isInteger(usage?.input_tokens)||!Number.isInteger(usage?.output_tokens)||
 usage.input_tokens<0||usage.output_tokens<0)fail('missing usage');
 return Math.ceil(usage.input_tokens*2.5)+usage.output_tokens*10;
}
export async function run(env=process.env){
 const changed=execFileSync('git',['diff-tree','--no-commit-id','--name-status','-r','HEAD'],{encoding:'utf8'});
 guard(env,changed,await fs.readFile(MARKER,'utf8'));
 const source=JSON.parse(await fs.readFile(env.V14_FOLLOWUP_PUBLIC,'utf8'));
 const sealed=createV45FrozenStage1(source);
 const out=env.V45_STABILITY_OUT;
 const recipient=await fs.readFile('research/p2a-v45-stability/recipient-public.pem','utf8');
 await fs.mkdir(out,{recursive:true,mode:0o700});
 const m={version:'p2a-v45-stability-cross-transport-1',manualStage1Pass:8,
 target:ORDER,paidPosts:0,records:[],maxBudgetUSD:0.4,maxPerCallUSD:0.05,
 autoRetries:0,stabilityCertified:false,phaseGO:false,semanticReviewPending:true,
 verdict:'IN_PROGRESS',upperCostMicroUSD:0};
 await write(path.join(out,'intent.json'),m);
 // Check all four original prompts and calculate free exact counts before ANY inference.
 // Same payload per replicate; no result or S42 enters subsequent inputs.
 const prepared=new Map();
 try{
 for(const {caseId} of ORDER.filter(x=>x.rep===1)){
  const packet=sealed.questions.find(q=>q.caseId===caseId).packet;
  const artifact=JSON.parse(await fs.readFile(path.join(env.V45_QUESTIONS,caseId+'.json'),'utf8'));
  checkFrozenPacket(artifact,caseId);
  if(JSON.stringify(packet)!==JSON.stringify(artifact))fail('frozen packet mismatch');
  const payload=buildOneShotRequest(packet);
  const count=await post('/input_tokens',{model:payload.model,input:payload.input,text:payload.text},env.OPENAI_API_KEY,30000);
  if(!count.ok||count.body?.object!=='response.input_tokens')fail('free count failed');
  const b=bound(count.body.input_tokens);
  payload.max_output_tokens=b.outputCap;
  prepared.set(caseId,{packet,payload,b});
 }
 }catch(e){m.verdict='STOPPED_BEFORE_PAID_INFERENCE';await write(path.join(out,'final.json'),m);console.log('FINAL',JSON.stringify(m));return m;}
 for(const attempt of ORDER){
  const {caseId,id}=attempt,{packet,payload,b}=prepared.get(caseId);
  const entry={...attempt,packetHash:packet.requestHash,requestSHA256:sha(JSON.stringify(payload)),bound:b,paidAttempt:1};
  // Persist before POST, including ambiguous network failures. No retries.
  m.records.push(entry);m.paidPosts++;m.upperCostMicroUSD+=b.maxMicroUSD;
  if(m.paidPosts>8||m.upperCostMicroUSD>400000)fail('batch cap violated');
  await write(path.join(out,id+'-before.json'),{...entry,paidPosts:m.paidPosts});
  let result;
  try{result=await post('',payload,env.OPENAI_API_KEY,240000);}
  catch(e){entry.verdict='NETWORK_ERROR_NO_RETRY';m.verdict='STOPPED_NETWORK';break;}
  if(!result.ok){
   entry.error=sanitizeApiFailure(result.body,result.status);entry.verdict='HTTP_ERROR_NO_RETRY';
   m.verdict='STOPPED_HTTP';break;
  }
  let raw='',receipt=null;
  try{
    raw=extractRawOutput(result.body);
    receipt=assessV45FirstRealStage1(source,caseId,raw,{
     provider:'OpenAI API cross-transport Stability',modelDisplay:result.body.model,
     independentTemporaryChat:false,replySubmittedAsJsonFile:false,effort:'medium',
     observedLocalTimestamp:new Date().toISOString()});
  }catch{}
  // Capture unaltered encrypted full original before evaluating any gate.
  const cipher=makeEncryptedArchive(JSON.stringify({attempt,packetHash:packet.requestHash,
   originalResponse:result.body,originalRawText:raw,receipt}),recipient);
  await write(path.join(out,id+'-encrypted.json'),cipher);
  entry.rawSha256=sha(raw);entry.model=result.body?.model??null;entry.status=result.body?.status??null;
  entry.usage=result.body?.usage??null;
  entry.verdict=receipt?.verdict??'UNREADABLE_OR_INCOMPLETE';
  try{entry.usageUpperMicroUSD=actualUpperMicroUSD(entry.usage);}catch{entry.usageUpperMicroUSD=null;}
  if(entry.usageUpperMicroUSD===null||entry.usageUpperMicroUSD>50000||
     entry.usage?.output_tokens>b.outputCap||entry.usage?.input_tokens>b.padded||
     entry.model!=='gpt-6-sol'||(result.body?.service_tier&&result.body.service_tier!=='default')){
   m.verdict='STOPPED_COST_OR_MODEL_ANOMALY';
  }else if(entry.verdict!=='CONTRACT_AND_PUBLIC_FACT_GATE_PASS'||
    receipt?.transportOnlyCorrections?.length){
   m.verdict='STOPPED_FIRST_FATAL_CONTRACT';
  }
  console.log('SAFE_CASE',JSON.stringify({id,verdict:entry.verdict,model:entry.model,
   input:entry.usage?.input_tokens,output:entry.usage?.output_tokens,upperMicroUSD:entry.usageUpperMicroUSD,
   rawSHA256:entry.rawSha256}));
  await write(path.join(out,id+'-checkpoint.json'),m);
  if(m.verdict!=='IN_PROGRESS')break;
 }
 if(m.verdict==='IN_PROGRESS')m.verdict='EIGHT_API_CONTRACT_PASS_SEMANTIC_AND_AGREEMENT_PENDING';
 await write(path.join(out,'final.json'),m);
 console.log('FINAL',JSON.stringify({verdict:m.verdict,paidPosts:m.paidPosts,
   upperCostMicroUSD:m.upperCostMicroUSD,contractPass:m.records.filter(x=>x.verdict==='CONTRACT_AND_PUBLIC_FACT_GATE_PASS').length}));
 return m;
}
if(process.argv[1]?.endsWith('v14-v45-stability-capped.mjs')){
 run().catch(()=>{console.error('SAFE_SETUP_OR_EXECUTION_FAILURE_NO_RETRY');process.exitCode=1;});
}
