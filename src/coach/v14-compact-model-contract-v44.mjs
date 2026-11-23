// P2a-v4 compact one-question blind development packet and response verifier.
// Independent ChatGPT is responsible for concrete proposed action + tactical
// reasoning, NOT for retyping hard-coded arithmetic, public event objects,
// or verifier-grade proof structure. No actual model calls here.
import {createHash} from 'node:crypto';
import {createV4PublicBrief} from './v14-public-brief-v4.mjs';
import {createV4DeterministicSourceComparison} from './v14-source-comparison-proof-v4.mjs';
import {createV44SourceShapeContrast} from './v14-source-shape-contrast-v44.mjs';
import {createV44PublicFactRegistry,verifyAndRenderV44AnchoredTactics,
  V44_TACTIC_VERSION} from './v14-anchored-tactical-text-v44.mjs';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const fail=s=>{throw Error('v4-compact-contract: '+s);};
const exact=(v,ks)=>v&&typeof v==='object'&&!Array.isArray(v)&&
 Object.keys(v).sort().join('|')===ks.slice().sort().join('|');
const own=x=>x.request.input.evidence.find(e=>e.id==='board')?.value?.ownSeat;
const canonicalSeat=x=>(typeof x==='string'&&/^[0-3]$/.test(x))?Number(x):x;
export const V44_COMPACT_PACKET='p2a-v44-independent-public-brief-1';
export const V44_COMPACT_RESPONSE='p2a-v44-compact-stage1-response-1';
export function createV44CompactDevelopmentPacket(envelope){
 const {brief,bytes}=createV4PublicBrief(envelope),facts=createV44PublicFactRegistry(envelope);
 const names=Object.keys(facts);
 const system=[
  '麻雀LAB P2a-v4.4 開発用の独立した麻雀戦術説明課題。Mortal推奨、隠し牌、未来、ユーザーの実際の選択、点棒の予測確率は入力に存在しない。',
  '与えられた全合法行動の中から推薦1件と異なる有力な対案1件を選ぶ。副露候補の場合は合法な afterCallDiscard を必ず具体的に指定し、鳴くかどうかと鳴いた後に切る牌を別に評価する。',
  'JSONの公開事実を実際に比較し、他家の点差、公開進行、現物、役牌、自己の速度や打点をできるだけ局面固有に解説する。早そうならダマ等の一般論だけにしない。',
  '自分の推奨は正答ラベルではない。未校正の他家聴牌確率・放銃確率・相手の隠し手や未来を断定しない。Mortalの内部理由やQ値を作らない。',
  '定量事実は[[factId]]を使って引用し、生の数字・漢数字による計算や点棒/牌の直書きをしない。factIdは公開されたavailableFactIdsから選ぶ。選択した鳴きの具体的打牌には[[candidate:<key>:afterCallDiscard]]を参照する。',
  '相手の全3席について別々にanalysis・tradeoff・changeConditionを記載する。analysisにはその席の点差/点棒FactIDと副露/立直等の公開進行FactIDを両方引用する。',
  '必須：各席のtradeoff本文は、同じ席番号の[[opponent:seat<seat>:...]] FactIDと[[candidate:<legal key>:...]] FactIDを少なくとも1件ずつ直接引用する。analysisや別席だけで引用してもtradeoffの代用にはならない。具体的な河の現物比較には公開河FactIDや選択した候補のgenbutsuSeat FactIDを使う（存在する場合のみ）。',
  '必須：各席のchangeConditionと全体reversalは対象席を示すFactIDと、日本語の明確な条件（「もし...なら」「...でなければ」「...になれば」「...の場合」「...ならば」など）と、そのとき判断をどう変えるかを書く。',
  '比較には推薦/対案双方の[[candidate:<key>:kind]]と追加の公開形・打点指標を含め、bottomLineとreversalにも適切な根拠IDを引用する。',
  '特に候補の総向聴数・受け入れ合計・ドラ枚数・現物判定が同じ場合は、通常手としての向聴数[[candidate:<key>:standardShanten]]、改善牌内訳[[candidate:<key>:improvingSummary]]、具体的な打牌[[candidate:<key>:discardTile]]（それぞれ利用可能なもの）を推薦と対案の双方で照合し、実際に差がある項目のFactIDを両候補分直接引用して説明する。差が確認できない場合は別の有力対案を選び直す。両候補が同じと虚偽に断定しない。',
  'この回答は数値証明ファイルではない。responseShapeの項目と型だけを守るJSONオブジェクト1件を、request.delivery.filenameで指定されたUTF-8のJSONファイルとして作成・添付し、チャット本文はファイルリンクのみとする。回答JSONを本文に貼り付けない。相手席番号seatは数値0,1,2,3のうち自分以外の3席として記載し、サンプルの文字列や席番号を機械的にコピーしない。ASCIIの半角ダブルクォートでJSONを記述し、参照IDの[[と]]にバックスラッシュを入れない。JSON前後のコードフェンスや解説は不要。モデル自身の名称を戦術説明へ書かず、回答画面のモデル名は依頼主が別に記録する。'
 ].join('\n');
 const request={stage:'p2a-v44-compact-independent-dev',version:V44_COMPACT_PACKET,
  sourceV3RequestHash:envelope.requestHash,
  sourcePublicInputHash:envelope.request.sourcePublicInputHash,
  system,availableFactIds:names,
  publicBrief:brief,
  delivery:{
   format:'UTF-8 JSON FILE ATTACHMENT, NOT PASTED TEXT',
   filename:'mahjong_P2a_v44_stage1_'+envelope.request.input.id+'_response.json',
   chatBody:'file link only',
   preserveOriginalResponse:true
  },
  responseShape:{
   version:V44_COMPACT_RESPONSE,requestHash:'<packet requestHash>',
   recommendation:{key:'<legal action key>',afterCallDiscard:null},
   alternative:{key:'<different legal key>',afterCallDiscard:null},
   tactics:{
    comparison:'[[candidate:<recommended>:kind]]と[[candidate:<alternative>:kind]]。さらに公開sourceの差を参照して相対比較する。',
    opponents:[
     {seat:0,importance:'potentially_relevant|not_established',
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
   'Some selected-action factIds (afterCallDiscard, afterCallRonSummary, genbutsuSeatN) are derived only after a legal concrete choice. Cite them only if the original public candidate calculation supports them.',
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
 const sourceShape=createV44SourceShapeContrast(envelope,
  response.recommendation,response.alternative);
 if(result.publicDifferences+sourceShape.verifiedAdditionalDifferences<1)
  fail('no verified public difference: identical action class, source shape, improving tiles, concrete discard and known safety');
 const proof=result.proof;
 const o=own(envelope),opponents=[0,1,2,3].filter(x=>x!==o);
 if(!Array.isArray(response.tactics.opponents)||response.tactics.opponents.length!==3)
  fail('all 3 public seats required');
 const seen=new Set(),observations=[];
 for(const row of response.tactics.opponents){
  const seat=canonicalSeat(row.seat);
  if(!exact(row,['seat','importance','analysis','tradeoff','changeCondition'])||
     !opponents.includes(seat)||seen.has(seat)||
     !['potentially_relevant','not_established'].includes(row.importance))
    fail('invalid importance or duplicate seat');
  seen.add(seat);
  const publicSeat=envelope.request.input.evidence.find(x=>x.id==='public-value-'+seat)?.value;
  if(!publicSeat)fail('source public seat missing');
  for(const field of ['pointGapFromOwn','meldCount']){
   if(!Object.hasOwn(publicSeat,field))fail('missing required source public field');
   observations.push({seat,field,value:publicSeat[field],assessment:row.importance});
  }
 }
 if(opponents.some(x=>!seen.has(x)))fail('public opponent missing');
 proof.opponentObservations=observations;
 return proof;
}
export function verifyAndRenderV44CompactModelResponse(envelope,packed,response){
 const recreated=createV44CompactDevelopmentPacket(envelope);
 if(!exact(packed,['request','requestHash'])||packed.requestHash!==recreated.requestHash||
    hash(packed.request)!==packed.requestHash)
  fail('manual request tampered or stale');
 if(!exact(response,['version','requestHash','recommendation','alternative','tactics'])||
    response.version!==V44_COMPACT_RESPONSE||response.requestHash!==packed.requestHash||
    !response.tactics||!Array.isArray(response.tactics.opponents))
  fail('invalid short answer version/shape');
 const proof=sourceGeneratedProof(envelope,response);
 const stripped={...response.tactics,opponents:response.tactics.opponents.map(x=>({
  seat:canonicalSeat(x.seat),analysis:x.analysis,tradeoff:x.tradeoff,changeCondition:x.changeCondition}))};
 const inner={
  version:V44_TACTIC_VERSION,requestHash:envelope.requestHash,
  proof,tactics:stripped};
 const rendered=verifyAndRenderV44AnchoredTactics(envelope,inner);
 return {version:V44_COMPACT_RESPONSE,packetHash:packed.requestHash,
  caseId:envelope.request.input.id,
  output:rendered,
  numericalProofOrigin:'code_generated_from_immutable_public_packet_not_model',
  opponentClassificationOrigin:'model_stated_importance_but_values_and_seats_source_bound',
  actualTacticalSkill:'not_certified_pending_independent_anonymous_blind_review',
  modelResponseAlteredForGrade:false,
  opponentSeatRepresentationNormalizedOnly:response.tactics.opponents.filter(x=>typeof x.seat==='string').length,
  directModelMessage:structuredClone(response)};
}
