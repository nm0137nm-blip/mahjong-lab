// Versioned public-only question pack: DRAFT until v4 protocol is preregistered.
// No real ChatGPT response is generated, no teacher reference included.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createV3IndependentDevelopmentRequest} from '../../src/coach/v14-independent-request-v3.mjs';
import {createV4CompactDevelopmentPacket} from '../../src/coach/v14-compact-model-contract-v4.mjs';
import {selectV4ProspectiveSmoke} from '../../src/coach/v14-v4-smoke-selection.mjs';
const h=x=>createHash('sha256').update(x).digest('hex');
export function buildV4DraftPublicPack(frozen){
 const panel=selectV4ProspectiveSmoke(frozen),questions=[];
 for(const id of panel.selectedIds){
  const source=frozen.find(x=>x.request.input.id===id);
  if(!source)throw Error('missing frozen source case '+id);
  const e=createV3IndependentDevelopmentRequest(source),packet=createV4CompactDevelopmentPacket(e);
  if(packet.request.publicBrief.caseId!==id||packet.request.sourcePublicInputHash!==e.request.sourcePublicInputHash)
   throw Error('public case identity lost');
  questions.push({id,packet,packetHash:packet.requestHash,modelAnswer:null,
   sha256:h(JSON.stringify(packet))});
 }
 const manifest={version:'p2a-v4-compact-public-only-draft-1',
  status:'DEVELOPMENT_PACKAGE_NOT_PREREGISTERED_DO_NOT_SEND_TO_MODELS_YET',
  selection:panel,
  candidateSourceCases:36,
  questions:questions.map(({id,packetHash,sha256})=>({id,packetHash,sha256})),
  genuineIndependentChatGPTReplies:0,actualStage2Replies:0,actualL4Grades:0,
  paidModelCalls:0,blindModelNotYetRun:true,
  noTeacherReferences:true,noOpponentPrivateHands:true,noFutureEvents:true,
  warning:'Frozen previous public source only. This packet does not certify legality, probability, S42 policy quality or expert explanation. Complete independent test protocol before use.'};
 return {manifest,questions};
}
const invoked=process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1]);
if(invoked){
 const input=process.argv[2],out=process.argv[3];
 if(!input||!out)throw Error('Usage: node v14-v4-compact-pack.mjs independent-requests.json outputDir');
 const frozen=JSON.parse(fs.readFileSync(input,'utf8'));
 const {manifest,questions}=buildV4DraftPublicPack(frozen);
 fs.mkdirSync(path.join(out,'questions'),{recursive:true});
 for(const q of questions)fs.writeFileSync(path.join(out,'questions',q.id+'.json'),
  JSON.stringify({request:q.packet.request,requestHash:q.packet.requestHash},null,2)+'\n');
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 fs.writeFileSync(path.join(out,'READ_ME_FIRST_JP.txt'),[
  '麻雀LAB P2a-v4 公開8問コンパクト試験・開発用DRAFT',
  'このパックは開発検証物であり、まだ事前登録・実LLM開始GOではありません。',
  '質問はquestions/以下に1問ずつあります。旧回答pilot-48は含まれません。',
  '全問に公開手牌、相手の河と副露、点棒、合法候補を収録しています。',
  'モデルにMortal Q・他家の伏せ手・未来牌や正解の推奨手は渡していません。',
  '回答の推奨手と理由はLLMから、点棒計算/和了点・合法手の証明は開発側のプログラムから。',
  'モデル実測・Claude/Gemini匿名採点を開始する前に、版ごとの試験停止基準と全合格条件を別途凍結します。',
  'ユーザーへモデル試験を依頼するのは、その後のみです。',
  ''
 ].join('\n'));
 console.log(JSON.stringify({status:manifest.status,ids:manifest.questions.map(x=>x.id),
  publicCases:manifest.candidateSourceCases,realModelReplies:0,files:questions.length}));
}
