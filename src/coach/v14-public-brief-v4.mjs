// Development-only, publicly deterministic LLM briefing, no S42 teacher.
import {createHash} from 'node:crypto';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const fail=x=>{throw Error('v4-public-brief: '+x);};
const get=(i,id)=>i.evidence.find(e=>e.id===id)?.value;
const rank=(a,b)=>(a.shanten??99)-(b.shanten??99)||
  (b.ukeireUpperBound??-1)-(a.ukeireUpperBound??-1)||
  (b.retainedDoraHan??-1)-(a.retainedDoraHan??-1)||
  a.key.localeCompare(b.key);
const tile=detail=>String(detail).match(/(?:[mps][0-9]|z[1-7])_?/)?.[0]||null;
export const BRIEF_V4='p2a-v4-compact-public-brief-1';
export function createV4PublicBrief(envelope){
 if(!envelope||envelope.request?.stage!=='independent-v3-dev'||
   hash(envelope.request)!==envelope.requestHash||
   hash(envelope.request.input)!==envelope.request.sourcePublicInputHash)
  fail('untrusted public packet');
 const i=envelope.request.input,b=get(i,'board'),own=get(i,'own');
 if(!b||!own||!Array.isArray(own.hand)||!Array.isArray(i.actions))fail('missing board or legal actions');
 const all=i.actions.map(a=>{
  const c=get(i,'calc-'+a.key);
  if(!c)fail('uncalculated legal action: '+a.key);
  return {key:a.key,group:a.group,detail:a.detail,
   shanten:Number.isFinite(c.shanten)?c.shanten:null,
   ukeireUpperBound:Number.isFinite(c.ukeireUpperBound)?c.ukeireUpperBound:null,
   retainedDoraHan:Number.isFinite(c.retainedDoraHan)?c.retainedDoraHan:null};
 }).sort(rank);
 const chosen=[],pick=a=>{if(a&&!chosen.some(v=>v.key===a.key)&&chosen.length<4)chosen.push(a);};
 let selectionRule='public_shape_only';
 const reach=all.filter(a=>a.group===37),win=all.filter(a=>a.group===43);
 const pass=all.filter(a=>a.group===45),call=all.filter(a=>a.group>=38&&a.group<=41);
 if(win.length&&pass.length){pick(win[0]);pick(pass[0]);selectionRule='win_and_pass_first';}
 else if(reach.length){
  pick(reach[0]);pick(all.find(a=>a.group<=36&&tile(a.detail)===tile(reach[0].detail)));
  selectionRule='strongest_public_reach_and_same_tile_silent';
 }else if(call.length&&pass.length){
  pick(call[0]);pick(pass[0]);selectionRule='call_and_pass_first';
 }
 all.forEach(pick);
 const opponents=[0,1,2,3].filter(seat=>seat!==b.ownSeat).map(seat=>{
  const s=get(i,'seat-'+seat),v=get(i,'public-value-'+seat);
  if(!s||!v)fail('missing public opponent');
  return {seat,riichi:s.riichi,melds:s.melds,discards:s.discards,
   publicValues:{points:v.points,pointGapFromOwn:v.pointGapFromOwn,
   meldCount:v.meldCount,exposedYakuhaiHan:v.exposedYakuhaiHan,
   exposedDoraHan:v.exposedDoraHan,discardCount:v.discardCount}};
 });
 const details=chosen.map(a=>{
  const c=get(i,'calc-'+a.key);
  return {key:a.key,group:a.group,detail:a.detail,
   shanten:c.shanten??null,ukeireUpperBound:c.ukeireUpperBound??null,
   improving:c.improving||[],retainedDoraHan:c.retainedDoraHan??null,
   ownRiverFuriten:c.ownRiverFuriten??null,
   conditionalNormalWins:c.conditionalNormalWins||[],
   safety:c.safety||[],physicalShapeWarning:c.physicalShapeWarning??null};
 });
 const brief={version:BRIEF_V4,caseId:i.id,
  originalPublicHash:envelope.request.sourcePublicInputHash,
  selectionRule,selectionUsesMortal:false,selectionUsesModelAnswers:false,
  board:{round:b.round,remaining:b.remaining,honba:b.honba,kyotaku:b.kyotaku,
   ownSeat:b.ownSeat,scores:b.scores,initialOrder:b.initialOrder},
  own:{hand:own.hand,drawn:own.drawn,melds:own.melds,doraIndicators:own.doraIndicators,
   reaction:own.reaction},
  opponents,allLegalActions:all,detailedCandidates:details,
  dealerSeat:'UNVERIFIED_PUBLIC_BOARD_DO_NOT_GUESS',
  derivedSettlements:'NOT_PRESENT_UNTIL_DEALER_SOURCE_AUDIT',
  unknown:['opponent private hands','future tiles','true pWin and pDealIn',
  'Mortal teacher choices and Q values','actual user move'],
  note:'These are public source facts, not a model recommendation or expected value.'};
 const bytes=Buffer.byteLength(JSON.stringify(brief),'utf8');
 if(bytes>20000)fail('byte bound exceeded '+bytes);
 return {brief,bytes,fullLegalCount:all.length,detailedCount:details.length};
}
