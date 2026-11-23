// P2a-v3 NO-GO containment: source-backed fallback renderer, research branch only.
// Added AFTER genuine ChatGPT pilot-48 made a false "3900 deal-in" rank claim.
// NEVER pass LLM free-form sentences through this function. This is a provisional
// defensive view, not certification of the LLM's recommendation or playing skill.
import {verifyV3IndependentDevelopmentAnswer} from './v14-independent-request-v3.mjs';

const kind=g=>g<=36?'打牌':g===37?'立直':g<=41?'副露':g===42?'槓':g===43?'和了':g===44?'途中流局':g===45?'見送り':'不明';
const shape=new Map([['shanten','向聴数'],['ukeireUpperBound','受け入れ枚数の上限'],['retainedDoraHan','保持ドラ数']]);
const mode=new Map([['ron','ロンの条件付き計算'],['tsumo','ツモの条件付き計算'],['hypotheticalRiichiRon','立直時ロンの条件付き計算']]);
const fields=new Map([['riichi','立直済'],['meldCount','公開副露数'],['points','現在点数'],['pointGapFromOwn','自分との差'],['exposedYakuhaiHan','公開役牌翻'],['exposedDoraHan','公開ドラ翻'],['discardCount','河の枚数']]);
const fmt=x=>typeof x==='number'?x.toLocaleString('ja-JP'):typeof x==='boolean'?(x?'あり':'なし'):String(x);
function select(input,key){
 const r=input.actions.find(x=>x.key===key);
 if(!r)throw Error('safe-summary: unknown legal action');
 return {key,kind:kind(r.group),detail:r.detail||''};
}
function score(s){
 if(s.status==='conditionally_scored')
  return `${fmt(s.basePoints)}点〔${s.yaku.join('、')}〕`;
 if(s.status==='no_scored_win_under_assumptions')return '指定条件では有効な和了点なし';
 return 'この入力には確定計算なし';
}
export function renderV3ConstrainedPublicSummary(envelope,answer){
 // Bound candidate IDs, typed public comparisons and opponent facts to frozen
 // immutable input BEFORE using them. Raw model prose is never displayed.
 const v=verifyV3IndependentDevelopmentAnswer(envelope,answer);
 const input=envelope.request.input,proof=answer.evidenceProof;
 const comparisons=proof.comparisons.map(c=>{
  if(c.type==='actionKind')return `行動の種類：推薦 ${c.recommended}／対案 ${c.alternative}`;
  if(c.type==='shape')return `${shape.get(c.metric)}：推薦 ${fmt(c.recommended)}／対案 ${fmt(c.alternative)}`;
  if(c.type==='furiten')return `自己河フリテン：推薦 ${fmt(c.recommended)}／対案 ${fmt(c.alternative)}`;
  if(c.type==='seatGenbutsu')return `席${c.seat}の河の現物：推薦 ${fmt(c.recommended)}／対案 ${fmt(c.alternative)}`;
  if(c.type==='conditionalRonByChoice')return `${c.tile}：推薦の${mode.get(c.recommendedMode)} ${score(c.recommended)}／対案の${mode.get(c.alternativeMode)} ${score(c.alternative)}`;
  if(c.type==='conditionalPoints')return `${c.tile}：推薦の${mode.get(c.mode)} ${score(c.recommended)}／対案 ${score(c.alternative)}`;
  if(c.type==='rankScenario')return `仮定した相手席${c.opponent}のロン事象：自分和了時順位${c.ownWinRank}、放銃時順位${c.ownDealInRank}。これは選択肢ごとの確率ではない。`;
  throw Error('safe-summary: unsupported comparison');
 });
 const opponentObservations=proof.opponentObservations.map(o=>({
  seat:o.seat,field:o.field,label:fields.get(o.field),value:o.value,
  importance:o.assessment,display:`席${o.seat}：${fields.get(o.field)} ${fmt(o.value)}`
 }));
 return {
  source:'immutable_public_input_only',
  caseId:input.id,
  modelProposalNotCertified:true,
  safeToShowUnverifiedFreeProse:false,
  recommended:select(input,proof.recommendation.key),
  alternative:select(input,proof.alternative.key),
  verifiedComparisons:comparisons,
  verifiedOpponentObservations:opponentObservations,
  note:'モデルの推奨順位・戦術的な正しさは未検証です。点数は指定条件下の計算であり、和了率・放銃率・期待値ではありません。',
  verdict:'PUBLIC_FACT_SUMMARY_ONLY_NOT_COACH_CERTIFIED',
  verification:v,
  omitted:['evidenceProof.explanation','evidenceProof.reversal.ifThen',
   'importantSeats','uncertainSeats','educational']
 };
}
