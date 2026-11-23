// v4 public candidate->conditional score->exact own-ron settlement binding.
// This module is NOT a probability model and never reads opponent hands,
// future tiles, teacher Q or the eventual game result.
import {createHash} from 'node:crypto';
import {verifyV4CurrentDealerSeat} from './v14-dealer-provenance-v4.mjs';
import {buildV4RonSettlement} from './v14-settlement-events-v4.mjs';
const h=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const fail=s=>{throw Error('v4-candidate-settlement: '+s);};
const ev=(i,id)=>i.evidence.find(x=>x.id===id)?.value;
const same=(a,b)=>h(a)===h(b);
export const V4_CANDIDATE_SETTLEMENT_VERSION='p2a-v4-source-candidate-conditional-settlement-1';

function bound(envelope) {
 if(!envelope||envelope.request?.stage!=='independent-v3-dev'||
    !same(envelope.requestHash,h(envelope.request))||
    !same(envelope.request.sourcePublicInputHash,h(envelope.request.input)))
  fail('mutated public evidence or request');
 const input=envelope.request.input,board=ev(input,'board');
 const dealerProof=verifyV4CurrentDealerSeat(board);
 return {input,board,dealerProof};
}
function materializeChoice(input,choice){
 if(!choice||Object.keys(choice).sort().join('|')!=='afterCallDiscard|key'||
    typeof choice.key!=='string')fail('invalid concrete choice');
 const a=input.actions.find(x=>x.key===choice.key),calc=ev(input,'calc-'+choice.key);
 if(!a||!calc)fail('choice not in public actions/calculations');
 if(a.group>=38&&a.group<=41){
  if(!Array.isArray(calc.afterCallDiscards)||typeof choice.afterCallDiscard!=='string')
   fail('call requires a concrete legal afterCallDiscard');
  const matches=calc.afterCallDiscards.filter(x=>x.discard===choice.afterCallDiscard);
  if(matches.length!==1)fail('afterCallDiscard absent/ambiguous in public source');
  return {a,metric:matches[0],status:'post_call_discard_concrete'};
 }
 if(choice.afterCallDiscard!==null)fail('unwanted afterCallDiscard for non-call action');
 if(a.group===37)return {a,metric:calc,status:'riichi_discard_concrete'};
 if(a.group<37)return {a,metric:calc,status:'silent_discard_concrete'};
 return {a,metric:calc,status:'terminal_or_pass_not_after_discard'};
}
export function buildV4CandidateSettlementCatalog(envelope,choice){
 const {input,board,dealerProof}=bound(envelope),m=materializeChoice(input,choice);
 const postRiichi=m.a.group===37;
 const trigger=postRiichi?'hypotheticalRiichiRon':'ron';
 const common={
  version:V4_CANDIDATE_SETTLEMENT_VERSION,
  requestHash:envelope.requestHash,
  sourceInputHash:envelope.request.sourcePublicInputHash,
  caseId:input.id,choice:structuredClone(choice),
  actionGroup:m.a.group,actionDetail:m.a.detail,choiceKind:m.status,
  dealerProvenance:dealerProof,
  sourceMode:trigger,
  probabilities:'not_supplied',sourceOnly:true,
  modelReferenceUsed:false,
  canCertifyTactics:false
 };
 if(m.status==='terminal_or_pass_not_after_discard')
  return {...common,status:'terminal_or_pass_no_immediate_future_ron_event',
    scoredOwnRon:[],unscoredOwnRon:[],dealInSensitivity:[],note:'No hypothetical post-discard event for terminal win, pass, abort, or kan; do not invent action continuation'};
 if(!Number.isInteger(m.metric.shanten)||m.metric.shanten!==0)
  return {...common,status:'not_tenpai_after_concrete_choice',
    scoredOwnRon:[],unscoredOwnRon:[],dealInSensitivity:[],
    note:'The chosen action is not in a public tenpai state; no exact immediate hypothetical ron score'};
 const forms=m.metric.conditionalNormalWins;
 if(!Array.isArray(forms))fail('tenpai metric lacks public conditional score array');
 // Win forms are conditional shape/role computations, not confirmed ron legality
 // or win rate. A furiten state may still tsumo but cannot ron.
 if(m.metric.ownRiverFuriten===true)
  return {...common,status:'own_river_furiten_no_ron_scenarios',
   scoredOwnRon:[],unscoredOwnRon:forms.map(x=>({tile:x.tile,
    reason:'own_river_furiten_blocks_ron_even_if_hand_has_conditional_score'})),
   dealInSensitivity:[],
   note:'Own river has at least one winning-tile type; legal ron is unavailable under the own-river-furiten assumption'};
 const seats=[0,1,2,3].filter(x=>x!==board.ownSeat);
 const scoredOwnRon=[],unscoredOwnRon=[],dealInSensitivity=[];
 for(const row of forms){
  if(typeof row?.tile!=='string')fail('invalid winning tile source');
  const conditional=row[trigger];
  if(!conditional){
   unscoredOwnRon.push({tile:row.tile,mode:trigger,reason:'no_scored_ron_under_given_yaku'});
   continue;
  }
  if(!Number.isSafeInteger(conditional.basePoints)||conditional.basePoints<=0||
     !Array.isArray(conditional.yaku)||conditional.yaku.some(x=>typeof x!=='string'))
   fail('malformed public conditional score');
  for(const opponentSeat of seats){
   const event=buildV4RonSettlement(board,{
    kind:'hypotheticalOwnRon',opponentSeat,dealerSeat:dealerProof.dealerSeat,
    paymentBase:conditional.basePoints,postRiichi});
   const factId=['candidate',input.id,choice.key,
    choice.afterCallDiscard===null?'none':choice.afterCallDiscard,
    trigger,row.tile,'opp'+opponentSeat,event.id].join(':');
   scoredOwnRon.push({factId,sourceEvidenceId:'calc-'+choice.key,
    sourceAfterCallDiscard:choice.afterCallDiscard,
    sourceTile:row.tile,sourceMode:trigger,
    yaku:[...conditional.yaku],scoreFromVisibleSource:conditional.basePoints,
    sourceScoreType:'conditional_ron_if_legally_won_not_probability',
    hypotheticalSettlement:event});
  }
 }
 const legacy=ev(input,'rank-scenarios');
 if(!legacy||legacy.status!=='hypothetical_settlements_only'||
    !Array.isArray(legacy.ron))fail('missing public settlement tier source');
 for(const row of legacy.ron){
  if(!seats.includes(row.other)||!Number.isSafeInteger(row.lossBase))
   fail('untrusted public tier');
  const pre=buildV4RonSettlement(board,{
   kind:'hypotheticalOwnDealIn',opponentSeat:row.other,
   dealerSeat:dealerProof.dealerSeat,paymentBase:row.lossBase,postRiichi:false});
  if(!same(pre.pointsAfter,row.lossPoints)||!same(pre.ranksAfter,row.lossRanks))
   fail('public tier settlement inconsistency');
  const event=postRiichi?buildV4RonSettlement(board,{
   kind:'hypotheticalOwnDealIn',opponentSeat:row.other,
   dealerSeat:dealerProof.dealerSeat,paymentBase:row.lossBase,postRiichi:true}):pre;
  dealInSensitivity.push({factId:[
   'hypotheticalRisk',input.id,choice.key,'opp'+row.other,event.id].join(':'),
   sourceEvidenceId:'rank-scenarios',sourceTierBase:row.lossBase,
   sourceIsIllustrativeNotActualOpponentValue:true,postRiichiExtraDeposit:postRiichi,
   hypotheticalSettlement:event});
 }
 return {...common,status:'public_source_bound_conditional_score_and_loss_sensitivity',
  scoredOwnRon,unscoredOwnRon,dealInSensitivity,
  note:'Each event conditional on winning/losing in an otherwise unrealized state. No actual win probability, deal-in probability, expected value, or unprovided opponent hand value is inferred'};
}
export function verifyV4CandidateSettlementCatalog(envelope,catalog){
 if(!catalog||typeof catalog!=='object')fail('missing catalog');
 const fresh=buildV4CandidateSettlementCatalog(envelope,catalog.choice);
 if(!same(fresh,catalog))fail('source-bound candidate settlement altered');
 return {verified:'candidate_action_mode_tile_yaku_and_event_identical_to_public_source',
  scoredEvents:fresh.scoredOwnRon.length,
  sensitivityEvents:fresh.dealInSensitivity.length,
  noOpponentActualWinEstimate:true,noActualExpectedValue:true};
}
