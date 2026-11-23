// P2a-v2: candidate-attached PUBLIC hypothetical outcomes, not a predicted
// distribution, opponent hand, actionable EV, or tactical recommendation.
// Every value comes from public immutable evidence previously audited separately.
import {createHash} from 'node:crypto';
export const TABLE_VERSION='v14-candidate-conditional-table-v2';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const fail=s=>{throw Error('conditional-table: '+s);};
const evidence=(i,id)=>i.evidence.find(e=>e.id===id)?.value;
const ownScore=(board)=>board.scores.map(s=>s.points);
function candidate(i,key,discard){
 const a=i.actions.find(a=>a.key===key);
 if(!a)fail('illegal action key');
 const c=evidence(i,'calc-'+key);
 if(!c||typeof c!=='object')fail('candidate missing calculation');
 let m=c;
 if(Array.isArray(c.afterCallDiscards)){
  if(typeof discard!=='string')fail('after-call discard required');
  const rows=c.afterCallDiscards.filter(x=>x.discard===discard);
  if(rows.length!==1)fail('unavailable or ambiguous post-call discard');
  m=rows[0];
 }else if(discard!==null)fail('unexpected after-call discard');
 const seatSafety=Array.isArray(m.safety)?m.safety.map(s=>({seat:s.seat,
  // False only says "not proven genbutsu" and is NOT a ron probability.
  ownRiverGenbutsu:s.ownRiverGenbutsu,
  interpretation:s.ownRiverGenbutsu?'safe_from_this_opponent_ron_by_own_river_only':'no_genbutsu_certificate'
 })):[];
 const shape=Number.isInteger(m.shanten)&&Number.isInteger(m.ukeireUpperBound)?
  {status:'public_shape_only',shanten:m.shanten,
   ukeireUpperBound:m.ukeireUpperBound,retainedDoraHan:m.retainedDoraHan,
   note:'Upper bound on physical tile copies; not chance of winning'}:
  {status:'not_quantified'};
 const wins=Array.isArray(m.conditionalNormalWins)?m.conditionalNormalWins.map(w=>({
  tile:w.tile,ron:w.ron,tsumo:w.tsumo,hypotheticalRiichiRon:w.hypotheticalRiichiRon,
  interpretation:'possible winning form under stated assumptions, not a forecast'
 })):[];
 return {key,group:a.group,detail:a.detail,afterCallDiscard:discard,shape,seatSafety,
  conditionalWinningForms:wins,winningFormStatus:wins.length?'hypothetical_only':'not_supplied'};
}
export function buildConditionalTable(envelope,spec){
 if(!envelope||envelope.request?.stage!=='independent'||
    hash(envelope.request)!==envelope.requestHash)fail('untrusted case/request');
 if(!spec||Object.keys(spec).sort().join('|')!==['alternative','alternativeDiscard','opponent','recommendation','recommendationDiscard','ronRowIndex'].sort().join('|'))fail('bad spec');
 const i=envelope.request.input,b=evidence(i,'board'),r=evidence(i,'rank-scenarios');
 if(!b||!r||r.status!=='hypothetical_settlements_only'||!Array.isArray(r.ron))fail('unavailable hypothetical rank table');
 if(spec.recommendation===spec.alternative)fail('identical candidate');
 if(!Number.isInteger(spec.opponent)||spec.opponent<0||spec.opponent>3||spec.opponent===b.ownSeat)fail('not an opponent');
 if(!Number.isInteger(spec.ronRowIndex)||spec.ronRowIndex<0||spec.ronRowIndex>=r.ron.length)fail('bad indexed row');
 const choice=spec.recommendation,alt=spec.alternative;
 const row=r.ron[spec.ronRowIndex];
 if(row.other!==spec.opponent)fail('scenario not indexed to declared opponent');
 const old=ownScore(b),own=b.ownSeat,gain=row.winPoints[own]-old[own],loss=old[own]-row.lossPoints[own];
 if(!Number.isSafeInteger(gain)||!Number.isSafeInteger(loss)||gain<=0||loss<=0)fail('invalid hypothetical transfers');
 return {
  version:TABLE_VERSION,requestHash:envelope.requestHash,caseId:i.id,
  specification:structuredClone(spec),
  candidates:[candidate(i,choice,spec.recommendationDiscard),candidate(i,alt,spec.alternativeDiscard)],
  chosenOpponent:spec.opponent,
  hypotheticalRon:{
   note:'EXPLICIT counterfactual settlement if own player wins ron from this seat, or deals into that seat at the specified base points. Not a likelihood or a candidate-specific strength estimate.',
   winBase:row.winBase,lossBase:row.lossBase,
   ownWin:{pointsAfter:structuredClone(row.winPoints),ranksAfter:structuredClone(row.winRanks),ownPointChange:gain,ownRankAfter:row.winRanks[own]},
   ownDealIn:{pointsAfter:structuredClone(row.lossPoints),ranksAfter:structuredClone(row.lossRanks),ownPointChange:-loss,ownRankAfter:row.lossRanks[own]}
  },
  symbolicComparison:{
   unknowns:['pWinRecommended','pDealInRecommended','pWinAlternative','pDealInAlternative'],
   // Under *additional* equal-other-outcomes assumption only.
   inequality:'pWinRecommended * gain - pDealInRecommended * loss > pWinAlternative * gain - pDealInAlternative * loss',
   coefficients:{gain,loss},
   assumptions:['Other outcomes, including other seats winning, draw and tempo, cancel between the two actions in this restricted toy comparison.',
    'pWin and pDealIn are UNKNOWN and are not estimated by this table.',
    'The same hypothetical ron point tier is applied to both actions; actual scoring possibilities may differ.'],
   outcome:'undetermined_without_probabilities',
   utility:'own_point_change_only_no_terminal_rank_utility'
  },
  certification:'hypothetical_public_arithmetic_only_not_ev_or_b3_b4_certification'
 };
}
export function verifyConditionalTable(envelope,table){
 const b=buildConditionalTable(envelope,table?.specification);
 if(hash(b)!==hash(table))fail('stored conditional table differs from immutable public facts');
 return {requestHash:envelope.requestHash,verified:'same_source_recalculation',
  independentOracle:'not_provided',tacticalOutcome:'not_certified'};
}
