// Prepare private/public compartments before seeing real independent replies.
// Even public packet is not a strategic label. Never put weak controls in
// Stage1 question files. Source packet hashes pinned by prior artifact.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createV3IndependentDevelopmentRequest} from '../../src/coach/v14-independent-request-v3.mjs';
import {createV4CompactDevelopmentPacket} from '../../src/coach/v14-compact-model-contract-v4.mjs';
import {createV4BlindControlBatch} from '../../src/coach/v14-l4-blind-controls-v4.mjs';
import {P2A_V4_RESEARCH_PLAN as plan,P2A_V4_FIXED_EIGHT as ids,
 P2A_V4_PACKET_HASHES as expected,P2A_V4_BASE_SOURCE_HASH}
 from '../../src/coach/v14-v4-evaluation-plan.mjs';
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function prepareV4PreregisteredPublicPrivate(frozen){
 if(sha(frozen)!==P2A_V4_BASE_SOURCE_HASH)throw Error('prereg frozen source changed');
 const model=[];
 for(const [j,id] of ids.entries()){
  const source=frozen.find(x=>x.request.input.id===id);
  if(!source)throw Error('missing original '+id);
  const env=createV3IndependentDevelopmentRequest(source);
  const packet=createV4CompactDevelopmentPacket(env);
  if(packet.requestHash!==expected[j])throw Error('public model packet digest changed');
  model.push({caseId:id,envelope:env,packet});
 }
 const weak=createV4BlindControlBatch(model.map(x=>x.envelope),ids);
 if(weak.controls.some(x=>x.role!=='DECOY_NOT_ALLOWED_AS_REAL_CHATGPT_BENCHMARK_RESULT'))
  throw Error('weak-control role corrupted');
 const shared={
  version:plan.version,
  stage:'pre_reply_public_prompt_freeze',
  publicSourceHash:P2A_V4_BASE_SOURCE_HASH,
  sourceCaseCount:36,
  selectedIds:ids,
  sourcePacketHashes:expected,
  sourcePackSha256:sha(model.map(x=>({id:x.caseId,packet:x.packet}))),
  sourceControlBatchSha256:sha(weak),
  allRealResponsesAtFreeze:0,allRealL4JudgesAtFreeze:0,
  noS42TeacherIncludedInPublic:true,
  noHiddenHandsIncludedInPublic:true,
  researchGO:'only after all preregistered gates are independently satisfied',
  action:'ONE_TEMPORARY_CHAT_PER_QUESTION_NO_TEXT_HINTS_AFTER_FIRST_REPLY'
 };
 const publicManifest={
  ...shared,archiveClass:'QUESTIONER_ONLY_NO_MODEL_REFERENCE',
  status:'FROZEN_PUBLIC_INPUTS_NO_MODEL_ANSWERS',
  thresholds:{
   stage1:plan.stage1,
   l4:{axes:plan.l4.axes,requireThreeBlindRaters:plan.l4.allThreeRatersRequired}
  },
  controls:'sealed_verifier_only_no_controls_exposed_to_answering_model'
 };
 const verifierManifest={
  ...shared,archiveClass:'VERIFIER_ONLY_NEVER_SHOW_TO_STAGE1_ANSWERING_MODEL',
  status:'FROZEN_CONTROL_CANDIDATES_PRE_MODEL_ANSWERS',
  fixedControls:weak,
  noActualModelAnswerOrScore:true,
  scoring:plan.l4,
  trialPlan:plan,
  requiresIndependentManualExecution:true
 };
 return {model,publicManifest,verifierManifest};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){
 const input=process.argv[2],out=process.argv[3];
 if(!input||!out)throw Error('Usage: node v14-v4-freeze-protocol.mjs public36.json outDir');
 const frozen=JSON.parse(fs.readFileSync(input,'utf8'));
 const data=prepareV4PreregisteredPublicPrivate(frozen);
 for(const d of ['public/questions','verifier'])fs.mkdirSync(path.join(out,d),{recursive:true});
 for(const {caseId,packet} of data.model)fs.writeFileSync(path.join(out,'public/questions',caseId+'.json'),JSON.stringify(packet,null,2)+'\n');
 fs.writeFileSync(path.join(out,'public/manifest.json'),JSON.stringify(data.publicManifest,null,2)+'\n');
 fs.writeFileSync(path.join(out,'verifier/manifest.json'),JSON.stringify(data.verifierManifest,null,2)+'\n');
 fs.writeFileSync(path.join(out,'public/READ_ME_FIRST_JP.txt'),[
  '麻雀LAB P2a-v4 独立ChatGPT 公開Stage1検証。',
  '事前登録：入力ハッシュを固定済み。1問につき独立したChatGPT一時チャットを使用してください。',
  'Mortalの正解、非公開他家情報、モデルの予想、他の問題の回答を一時チャットに渡してはいけません。',
  '質問はquestions/以下の各JSONだけです。問題内request.systemとresponseShapeを読み、1つのJSON回答を返させます。',
  '1問目から固定順に進め、回答原文のJSONファイル・表示モデル名・日付を回収します。',
  '重大な事実・数値誤りまたは契約違反で即NO-GO停止。以後の再チャレンジを同版試験の成功に数えません。',
  '回答後の添削・ヒント付与・修正再提出は同じ試験の正式サンプルに含めません。',
  'このStage1は研究用の開発診断で、S42基準の認証・製品公開許可ではありません。',
  'verifier側の匿名弱対照・個別採点材料は回答側へ渡さないでください。',
  ''
 ].join('\n'));
 console.log(JSON.stringify({
  status:data.publicManifest.status,ids:data.publicManifest.selectedIds,
  modelAnswers:0,controlHash:data.publicManifest.sourceControlBatchSha256,
  sourcePackHash:data.publicManifest.sourcePackSha256}));
}
