// P2a-v4 development-only: LLM reasoning text references verifiable source facts
// by an exact token; numbers are rendered solely by deterministic code.
// A good schema cannot certify tactical decision quality: independent blind
// human evaluation remains mandatory. No Mortal label enters this Stage1 view.
import {createHash} from 'node:crypto';
import {verifyV4StrictPublicProof} from './v14-public-proof-gate-v4.mjs';
import {formatV4Settlement} from './v14-settlement-events-v4.mjs';
import {buildV4CandidateSettlementCatalog} from './v14-candidate-settlement-v4.mjs';
const fail=x=>{throw Error('v4-anchored: '+x);};
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const numeric=/[0-9０-９〇零一二三四五六七八九十百千万]/;
const numberLike=txt=>numeric.test(txt);
const allowedSeatFields=new Set(['points','pointGapFromOwn','meldCount','riichi','exposedYakuhaiHan','exposedDoraHan','discardCount']);
const allowedCandidateFields=new Set(['shanten','ukeireUpperBound','retainedDoraHan','ownRiverFuriten']);
export const V4_TACTIC_VERSION='p2a-v4-fact-anchored-tactics-1';
function assertEnvelope(e){
 if(!e||e.request?.stage!=='independent-v3-dev'||!e.request?.input||
    sha(e.request)!==e.requestHash||
    sha(e.request.input)!==e.request.sourcePublicInputHash)
  fail('untrusted immutable public packet');
}
function source(input,id){return input.evidence.find(e=>e.id===id)?.value;}
function labelValue(v){
 if(typeof v==='boolean')return v?'あり':'なし';
 return typeof v==='number'?v.toLocaleString('ja-JP'):String(v);
}
function choiceKind(action){
 return action.group<=36?'打牌':action.group===37?'立直':
  action.group<=41?'副露':action.group===42?'槓':
  action.group===43?'和了':action.group===44?'九種九牌等':
  action.group===45?'見送り':'未対応';
}
export function createV4PublicFactRegistry(envelope,settlementEvents=[]){
 assertEnvelope(envelope);
 const input=envelope.request.input,board=source(input,'board');
 if(!board||!Number.isInteger(board.ownSeat))fail('no public board');
 const registry=Object.create(null);
 const add=(id,v)=>{
  if(Object.hasOwn(registry,id))fail('duplicate fact key');
  registry[id]=v;
 };
 add('board:round','局：'+board.round);
 add('board:ownPoints','自分の現在点数：'+labelValue(board.scores.find(s=>s.seat===board.ownSeat).points)+'点');
 add('board:remaining','残りの牌：'+labelValue(board.remaining)+'枚');
 add('board:honba','本場：'+labelValue(board.honba));
 add('board:kyotaku','既存供託：'+labelValue(board.kyotaku)+'本');
 for(const s of [0,1,2,3].filter(x=>x!==board.ownSeat)){
  const v=source(input,'public-value-'+s);
  if(!v)fail('missing public seat '+s);
  for(const field of allowedSeatFields)if(Object.hasOwn(v,field))
   add('opponent:seat'+s+':'+field,'席'+s+'の'+field+'：'+labelValue(v[field]));
 }
 for(const act of input.actions){
  add('candidate:'+act.key+':kind',act.key+'：'+choiceKind(act)+' '+act.detail);
  const calc=source(input,'calc-'+act.key);
  if(!calc)fail('missing candidate public calculation '+act.key);
  for(const field of allowedCandidateFields)
   if(Object.hasOwn(calc,field))
    add('candidate:'+act.key+':'+field,act.key+'の'+field+'：'+labelValue(calc[field]));
 }
 if(!Array.isArray(settlementEvents)||settlementEvents.length)
  fail('caller-supplied arithmetic event is not source-bound; use derived candidate registry');
 return Object.freeze(registry);
}
// Only factual event IDs that are actually derivable from the recommended and
// alternative concrete candidate's published calc and rank tiers are accepted.
// A fabricated but arithmetically coherent new amount will not enter the view.
export function createV4SourceBoundFactRegistry(envelope,proof){
 assertEnvelope(envelope);
 verifyV4StrictPublicProof(envelope,proof);
 const reg=Object.assign(Object.create(null),createV4PublicFactRegistry(envelope));
 const add=(id,value)=>{
  if(Object.hasOwn(reg,id))fail('duplicate source-bound fact ID');
  reg[id]=value;
 };
 const catalogs=[
  buildV4CandidateSettlementCatalog(envelope,proof.recommendation),
  buildV4CandidateSettlementCatalog(envelope,proof.alternative)
 ];
 for(const cat of catalogs){
  if(cat.choice.afterCallDiscard!==null){
   const action=envelope.request.input.actions.find(a=>a.key===cat.choice.key);
   add('candidate:'+cat.choice.key+':afterCallDiscard',
    '具体的な鳴き：'+action.detail+'、鳴いた後に'+cat.choice.afterCallDiscard+'を切る');
  }
  for(const w of cat.scoredOwnRon){
   add(w.factId,'候補'+cat.choice.key+'の'+w.sourceTile+
    'による'+w.sourceMode+'。指定条件の役：'+w.yaku.join('・')+
    '。'+formatV4Settlement(w.hypotheticalSettlement));
  }
  for(const l of cat.dealInSensitivity){
   add(l.factId,'候補'+cat.choice.key+'の相手打点を仮定した感度例（実際の相手打点ではない）。'+
    formatV4Settlement(l.hypotheticalSettlement));
  }
 }
 return Object.freeze(reg);
}

