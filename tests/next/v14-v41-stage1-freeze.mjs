// P2a-v4.1 new independent research sample. PRE new v41 model responses.
// Old v4 pilot42 is permanently excluded and not regraded. Original
// public source and seven other unattempted IDs are unchanged.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {selectV41ProspectiveSmoke,V41_EXPECTED_EIGHT} from '../../src/coach/v14-v41-smoke-selection.mjs';
import {createV3IndependentDevelopmentRequest} from '../../src/coach/v14-independent-request-v3.mjs';
import {createV41CompactDevelopmentPacket} from '../../src/coach/v14-compact-model-contract-v41.mjs';
import {createV41BlindControlBatch} from '../../src/coach/v14-l4-blind-controls-v41.mjs';
const h=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const SOURCE_SHA='271b4a304ed86dc41be2e72766e2b5cc496966bdf8a0ce5a8d5a5d0334e6103a';
export const V41_FREEZE_VERSION='p2a-v41-stage1-pilot42-replaced-20261123-1';
export function createV41FrozenStage1(source){
 if(h(source)!==SOURCE_SHA)throw Error('frozen source drift');
 const selection=selectV41ProspectiveSmoke(source);
 if(JSON.stringify(selection.selectedIds)!==JSON.stringify(V41_EXPECTED_EIGHT))
  throw Error('case freeze drift');
 const questions=selection.selectedIds.map(caseId=>{
  const frozen=source.find(x=>x.request.input.id===caseId);
  const envelope=createV3IndependentDevelopmentRequest(frozen);
  const packet=createV41CompactDevelopmentPacket(envelope);
  if(packet.request.publicBrief.caseId!==caseId||
     packet.request.sourcePublicInputHash!==envelope.request.sourcePublicInputHash)
   throw Error('original public case binding changed');
  return {caseId,envelope,packet};
 });
 const preAnswerWeakControls=createV41BlindControlBatch(
  questions.map(x=>x.envelope),selection.selectedIds);
 const rows=questions.map(x=>({caseId:x.caseId,packetHash:x.packet.requestHash,
  serializedPacketSha256:h(x.packet),previouslyAnsweredByModel:false}));
 const shared={version:V41_FREEZE_VERSION,
  originalFrozenSourceHash:SOURCE_SHA,
  oldPhase:'P2a-v4 NO_GO frozen; its pilot42 response known regression only',
  originalV4ModelAttempts:1,
  newV41ModelAttemptsAtFreeze:0,
  candidateExclusions:['pilot-48','pilot-42'],
  lockedSelectionRule:selection.basis,
  selectedIds:selection.selectedIds,
  rows,counts:{honbaPositive:selection.cases.filter(x=>x.honba>0).length,
   kyotakuPositive:selection.cases.filter(x=>x.kyotaku>0).length},
  issueFixed:'Lexical one-kanji false positives in 一致, 一方 and yaku names versus numeric amounts',
  noMortalReferenceOrFutureOrOpponentPrivateDataInQuestions:true,
  modifiedSourcePublicFacts:false,
  unchangedSevenFromPreviousTrial:true,
  testsMustPassBeforeAnyNewRealAnswer:true,
  failureRule:'First hard contract failure -> stop and report, do not posthoc revise or rescue',
  noExtraGeminiOrClaudePhaseRepairReviewPerUser:true,
  noPaidApi:true};
 const publicManifest={...shared,packetSetHash:h(rows),
  role:'PUBLIC_QUESTIONS_ONLY',
  maskedControls:'SEPARATE_VERIFIER_ONLY_NOT_FOR_ANSWERING_MODEL',
  note:'One new ChatGPT Temporary Chat for pilot-50 first; never attach existing pilot42 reply'};
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
 const {questions,publicManifest,verifierManifest}=createV41FrozenStage1(source);
 fs.mkdirSync(path.join(out,'public/questions'),{recursive:true});
 fs.mkdirSync(path.join(out,'verifier'),{recursive:true});
 for(const q of questions)fs.writeFileSync(path.join(out,'public/questions',q.caseId+'.json'),
  JSON.stringify(q.packet,null,2)+'\n');
 fs.writeFileSync(path.join(out,'public/manifest.json'),JSON.stringify(publicManifest,null,2)+'\n');
 fs.writeFileSync(path.join(out,'verifier/manifest.json'),JSON.stringify(verifierManifest,null,2)+'\n');
 fs.writeFileSync(path.join(out,'public/READ_ME_FIRST_JP.txt'),[
  '麻雀LAB P2a-v4.1 独立Stage1・修正版',
  '旧P2a-v4は検証器の日本語誤検出でNO-GO終了済み、旧pilot42は含まれません。',
  '新第1問はpilot-50であり、残り7問の候補は元のv4と同じです。',
  '既存の回答のリライト・繰り返しの合格は行わず、新規一時チャットで1問ずつ回答してください。',
  '各ファイルに含まれるrequest.systemとresponseShapeを厳守し、JSON原文のまま提示してください。',
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
