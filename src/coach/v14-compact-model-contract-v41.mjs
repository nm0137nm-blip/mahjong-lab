// P2a-v4 compact one-question blind development packet and response verifier.
// Independent ChatGPT is responsible for concrete proposed action + tactical
// reasoning, NOT for retyping hard-coded arithmetic, public event objects,
// or verifier-grade proof structure. No actual model calls here.
import {createHash} from 'node:crypto';
import {createV4PublicBrief} from './v14-public-brief-v4.mjs';
import {createV4DeterministicSourceComparison} from './v14-source-comparison-proof-v4.mjs';
import {createV41PublicFactRegistry,verifyAndRenderV41AnchoredTactics,
  V41_TACTIC_VERSION} from './v14-anchored-tactical-text-v41.mjs';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const fail=s=>{throw Error('v4-compact-contract: '+s);};
const exact=(v,ks)=>v&&typeof v==='object'&&!Array.isArray(v)&&
 Object.keys(v).sort().join('|')===ks.slice().sort().join('|');
const own=x=>x.request.input.evidence.find(e=>e.id==='board')?.value?.ownSeat;
export const V41_COMPACT_PACKET='p2a-v41-independent-public-brief-1';
export const V41_COMPACT_RESPONSE='p2a-v41-compact-stage1-response-1';
export function createV41CompactDevelopmentPacket(envelope){
 const {brief,bytes}=createV4PublicBrief(envelope),facts=createV41PublicFactRegistry(envelope);
 const names=Object.keys(facts);
 const system=[
  '麻雀LAB P2a-v4.1 開発用の独立した麻雀戦術説明課題。Mortal推奨、隠し牌、未来、ユーザーの実際の選択、点棒の予測確率は入力に存在しない。',
  '与えられた全合法行動の中から推薦1件と異なる有力な対案1件を選ぶ。副露候補の場合は合法な afterCallDiscard を必ず具体的に指定し、鳴くかどうかと鳴いた後に切る牌を別に評価する。',
  'JSONの公開事実を実際に比較し、他家の点差、公開進行、現物、役牌、自己の速度や打点をできるだけ局面固有に解説する。早そうならダマ等の一般論だけにしない。',
  '自分の推奨は正答ラベルではない。未校正の他家聴牌確率・放銃確率・相手の隠し手や未来を断定しない。Mortalの内部理由やQ値を作らない。',
  '定量事実は[[factId]]を使って引用し、生の数字・漢数字による計算や点棒/牌の直書きをしない。factIdは公開されたavailableFactIdsから選ぶ。選択した鳴きの具体的打牌には[[candidate:<key>:afterCallDiscard]]を参照する。',
  '説明は相手の全3席について、それぞれ点差/点棒と公開された進行指標（副露/立直等）を根拠として記載。tradeoffは候補と相手情報を照合し、changeConditionには具体的な「もし...なら」条件を明記する。',
  '比較には推薦/対案双方の[[candidate:<key>:kind]]と、公開候補の形・打点など追加の確認可能な指標を必ず含める。bottonLineとreversalにも根拠IDを引用する。',
  'この回答は数値証明ファイルではない。出力はresponseShapeの項目と型だけを守るJSONオブジェクト1件のみ。サンプルの文字列や席番号を機械的にコピーしない。'
 ].join('\n');
 const request={stage:'p2a-v41-compact-independent-dev',version:V41_COMPACT_PACKET,
  sourceV3RequestHash:envelope.requestHash,
  sourcePublicInputHash:envelope.request.sourcePublicInputHash,
  system,availableFactIds:names,
  publicBrief:brief,
  responseShape:{
   version:V41_COMPACT_RESPONSE,requestHash:'<packet requestHash>',
   recommendation:{key:'<legal action key>',afterCallDiscard:null},
   alternative:{key:'<different legal key>',afterCallDiscard:null},
   tactics:{
    comparison:'[[candidate:<recommended>:kind]]と[[candidate:<alternative>:kind]]。さらに公開sourceの差を参照して相対比較する。',
    opponents:[
     {seat:'<one opponent seat>',importance:'potentially_relevant|not_established',
      analysis:'[[opponent:seat<seat>:points]]と[[opponent:seat<seat>:meldCount]]から推定を区別する。',
      tradeoff:'[[candidate:<recommended>:kind]]と[[opponent:seat<seat>:riichi]]を比較する。',
      changeCondition:'もし[[opponent:seat<seat>:riichi]]が変わる場合に判断が変化する。'}
    ],
    bottomLine:'[[candidate:<recommended>:kind]]から判断を示す。',
    reversal:'もし[[opponent:seat<seat>:meldCount]]の情報が変わる場合、選択条件を見直す。',
    lesson:'局面固有の学び（根拠のない数値を作らない）。'
   }
  },
  warnings:['Sample response shape is NOT a correct answer; fill exact legal key, seat, and source fact IDs.',
   'Some factIds for a concrete call afterCallDiscard and source-bound sensitivity are generated after the action choice and are not enumerated in this all-actions list.',
   'No model labels, probabilities, or hidden state is supplied.']};
 const packed={request,requestHash:hash(request)};
 if(Buffer.byteLength(JSON.stringify(packed),'utf8')>46000)
  fail('manual one-question pack exceeded compact byte bound');
 if(bytes>20000)fail('source brief too big');
 return packed;
}
function sourceGeneratedProof(envelope,response){
 const result=createV4DeterministicSourceComparison(
  envelope,response.recommendation,response.alternative);
 if(result.publicDifferences<1)
  fail('model supplied no meaningful public comparison; not a tactical proof');
 const proof=result.proof;
 const o=own(envelope),opponents=[0,1,2,3].filter(x=>x!==o);
 if(!Array.isArray(response.tactics.opponents)||response.tactics.opponents.length!==3)
  fail('all 3 public seats required');
 const seen=new Set(),observations=[];
 for(const row of response.tactics.opponents){
  if(!exact(row,['seat','importance','analysis','tradeoff','changeCondition'])||
     !opponents.includes(row.seat)||seen.has(row.seat)||
     !['potentially_relevant','not_established'].includes(row.importance))
    fail('invalid importance or duplicate seat');
  seen.add(row.seat);
  const publicSeat=envelope.request.input.evidence.find(x=>x.id==='public-value-'+row.seat)?.value;
  if(!publicSeat)fail('source public seat missing');
  for(const field of ['pointGapFromOwn','meldCount']){
   if(!Object.hasOwn(publicSeat,field))fail('missing required source public field');
   observations.push({seat:row.seat,field,value:publicSeat[field],assessment:row.importance});
  }
 }
 if(opponents.some(x=>!seen.has(x)))fail('public opponent missing');
 proof.opponentObservations=observations;
 return proof;
}
export function verifyAndRenderV41CompactModelResponse(envelope,packed,response){
 const recreated=createV41CompactDevelopmentPacket(envelope);
 if(!exact(packed,['request','requestHash'])||packed.requestHash!==recreated.requestHash||
    hash(packed.request)!==packed.requestHash)
  fail('manual request tampered or stale');
 if(!exact(response,['version','requestHash','recommendation','alternative','tactics'])||
    response.version!==V41_COMPACT_RESPONSE||response.requestHash!==packed.requestHash||
    !response.tactics||!Array.isArray(response.tactics.opponents))
  fail('invalid short answer version/shape');
 const proof=sourceGeneratedProof(envelope,response);
 const stripped={...response.tactics,opponents:response.tactics.opponents.map(x=>({
  seat:x.seat,analysis:x.analysis,tradeoff:x.tradeoff,changeCondition:x.changeCondition}))};
 const inner={
  version:V41_TACTIC_VERSION,requestHash:envelope.requestHash,
  proof,tactics:stripped};
 const rendered=verifyAndRenderV41AnchoredTactics(envelope,inner);
 return {version:V41_COMPACT_RESPONSE,packetHash:packed.requestHash,
  caseId:envelope.request.input.id,
  output:rendered,
  numericalProofOrigin:'code_generated_from_immutable_public_packet_not_model',
  opponentClassificationOrigin:'model_stated_importance_but_values_and_seats_source_bound',
  actualTacticalSkill:'not_certified_pending_independent_anonymous_blind_review',
  modelResponseAlteredForGrade:false,
  directModelMessage:structuredClone(response)};
}
