// P2a-v4.2 new independent research sample. PRE new v42 model responses.
// Old v4 pilot42 is permanently excluded and not regraded. Original
// public source and seven other unattempted IDs are unchanged.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {selectV42ProspectiveSmoke,V42_EIGHT} from '../../src/coach/v14-v42-smoke-selection.mjs';
import {createV3IndependentDevelopmentRequest} from '../../src/coach/v14-independent-request-v3.mjs';
import {createV42CompactDevelopmentPacket} from '../../src/coach/v14-compact-model-contract-v42.mjs';
import {createV42BlindControlBatch} from '../../src/coach/v14-l4-blind-controls-v42.mjs';
const h=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const SOURCE_SHA='271b4a304ed86dc41be2e72766e2b5cc496966bdf8a0ce5a8d5a5d0334e6103a';
export const V42_FREEZE_VERSION='p2a-v42-stage1-pilot50-replaced-20261123-1';
export function createV42FrozenStage1(source){
 if(h(source)!==SOURCE_SHA)throw Error('frozen source drift');
 const selection=selectV42ProspectiveSmoke(source);
 if(JSON.stringify(selection.selectedIds)!==JSON.stringify(V42_EIGHT))
  throw Error('case freeze drift');
 const questions=selection.selectedIds.map(caseId=>{
  const frozen=source.find(x=>x.request.input.id===caseId);
  const envelope=createV3IndependentDevelopmentRequest(frozen);
  const packet=createV42CompactDevelopmentPacket(envelope);
  if(packet.request.publicBrief.caseId!==caseId||
     packet.request.sourcePublicInputHash!==envelope.request.sourcePublicInputHash)
   throw Error('original public case binding changed');
  return {caseId,envelope,packet};
 });
 const preAnswerWeakControls=createV42BlindControlBatch(
  questions.map(x=>x.envelope),selection.selectedIds);
 const rows=questions.map(x=>({caseId:x.caseId,packetHash:x.packet.requestHash,
  serializedPacketSha256:h(x.packet),previouslyAnsweredByModel:false}));
 const shared={version:V42_FREEZE_VERSION,
  originalFrozenSourceHash:SOURCE_SHA,
  oldPhase:'P2a-v4 and P2a-v4.1 NO_GO or non-accepted; prior pilot42/pilot50 known regressions only',
  originalV4ModelAttempts:1,
  originalV41ModelAttempts:1,
  newV42ModelAttemptsAtFreeze:0,
  candidateExclusions:['pilot-48','pilot-42','pilot-50'],
  lockedSelectionRule:selection.method,
  selectedIds:selection.selectedIds,
  rows,counts:{honbaPositive:selection.cases.filter(x=>x.honba>0).length,
   kyotakuPositive:selection.cases.filter(x=>x.kyotaku>0).length},
  issueFixed:'responseShape seat numeric mismatch, ordinary model ID GPT-6 misinterpreted as score figure, and curved quotes/escaped FactID copy formatting logged without altering tactical semantics',
  noMortalReferenceOrFutureOrOpponentPrivateDataInQuestions:true,
  modifiedSourcePublicFacts:false,
  unchangedSevenFromPreviousTrial:true,
  copyOnlyTransportNormalizationLoggedAndRawPreserved:true,
  numericSeatResponseShapeAlignedWithVerifier:true,
  modelIdentifiersAreUnverifiedMetadataNotScoreFigures:true,
  testsMustPassBeforeAnyNewRealAnswer:true,
  failureRule:'First hard contract failure -> stop and report, do not posthoc revise or rescue',
  noExtraGeminiOrClaudePhaseRepairReviewPerUser:true,
  noPaidApi:true};
 const publicManifest={...shared,packetSetHash:h(rows),
  role:'PUBLIC_QUESTIONS_ONLY',
  maskedControls:'SEPARATE_VERIFIER_ONLY_NOT_FOR_ANSWERING_MODEL',
  note:'One new ChatGPT Temporary Chat for pilot-52 first; never attach prior pilot42 or pilot50 replies'};
 const verifierManifest={...shared,
  role:'SEALED_VERIFIER_ONLY_NO_MODEL_VIEW',
  controlSetHash:h(preAnswerWeakControls),
  weakControls:preAnswerWeakControls,
  noUserReplies:true,
  noIndependentModelScores:true};
 return {questions,publicManifest,verifierManifest};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){
 const [sourceFile,out]=process.argv.slice(2);
 if(!sourceFile||!out)throw Error('Usage: stage1-freeze.mjs original36.json outDir');
 const source=JSON.parse(fs.readFileSync(sourceFile,'utf8'));
 const {questions,publicManifest,verifierManifest}=createV42FrozenStage1(source);
 fs.mkdirSync(path.join(out,'public/questions'),{recursive:true});
 fs.mkdirSync(path.join(out,'verifier'),{recursive:true});
 for(const q of questions)fs.writeFileSync(path.join(out,'public/questions',q.caseId+'.json'),
  JSON.stringify(q.packet,null,2)+'\n');
 fs.writeFileSync(path.join(out,'public/manifest.json'),JSON.stringify(publicManifest,null,2)+'\n');
 fs.writeFileSync(path.join(out,'verifier/manifest.json'),JSON.stringify(verifierManifest,null,2)+'\n');
 fs.writeFileSync(path.join(out,'public/READ_ME_FIRST_JP.txt'),[
  '麻雀LAB P2a-v4.2 独立Stage1・修正版',
  '旧P2a-v4とv4.1は初回形式契約問題を記録済み。既回答pilot42・pilot50は含まれません。',
  '新第1問はpilot-52であり、残り7問の候補は元のv4と同じです。',
  '既存の回答のリライト・繰り返しの合格は行わず、新規一時チャットで1問ずつ回答してください。',
  '各ファイルのrequest.systemとresponseShapeに従い、可能ならファイル保存した元JSONを添付してください。インライン貼付けならASCII半角ダブルクォート、FactID二重角括弧にエスケープを入れず、席番号seatは数値を使ってください。',
  'モデル画面に表示されたモデル名と日時も記録してください。',
  'Gemini/Claudeの修正レビューはユーザー指示で不要です。解説能力を高評価するには別途独立L4採点が必要。',
  ''
 ].join('\n'));
 console.log(JSON.stringify({
  version:publicManifest.version,ids:publicManifest.selectedIds,
  packets:publicManifest.rows.map(x=>({id:x.caseId,hash:x.packetHash})),
  honba:publicManifest.counts.honbaPositive,kyotaku:publicManifest.counts.kyotakuPositive,
  newIndependentChatGPTReplies:0,sourceSha:SOURCE_SHA,controlSetHash:verifierManifest.controlSetHash
 }));
}
