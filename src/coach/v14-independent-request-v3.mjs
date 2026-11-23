// P2a-v3 isolated development input and output, never product inference by itself.
// The input is precisely the public projection from the older frozen source;
// no S42 reference, private player hands, teacher labels or future results.
import {createHash} from 'node:crypto';
import {PROOF_VERSION_V3,verifyV3PublicContrast} from './v14-evidence-proof-v3.mjs';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const fail=s=>{throw Error('independent-v3: '+s);};
const exact=(x,k)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join('|')===k.slice().sort().join('|');
const narrative=x=>typeof x==='string'&&x.trim().length>=8&&x.length<=3000;
export const INDEPENDENT_VERSION_V3='p2a-v3-independent-public-explanation-2';
export const INDEPENDENT_RESPONSE_SHAPE_V3={
 version:INDEPENDENT_VERSION_V3,requestHash:'<exact requestHash from input>',
 evidenceProof:{
  version:PROOF_VERSION_V3,requestHash:'<exact requestHash from input>',
  recommendation:{key:'<legal key from actions>',afterCallDiscard:null},
  alternative:{key:'<different legal key>',afterCallDiscard:null},
  comparisons:[
   {type:'actionKind',recommended:'<one of discard|riichi|call|kan|win|abort|pass>',alternative:'<one of same allowed kinds>',relation:'same|different'},
   {type:'shape',metric:'shanten',recommended:'<number from chosen candidate calc>',alternative:'<number from chosen alternative calc>',relation:'lower|higher|same'},
   {type:'conditionalRonByChoice',tile:'<actual possible winning tile>',recommendedMode:'ron|hypotheticalRiichiRon',alternativeMode:'ron|hypotheticalRiichiRon',
    recommended:{status:'conditionally_scored',basePoints:'<actual numeric defen>',yaku:['<source yaku>']},
    alternative:{status:'conditionally_scored',basePoints:'<actual numeric defen>',yaku:['<source yaku>']},relation:'same|different'}
  ],
  opponentObservations:[
   {seat:'<opponent seat number>',field:'riichi|meldCount|exposedYakuhaiHan|exposedDoraHan|discardCount|points|pointGapFromOwn',value:'<source value>',assessment:'potentially_relevant|not_established'}
  ],
  reversal:{unknownFactors:['pWin','pDealIn'],ifThen:'<specific if-then reversal condition in Japanese>'},
  explanation:'<specific tradeoff in Japanese separating source fact from tactical assumption>'
 },
 importantSeats:[{seat:'<seat classed potentially_relevant>',whyMatters:'<concrete public evidence and bounded hypothesis>',changeCondition:'<specific reversal>'}],
 uncertainSeats:[{seat:'<seat classed not_established>',reason:'<what cannot be inferred from public evidence>'}],
 educational:{reason:'<explain choice versus alternative>',opponentTradeoff:'<compare all three other players within limits>',
  boundary:'<unknown probabilities, unverified tactical effects>',lesson:'<specific takeaway>'}
};
const instruction=[
 '麻雀LABの開発専用Stage1。Mortalの推奨、隠し牌、未来の結果、ユーザーが実際に選んだ牌は渡されていない。',
 '合法な具体候補から推薦と有力な対案を選ぶ。立直とダマ（同じ牌を切る場合でも別行動）、ロンとスルー、鳴きとスルー、他家別現物という差を比較する。',
 '候補の数字が同じでも無理に違いを作らない。終端のロンには未来の向聴・受け入れ数を捏造しない。現物でない牌が危険とは確定できない。',
 'responseShapeは項目名の型見本であり、<...>の例示値・候補・席・点数をコピーしない。候補の数字・相手席・和了点は実際の公開入力と一致させる。必須は確認できるactionKind比較1つ以上。確認できない比較typeは出力しない。',
 '立直と同一牌ダマのロン点数はconditionalRonByChoiceで比較し、立直候補にはrecommendedMode/alternativeModeの該当側にhypotheticalRiichiRon、ダマ側にはronを指定する。sourceModeやstatus:suppliedは書かない。条件付き和了の値はsourceのbasePoints・yakuをそのまま引用し、status:conditionally_scoredかstatus:no_scored_win_under_assumptionsまたはstatus:not_suppliedだけを使う。',
 'opponentObservationsは合計1〜9件のみ許される。相手3人を各1席ずつ必ず含め、各席の観測事実は最大3件までに絞る。記録上限を超える場合は重要度判断に最も役立つ公開事実だけを優先する。',
 '相手3人には1席につき1つの重要度potentially_relevantまたはnot_establishedを割り当てる。同じ相手の複数事実はopponentObservationsへseat+fieldで別々に出せるが、同じ席の重要度を変えない。同じseat+fieldは重複禁止。assessment:observedという値は使わない。importantSeats/uncertainSeatsは重要度を揃え、相手席ごと1行ずつ。',
 '比較証明欄のtype/数字/具体候補/相手席は実際の公開入力と一致させる。候補の異なる現物・仮の和了基本点・点棒移動の違いを見て、自手・他家・着順の観点で説明する。',
 '仮の和了点数は見込み勝率・確定打点ではない。仮の順位変動は特定の和了/放銃が起きた場合のみ。未校正の聴牌確率・放銃率・期待収支は計算済みとして記述しない。',
 '判断を変えそうな他家だけをimportantSeatsに挙げ、根拠が薄い相手はuncertainSeatsへ。必ず当該観測と矛盾しないよう記載する。',
 '今の資料から比較が決まらなければ不確実性を正直に述べる。正しい確定算術やMortal順位の一致が、戦術説明の能力証明になるわけではない。',
 'JSONのみ出力し、comparisonは候補ごとの確定的な根拠を少なくとも1項目指定。根拠にない項目は含めない。'
].join('\n');
export function createV3IndependentDevelopmentRequest(source){
 if(!exact(source,['request','requestHash'])||source.request?.stage!=='independent'||
    hash(source.request)!==source.requestHash||source.request.input?.version!=='v14-pilot-calculated-1')
   fail('untrusted frozen public source');
 const input=structuredClone(source.request.input),request={stage:'independent-v3-dev',
  version:INDEPENDENT_VERSION_V3,system:instruction,
  responseShape:structuredClone(INDEPENDENT_RESPONSE_SHAPE_V3),
  sourcePublicInputHash:hash(input),input};
 const packet={request,requestHash:hash(request)};
 if(hash(packet.request.input)!==hash(source.request.input))fail('changed source public evidence');
 return packet;
}
export function verifyV3IndependentDevelopmentAnswer(envelope,answer){
 if(!exact(envelope,['request','requestHash'])||envelope.request?.stage!=='independent-v3-dev'||
    hash(envelope.request)!==envelope.requestHash||hash(envelope.request.input)!==envelope.request.sourcePublicInputHash)
   fail('mutated public or model input');
 if(!exact(answer,['version','requestHash','evidenceProof','importantSeats','uncertainSeats','educational'])||
    answer.version!==INDEPENDENT_VERSION_V3||answer.requestHash!==envelope.requestHash)
   fail('invalid answer contract');
 const p=verifyV3PublicContrast(envelope,answer.evidenceProof),own=envelope.request.input.evidence.find(e=>e.id==='board')?.value?.ownSeat;
 if(!Array.isArray(answer.importantSeats)||!Array.isArray(answer.uncertainSeats)||
    answer.importantSeats.length>3||answer.uncertainSeats.length>3)fail('invalid opponent classification');
 const expected=new Map(),seen=new Set();
 for(const o of answer.evidenceProof.opponentObservations){
  if(expected.has(o.seat)&&expected.get(o.seat)!==o.assessment)fail('opponent observation has conflicting classification');
  expected.set(o.seat,o.assessment);
 }
 for(const [kind,rows] of [['important',answer.importantSeats],['uncertain',answer.uncertainSeats]]){
  for(const r of rows){
   const ks=kind==='important'?['seat','whyMatters','changeCondition']:['seat','reason'];
   if(!exact(r,ks)||!Number.isInteger(r.seat)||r.seat<0||r.seat>3||
      r.seat===own||seen.has(r.seat)||expected.get(r.seat)!==(kind==='important'?'potentially_relevant':'not_established')||
      !(kind==='important'?narrative(r.whyMatters)&&narrative(r.changeCondition):narrative(r.reason)))
      fail('contradictory or unsupported opponent assessment');
   seen.add(r.seat);
  }
 }
 if(seen.size!==expected.size)fail('unaccounted opponent observation');
 if(!exact(answer.educational,['reason','opponentTradeoff','boundary','lesson'])||
    !Object.values(answer.educational).every(narrative))fail('invalid education prose');
 return {inputHash:envelope.requestHash,mechanicallyVerifiedFacts:p.candidateFactsVerified,
  distinctVerifiableDifferences:p.meaningfullyDistinctPublicFacts,
  rankHypotheticals:p.publicSettlementContextFacts,
  publicFacts:'verified',semanticQuality:'not_certified',expertise:'not_certified',
  instructionModel:'independent_stage1_development_only'};
}
export function makeV3SyntheticAnswer(packet,proof){
 const uncertain=[...new Set(proof.opponentObservations.map(o=>o.seat))].map(seat=>({seat,
  reason:'この相手の公開情報から確定する事実と、実際の脅威の大きさは別なので未確定とする。'}));
 return {version:INDEPENDENT_VERSION_V3,requestHash:packet.requestHash,evidenceProof:proof,
  importantSeats:[],uncertainSeats:uncertain,
  educational:{reason:'これは架空の単体テスト回答であり、算術や候補種別の確認以外は証明していない。',
   opponentTradeoff:'相手に対する公開情報と推測の危険度を分け、具体的な他家の影響は断定しない。',
   boundary:'実際の放銃率や和了率は未校正なので、数字の比較だけで最善とは断定できない。',
   lesson:'立直やスルーの選択では、先に合法行動と公開事実の区別を確認する。'}};
}