function anchors(text,registry,label,{needAnchor=true}={}){
 if(typeof text!=='string'||text.trim().length<12||text.length>1900)
  fail(label+' needs bounded text');
 const refs=[];
 const anchorRE=/\[\[([a-zA-Z0-9:_.-]+)\]\]/g;
 const raw=text.replace(anchorRE,(_,id)=>{
  if(!Object.hasOwn(registry,id))fail(label+' unknown fact ID '+id);
  refs.push(id);
  return '';
 });
 if(numberLike(raw))fail(label+' contains unanchored numerical/kanji-number text');
 if(raw.includes('[[')||raw.includes(']]'))fail(label+' contains a malformed reference token');
 if(needAnchor&&refs.length===0)fail(label+' lacks concrete public-fact anchor');
 const rendered=text.replace(anchorRE,(_,id)=>registry[id]);
 return {text:rendered,factIds:refs};
}
export function verifyAndRenderV4AnchoredTactics(envelope,response,settlementEvents=[]){
 if(!Array.isArray(settlementEvents)||settlementEvents.length)
  fail('unverified caller-provided events forbidden; choose public source fact IDs only');
 assertEnvelope(envelope);
 if(!response||response.version!==V4_TACTIC_VERSION||
    response.requestHash!==envelope.requestHash||!response.proof||!response.tactics)
  fail('invalid bound v4 answer');
 const proof=verifyV4StrictPublicProof(envelope,response.proof);
 const own=source(envelope.request.input,'board').ownSeat;
 const others=[0,1,2,3].filter(x=>x!==own);
 const t=response.tactics;
 if(Object.keys(t).sort().join('|')!=='bottomLine|comparison|lesson|opponents|reversal'||
    !Array.isArray(t.opponents)||t.opponents.length!==3)
  fail('missing complete tactical tradeoff and all three opponents');
 const facts=createV4SourceBoundFactRegistry(envelope,response.proof);
 const comparison=anchors(t.comparison,facts,'comparison');
 if(!comparison.factIds.includes('candidate:'+response.proof.recommendation.key+':kind')||
    !comparison.factIds.includes('candidate:'+response.proof.alternative.key+':kind'))
  fail('comparison must cite both legal candidate kinds');
 for(const concrete of [response.proof.recommendation,response.proof.alternative]){
  if(concrete.afterCallDiscard!==null&&
     !comparison.factIds.includes('candidate:'+concrete.key+':afterCallDiscard'))
    fail('call comparison must cite actual legal afterCallDiscard');
 }
 const seen=new Set();
 const opponentSummaries=t.opponents.map(o=>{
  if(!o||!others.includes(o.seat)||seen.has(o.seat)||
     Object.keys(o).sort().join('|')!=='analysis|changeCondition|seat|tradeoff')
    fail('invalid or duplicate opponent rationale');
  seen.add(o.seat);
  const analysis=anchors(o.analysis,facts,'seat'+o.seat+'.analysis');
  if(!analysis.factIds.some(k=>k.startsWith('opponent:seat'+o.seat+':')))
    fail('opponent analysis must cite own seat facts');
  const tradeoff=anchors(o.tradeoff,facts,'seat'+o.seat+'.tradeoff', {needAnchor:false});
  const changeCondition=anchors(o.changeCondition,facts,'seat'+o.seat+'.changeCondition', {needAnchor:false});
  return {seat:o.seat,analysis:analysis.text,tradeoff:tradeoff.text,
   changeCondition:changeCondition.text,publicFactRefs:analysis.factIds};
 });
 if(others.some(x=>!seen.has(x)))fail('not all three opponent seats covered');
 const bottomLine=anchors(t.bottomLine,facts,'bottomLine',{needAnchor:false});
 const reversal=anchors(t.reversal,facts,'reversal',{needAnchor:false});
 const lesson=anchors(t.lesson,facts,'lesson',{needAnchor:false});
 return {
  caseId:envelope.request.input.id,version:V4_TACTIC_VERSION,
  outcome:'typed_facts_verified_qualitative_tactics_unverified',
  sourceBasedPublicProof:proof,
  experimentalModelChoice:{
   recommendedKey:response.proof.recommendation.key,
   recommendedAfterCallDiscard:response.proof.recommendation.afterCallDiscard,
   alternativeKey:response.proof.alternative.key,
   alternativeAfterCallDiscard:response.proof.alternative.afterCallDiscard,
   origin:'model_selected_not_mortal_verified',
   isProductionRecommendation:false
  },
  comparison:comparison.text,opponents:opponentSummaries,
  bottomLine:bottomLine.text,reversal:reversal.text,lesson:lesson.text,
  numericFactsRenderedByCode:true,freeNumericTextBlocked:true,
  policy:'NOT_PRODUCTION_NO_TACTICAL_SKILL_CERTIFICATION'
 };
}
