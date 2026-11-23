// Prospective P2a-v4.4 8-case public-only questions, new first attempt must
// be after freezing this file and hashes. Past GPT-exposed pilot48/42/50/52/47/59
// are permanently excluded; v4.2 2/3 outcome is never revised.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {selectV44ProspectiveSmoke,V44_EIGHT} from '../../src/coach/v14-v44-smoke-selection.mjs';
import {createV3IndependentDevelopmentRequest} from '../../src/coach/v14-independent-request-v3.mjs';
import {createV44CompactDevelopmentPacket} from '../../src/coach/v14-compact-model-contract-v44.mjs';
import {createV44BlindControlBatch} from '../../src/coach/v14-l4-blind-controls-v44.mjs';
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export const V44_SOURCE_SHA='271b4a304ed86dc41be2e72766e2b5cc496966bdf8a0ce5a8d5a5d0334e6103a';
export const V44_FREEZE_VERSION='p2a-v44-eight-new-8-prompt-prereg-1';
export function createV44FrozenStage1(frozen){
 if(sha(frozen)!==V44_SOURCE_SHA)throw Error('v44 original public source changed');
 const panel=selectV44ProspectiveSmoke(frozen);
 if(JSON.stringify(panel.selectedIds)!==JSON.stringify(V44_EIGHT))
  throw Error('v44 selection drift');
 const questions=panel.selectedIds.map(caseId=>{
  const raw=frozen.find(x=>x.request.input.id===caseId);
  const envelope=createV3IndependentDevelopmentRequest(raw);
  const packet=createV44CompactDevelopmentPacket(envelope);
  if(packet.request.publicBrief.caseId!==caseId||
     packet.request.sourcePublicInputHash!==envelope.request.sourcePublicInputHash)
   throw Error('v44 public source binding changed');
  if(packet.request.delivery.filename!=='mahjong_P2a_v44_stage1_'+caseId+'_response.json')
   throw Error('v44 user file delivery not included in prompt');
  return {caseId,envelope,packet};
 });
 const controls=createV44BlindControlBatch(questions.map(q=>q.envelope),panel.selectedIds);
 const rows=questions.map(q=>({caseId:q.caseId,packetHash:q.packet.requestHash,
  fullPacketSha256:sha(q.packet),previouslyAnsweredByModel:false}));
 const shared={
  version:V44_FREEZE_VERSION,originalPublicSourceHash:V44_SOURCE_SHA,
  selectedIds:panel.selectedIds,selectionReason:panel.selectionMethod,
  previouslyAnsweredAndExcluded:panel.excludedPreviouslyGPTAnswered,
  oldVersionOutcomes:'v4 NO-GO; v4.1 NO-GO; v4.2 2/3 CLOSED_NO_GO; v4.3 6/7 CLOSED_NO_GO; never retroactively regrade',
  originalModelTrialsNotCountedAsV44:true,
  newV44IndependentResponsesAtFreeze:0,
  questionFileCount:8,rows,
  fileDeliveryRequired:true,
  futureChatModel:'GPT-6 (user-stated; UI identity not cryptographically verified)',
  sourceHonbaPositive:panel.sourceOnlyCases.filter(x=>x.honba>0).length,
  sourceKyotakuPositive:panel.sourceOnlyCases.filter(x=>x.kyotaku>0).length,
  noModelQOrHiddenHandsOrFutureState:true,
  conclusion:'DEVELOPMENT_READY_ONLY, genuine model tactical quality not certified',
  firstCriticalFailure:'NO_GO, preserve first raw response, do not change frozen contract for retrospective passing',
  thirdPartyPatchReview:'waived per user for minor contract engineering only; masked independent L4 still required',
  freeExternalModelApiCalls:0
 };
 const publicManifest={
  ...shared,publicPacketSetHash:sha(rows),
  role:'PUBLIC_MODEL_PROMPTS_ONLY',
  controls:'NEVER_INCLUDE_VERIFIER_CONTROL_FILE_IN_MODEL_PROMPT',
  note:'One fresh temporary GPT-6 chat per question. Produce UTF-8 JSON attachment not pasted reply. The source-bound verifier is separate from semantic L4 evaluation.'
 };
 const verifierManifest={...shared,role:'VERIFIER_ONLY_NOT_MODEL_INPUT',
  weakControlDigest:sha(controls),weakControls:controls,
  originalUserModelReplies:0,blindL4Scores:0};
 return {questions,publicManifest,verifierManifest};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){
 const [originalSource,outputDir]=process.argv.slice(2);
 if(!originalSource||!outputDir)throw Error('Usage: stage1-freeze.mjs source36.json outDir');
 const p=createV44FrozenStage1(JSON.parse(fs.readFileSync(originalSource,'utf8')));
 for(const d of ['public/questions','verifier'])fs.mkdirSync(path.join(outputDir,d),{recursive:true});
 for(const q of p.questions)
  fs.writeFileSync(path.join(outputDir,'public/questions',q.caseId+'.json'),
    JSON.stringify(q.packet,null,2)+'\n');
 fs.writeFileSync(path.join(outputDir,'public/manifest.json'),
  JSON.stringify(p.publicManifest,null,2)+'\n');
 fs.writeFileSync(path.join(outputDir,'verifier/manifest.json'),
  JSON.stringify(p.verifierManifest,null,2)+'\n');
 fs.writeFileSync(path.join(outputDir,'public/READ_ME_FIRST_JP.txt'),[
  '麻雀LAB P2a-v4.4 独立Stage1・新規未見8問',
  '回答済みpilot48,42,50,52,47,59,43,49,57,62,63,71,70は一切含めません。',
  '1問につき新規ChatGPT一時チャットを使用。モデルはGPT-6（ユーザー申告）。',
  '問題JSONのrequest.systemとresponseShapeを変更せず、推薦・対案・根拠を独立に判断してください。',
  '各席のtradeoff本文には当該席のopponent:seatN:...と候補candidate:...両方のFactIDを明示してください。',
  '推奨と対案で総向聴・受け入れ合計・保持ドラが同じなら、双方のstandardShanten・improvingSummary・discardTile FactIDで公開差を具体的に引用してください。',
  'changeConditionは、もし...なければ、もし...なれば、もし...なら等の条件と選択反転を示してください。',
  '回答はrequest.delivery.filenameのUTF-8 JSONファイルとして作成・添付。平文にJSONを貼らない。',
  '既存回答、Mortalの推奨、L4弱対照、裏情報などを回答モデルに見せない。',
  '元モデル応答のリライトや同問題の再挑戦を新たな独立成功と計数しません。',
  '研究用の形式・公開事実の測定であり、戦術力やS42一致を証明するものではありません。',
  ''
 ].join('\n'));
 console.log(JSON.stringify({
  version:p.publicManifest.version,first:p.questions[0].caseId,
  cases:p.publicManifest.rows,sourceHash:V44_SOURCE_SHA,
  originalV42Closed:true,actualNewIndependentModelResponses:0,
  controlsSHA:p.verifierManifest.weakControlDigest}));
}
