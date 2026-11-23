// P2a-v3 verifier-only public counterfactual PAIR PREPARATION.
// No S42 replay or correctness labels here. Two interventions:
//  - remove exactly one public opponent riichi with the mandatory 1,000 stick
//  - transfer 3,900 public points between own player and another player at a
//    round where earlier rounds exist; hypothetical alternative earlier scoring.
// The first is coupled declaration + stick. The second models alternative
// earlier round scores, NOT a rewrite of this hand's public tile history.
// Both retain the same physical candidate mask, but this alone DOES NOT prove
// the changed state was produced by the original hidden-hand game process.
import {createHash} from 'node:crypto';
import {createV3IndependentDevelopmentRequest} from './v14-independent-request-v3.mjs';
export const PREP_VERSION='p2a-v3-new36-counterfactual-public-preparation-1';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const fail=s=>{throw Error('v3-pair-prep: '+s);};
const val=(i,id)=>i.evidence.find(e=>e.id===id)?.value;
const eq=(a,b)=>hash(a)===hash(b);
function rank(pts,priority,seat){
 return 1+pts.filter((n,j)=>j!==seat&&(n>pts[seat]||
  n===pts[seat]&&priority.indexOf(j)<priority.indexOf(seat))).length;
}
function rankRows(board){
 if(board.pendingReach)return {status:'withheld_pending_riichi'};
 const base=board.scores.map(x=>x.points),own=board.ownSeat;
 const all=(scores)=>scores.map((_,s)=>rank(scores,board.initialOrder,s));
 const ron=[];
 for(const other of [0,1,2,3].filter(s=>s!==own)){
  for(const [child,parent] of [[1000,1500],[2000,2900],[3900,5800],[7700,11600],[8000,12000]]){
   const win=base.slice(),loss=base.slice();
   const gain=(own===0?parent:child)+300*board.honba,penalty=(other===0?parent:child)+300*board.honba;
   win[own]+=gain+1000*board.kyotaku;win[other]-=gain;
   loss[own]-=penalty;loss[other]+=penalty+1000*board.kyotaku;
   ron.push({other,winBase:own===0?parent:child,winPoints:win,winRanks:all(win),
    lossBase:other===0?parent:child,lossPoints:loss,lossRanks:all(loss)});
  }
 }
 const tsumo=[];
 for(const winner of [0,1,2,3])for(const unit of [500,1000,2000]){
  const scores=base.slice();
  for(let s=0;s<4;s++)if(s!==winner){
   const pay=(winner===0||s===0?2*unit:unit)+100*board.honba;
   scores[s]-=pay;scores[winner]+=pay;
  }
  scores[winner]+=1000*board.kyotaku;
  tsumo.push({winner,childPay:winner===0?2*unit:unit,parentPay:winner===0?null:2*unit,
   points:scores,ranks:all(scores)});
 }
 return {status:'hypothetical_settlements_only',initialOrder:structuredClone(board.initialOrder),
  currentRanks:all(base),ron,tsumo,
  note:'仮の和了・放銃点棒移動。実際の和了可能性・打点や終局・複数和了は推定しない。'};
}
const sum=(b)=>b.scores.reduce((n,s)=>n+s.points,0)+1000*b.kyotaku;
function updating(i){
 const b=val(i,'board'),r=val(i,'rank-scenarios');
 if(!b||!r||r.status!=='hypothetical_settlements_only'||!eq(rankRows(b),r))
  fail('source rank evidence invalid; cannot generate legal-looking variant');
 const before=sum(b);
 const close=()=>{
  if(sum(b)!==before||b.scores.some(s=>s.points<0))fail('points/sticks invalid');
  b.rank=rank(b.scores.map(s=>s.points),b.initialOrder,b.ownSeat);
  const result=rankRows(b),row=i.evidence.find(x=>x.id==='rank-scenarios');
  row.value=result;
  for(const p of i.evidence.filter(x=>x.id.startsWith('public-value-'))){
   const seat=Number(p.id.slice('public-value-'.length));
   p.value.points=b.scores[seat].points;
   p.value.pointGapFromOwn=p.value.points-b.scores[b.ownSeat].points;
  }
  if(!eq(val(i,'rank-scenarios'),rankRows(b)))fail('rank regeneration incorrect');
 };
 return {b,close};
}
function removeReach(envelope,seat){
 const i=structuredClone(envelope.request.input),{b,close}=updating(i),r=val(i,'seat-'+seat);
 if(!r||seat===b.ownSeat||!r.riichi||b.kyotaku<1)fail('unsupported public riichi removal');
 const flags=r.discards.filter(x=>x.riichi===true);
 const history=val(i,'history'),marks=history.filter(x=>x.種類==='打牌'&&x.席===seat&&x.立直宣言===true);
 if(flags.length!==1||marks.length!==1||!eq(flags[0].tile,marks[0].牌)||
    flags[0].tsumogiri!==marks[0].ツモ切り)fail('not exactly one matching declared discard');
 r.riichi=false;flags[0].riichi=false;marks[0].立直宣言=false;
 b.kyotaku--;b.scores[seat].points+=1000;
 const p=val(i,'public-value-'+seat);if(!p||p.riichi!==true)fail('derived riichi missing');
 p.riichi=false;close();
 return {input:i,changedSeat:seat,intervention:'remove_opponent_riichi_and_restore_1000_stick',
  limitation:'Coupled public declaration/point change; not a single-factor causal intervention'};
}
function transferPreviousRoundPoints(envelope,opponent){
 const i=structuredClone(envelope.request.input),{b,close}=updating(i);
 if(b.round==='東1局'||b.pendingReach||opponent===b.ownSeat||!Number.isInteger(opponent))
  fail('unsupported prior-round score counterfactual');
 const own=b.ownSeat,loss=3900;
 if(b.scores[own].points-loss<1000)fail('own points would invalidate riichi eligibility');
 b.scores[own].points-=loss;b.scores[opponent].points+=loss;close();
 return {input:i,changedSeat:opponent,intervention:'alternative_earlier_round_3900_point_transfer',
  limitation:'Plausible public prior-round point redistribution only; requires legal original-match replay and S42 recomputation before L3.5 claims'};
}
function packetFromAltered(base,input){
 const request=structuredClone(base.request);
 request.input=input;request.sourcePublicInputHash=hash(input);
 return {request,requestHash:hash(request)};
}
export function prepareV3DevelopmentCounterfactualPairs(source){
 if(!Array.isArray(source)||source.length!==36)fail('expected exactly frozen new36');
 if(!source.every(s=>s.request.stage==='independent'&&hash(s.request)===s.requestHash))
  fail('untrusted public source');
 const candidates=source.filter(s=>s.request.input.id!=='pilot-48'); // one actual model answer seen before registration
 const order=xs=>xs.slice().sort((a,b)=>hash('p2a-v3-pairs-after-first-chatgpt-20261123|'+a.request.input.id).localeCompare(
  hash('p2a-v3-pairs-after-first-chatgpt-20261123|'+b.request.input.id)));
 const reach=order(candidates.filter(s=>{
  const i=s.request.input,b=val(i,'board');
  if(!b?.kyotaku||b.pendingReach)return false;
  return [0,1,2,3].some(seat=>seat!==b.ownSeat&&val(i,'seat-'+seat)?.riichi===true);
 })).slice(0,4);
 if(reach.length!==4)fail('too few paired opponent reach contexts');
 const used=new Set(reach.map(s=>s.request.input.id));
 const score=order(candidates.filter(s=>{
  const i=s.request.input,b=val(i,'board');
  return !used.has(i.id)&&b&&b.round!=='東1局'&&!b.pendingReach&&b.scores[b.ownSeat].points>=6000;
 })).slice(0,4);
 if(score.length!==4)fail('too few paired previous-round score contexts');
 const out=[];
 for(const [kind,list] of [['riichi_escrow',reach],['prior_round_points',score]]){
  for(const s of list){
   const input=s.request.input,board=val(input,'board');
   const seats=[0,1,2,3].filter(q=>q!==board.ownSeat);
   const opp=kind==='riichi_escrow'?seats.find(q=>val(input,'seat-'+q)?.riichi===true):
    seats.slice().sort((a,b)=>Math.abs(board.scores[a].points-board.scores[board.ownSeat].points)-
    Math.abs(board.scores[b].points-board.scores[board.ownSeat].points))[0];
   if(opp===undefined)fail('no public opponent');
   const baseline=createV3IndependentDevelopmentRequest(s),
    alternative=kind==='riichi_escrow'?removeReach(baseline,opp):transferPreviousRoundPoints(baseline,opp),
    changed=packetFromAltered(baseline,alternative.input);
   if(eq(baseline.request.input,changed.request.input)||baseline.requestHash===changed.requestHash)
    fail('counterfactual actually unchanged');
   if(!eq(baseline.request.input.actions,changed.request.input.actions))
    fail('changed legal action mask without proof');
   if(!eq(val(changed.request.input,'visible'),val(baseline.request.input,'visible')))
    fail('visible tile multiplicities changed');
   out.push({sourceCaseId:s.request.input.id,kind,changedSeat:opp,
    baselinePublicInputHash:baseline.request.sourcePublicInputHash,
    alternativePublicInputHash:changed.request.sourcePublicInputHash,
    originalSourceHash:s.requestHash,
    intervention:alternative.intervention,limitation:alternative.limitation,
    baseline,alternative:changed,
    labelStatus:'NO_MORTAL_REPLAY_NO_CHANGE_OR_MAINTAIN_GROUP_ASSIGNED'});
  }
 }
 return {version:PREP_VERSION,sourceFrozenHash:hash(source),createdAfterFirstPilot48Reply:true,
  selectionBasis:'deterministic SHA256 case ID, no Q labels or remaining ChatGPT answers',
  pairCount:out.length,pairs:out,
  status:'PUBLIC_ACCOUNTING_AND_HYPOTHETICAL_RANK_PREPARATION_ONLY',
  notCertified:['physical replay from originating developer paipu','S42 counterfactual ranks',
   'whether Mortal recommendation changed or maintained','GPT reaction sensitivity','strategic factor explanation']};
}
