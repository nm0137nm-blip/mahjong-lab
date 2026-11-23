// P2a-v3: candidate-specific PUBLIC conditional score and opponent exposed
// hand information. Never infer actual winning rates, ron danger, or EV.
// "basePoints" in source is total hand settlement before honba/kyotaku.
import {createHash} from 'node:crypto';
export const TABLE_VERSION_V3='p2a-v3-candidate-public-gain-opponent-evidence-1';
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const err=s=>{throw Error('v3-value-table: '+s);};
const exact=(v,ks)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===ks.slice().sort().join('|');
const ev=(i,k)=>i.evidence.find(x=>x.id===k)?.value;
const scored=x=>Number.isSafeInteger(x?.basePoints)&&x.basePoints>0&&Array.isArray(x.yaku);
const rank=(values,initialOrder,seat)=>1+values.filter((v,i)=>i!==seat&&(
 v>values[seat]||v===values[seat]&&initialOrder.indexOf(i)<initialOrder.indexOf(seat))).length;
function choice(i,c){
 if(!exact(c,['key','afterCallDiscard'])||typeof c.key!=='string')err('invalid choice');
 const a=i.actions.find(x=>x.key===c.key),value=ev(i,'calc-'+c.key);
 if(!a||!value)err('invalid action or missing public calculation');
 if(Array.isArray(value.afterCallDiscards)){
  const all=value.afterCallDiscards.filter(x=>x.discard===c.afterCallDiscard);
  if(typeof c.afterCallDiscard!=='string'||all.length!==1)err('not a legal concrete post-call discard');
  return {action:a,metric:all[0]};
 }
 if(c.afterCallDiscard!==null)err('unexpected post-call discard');
 return {action:a,metric:value};
}
function winningForms(metric,kind,board,opp){
 const x=metric.conditionalNormalWins;
 if(!Array.isArray(x))return {status:'not_quantified',scored:[],unscored:0,
  limitations:'no conditional winning forms; NOT a zero chance of winning'};
 const out=[],all=x.filter(v=>v&&typeof v.tile==='string');
 const start=board.scores.map(s=>s.points),seat=board.ownSeat;
 for(const v of all){
  const z=v[kind];
  if(!scored(z))continue;
  const payment=z.basePoints+board.honba*300,winPointChange=payment+board.kyotaku*1000;
  const after=start.slice();after[seat]+=winPointChange;after[opp]-=payment;
  out.push({tile:v.tile,yaku:[...z.yaku],calculatedDefen:z.basePoints,
   ownRonGainWithHonbaAndSticks:winPointChange,
   opponentRonLossWithHonba:payment,ownRankAfter:rank(after,board.initialOrder,seat),
   ranksAfter:after.map((_,s)=>rank(after,board.initialOrder,s)),pointsAfter:after});
 }
 const defens=out.map(a=>a.calculatedDefen);
 return {status:out.length?'some_conditional_scored_forms':'no_scored_form_for_this_visible_wait_set',
  scored:out,unscored:all.length-out.length,conditionalDefenRange:defens.length?
   {min:Math.min(...defens),max:Math.max(...defens)}:null,
  limitations:'Only physical hypothetical tile/role possibilities, not probabilities; self-furiten and hidden opponent hands are not resolved'};
}
function candidate(i,c,opponent,board){
 const x=choice(i,c),m=x.metric;
 const ownHan=Number.isSafeInteger(m.retainedDoraHan)?m.retainedDoraHan:null;
 return {choice:structuredClone(c),group:x.action.group,detail:x.action.detail,
  publicShanten:Number.isInteger(m.shanten)?m.shanten:null,
  publicUkeireUpperBound:Number.isInteger(m.ukeireUpperBound)?m.ukeireUpperBound:null,
  visibleRetainedDoraHan:ownHan,
  ownRiverFuriten:m.ownRiverFuriten??null,
  ronWinningForms:winningForms(m,'ron',board,opponent),
  // Tsumo base score is the total from all other seats. Distribution per
  // paying seat is unavailable here; do not simulate fake tsumo ranks.
  tsumoWinningForms:{status:Array.isArray(m.conditionalNormalWins)?'conditional_only':'not_quantified',
   tileScoreForms:Array.isArray(m.conditionalNormalWins)?m.conditionalNormalWins.filter(v=>scored(v.tsumo)).map(v=>({
     tile:v.tile,calculatedDefen:v.tsumo.basePoints,yaku:[...v.tsumo.yaku]})):[],
   rankSimulation:'not_derived_no_payer_distribution'},
  interpretation:'Public candidate shape and hypothetical scoring only, not chance, optimality, or opponent-specific expected cost'};
}
export function buildV3CandidateValueTable(envelope,spec){
 if(!exact(envelope,['request','requestHash'])||
    !['independent','independent-v3-dev'].includes(envelope.request?.stage)||
    sha(envelope.request)!==envelope.requestHash)err('untrusted immutable public input');
 if(!exact(spec,['recommendation','alternative','opponent'])||
    !Number.isInteger(spec.opponent)||spec.opponent<0||spec.opponent>3)err('invalid table spec');
 const i=envelope.request.input,b=ev(i,'board');
 if(!b||spec.opponent===b.ownSeat)err('own seat is not opponent');
 const opponent=ev(i,'public-value-'+spec.opponent);
 if(!opponent||!Number.isSafeInteger(opponent.exposedYakuhaiHan)||
    !Number.isSafeInteger(opponent.exposedDoraHan))err('opponent public evidence missing');
 if(sha(spec.recommendation)===sha(spec.alternative))err('identical concrete candidate');
 const cands=[candidate(i,spec.recommendation,spec.opponent,b),
   candidate(i,spec.alternative,spec.opponent,b)];
 const base=b.scores.map(s=>s.points),own=b.ownSeat,other=spec.opponent;
 const losses=[1000,2000,3900,8000].map(defen=>{
  const pay=defen+b.honba*300,after=base.slice();
  after[own]-=pay;after[other]+=pay+1000*b.kyotaku;
  return {illustrativeRonDefen:defen,ownLossBeforeSticks:-pay,
   ownRankAfter:rank(after,b.initialOrder,own),
   opponentRankAfter:rank(after,b.initialOrder,other),pointsAfter:after,
   label:'sensitivity assumption only: opponent actual hand value UNKNOWN'};
 });
 const comparison={equation:
   'pWinA * ownConditionalGainA - pDealA * illustrativeLossA > pWinB * ownConditionalGainB - pDealB * illustrativeLossB',
  unknown:['pWinA','pWinB','pDealA','pDealB','opponentActualRonValue','otherOutcomes','turnTempo'],
  candidateOwnConditionalGains:cands.map(c=>({key:c.choice.key,
   preview:c.ronWinningForms.scored.map(w=>({tile:w.tile,ownPointGain:w.ownRonGainWithHonbaAndSticks}))})),
  hypotheticalOpponentLossTiers:losses.map(l=>l.illustrativeRonDefen),
  assumptions:['A conditional winning tile has not been drawn; winning rates have NOT been inferred',
   'Unscored winning forms must not be treated as 0 expected gain',
   'The chosen opponent winning and other possible game outcomes are not predicted',
   'Opponent open han evidence does NOT determine their hidden winning tile or actual damage',
   'Equation intentionally remains unresolved without real calibrated probabilities'],
  verdict:'not_calculated_no_EV_no_rank_utility'};
 return {version:TABLE_VERSION_V3,requestHash:envelope.requestHash,
  caseId:i.id,source:'public_immutable_precalculated_only',
  specification:structuredClone(spec),
  candidates:cands,
  opponent:{seat:other,riichi:opponent.riichi,
   meldCount:opponent.meldCount,exposedDoraHan:opponent.exposedDoraHan,
   exposedYakuhaiHan:opponent.exposedYakuhaiHan,
   guaranteedVisibleHanIfAnyLegalWin:opponent.exposedDoraHan+opponent.exposedYakuhaiHan,
   hanWarning:'This is visible-han evidence conditional on a legal scoring hand; NOT a point loss floor or danger likelihood',
   publicPointGapFromOwn:opponent.pointGapFromOwn},
  sensitivityOwnRonLossByTier:losses,
  symbolicCandidateComparison:comparison,
  certification:'conditional_public_shape_and_settlement_arithmetic_not_tactical_skill'};
}
export function verifyV3CandidateValueTable(envelope,t){
 if(!t||typeof t!=='object')err('missing table');
 const expected=buildV3CandidateValueTable(envelope,t.specification);
 if(sha(expected)!==sha(t))err('candidate score, opponent seat or rank table differs from public input');
 return {verified:'bound_public_source_recomputation',candidates:2,
  ownConditionalDefenAndRankContext:'verified_only_as_hypothetical',
  opponentPublicHan:'verified_only_as_meld_information',
  actualProbabilityAndEV:'unknown',strategy:'not_certified'};
}
