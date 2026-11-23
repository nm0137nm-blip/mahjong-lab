// P2a-v3: development-only, public-fact contrast verifier.
// Repairs v2's numeric-distinct-only failure: riichi/dama, win/pass,
// call/pass and opponent-scoped genbutsu can be contrasted without fabricating
// shanten/ukeire differences. It does NOT prove the recommended choice.
import {createHash} from 'node:crypto';
export const PROOF_VERSION_V3='p2a-v3-public-contrast-proof-2';
const sha=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const fail=s=>{throw Error('v3-proof: '+s);};
const exact=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===k.slice().sort().join('|');
const relation=(a,b)=>a<b?'lower':a>b?'higher':'same';
const comparable=(a,b)=>a===b?'same':'different';
const nums=new Set(['shanten','ukeireUpperBound','retainedDoraHan']);
const seatFields=new Set(['riichi','meldCount','exposedDoraHan','exposedYakuhaiHan','discardCount','points','pointGapFromOwn']);
const winModes=new Set(['ron','tsumo','hypotheticalRiichiRon']);
const boundText=x=>typeof x==='string'&&x.trim().length>=8&&x.length<=3000;
const get=(i,id)=>i.evidence.find(x=>x.id===id)?.value;
const norm=t=>t[0]+(t[1]==='0'?'5':t[1]);
const actionKind=g=>g<=36?'discard':g===37?'riichi':g<=41?'call':g===42?'kan':g===43?'win':g===44?'abort':g===45?'pass':null;
function resolveChoice(i,choice){
 if(!exact(choice,['key','afterCallDiscard'])||typeof choice.key!=='string')fail('invalid choice descriptor');
 const a=i.actions.find(x=>x.key===choice.key),c=get(i,'calc-'+choice.key);
 if(!a||!c||!actionKind(a.group))fail('illegal or uncalculated candidate');
 if(Array.isArray(c.afterCallDiscards)){
  if(typeof choice.afterCallDiscard!=='string')fail('call needs concrete after-call discard');
  const rows=c.afterCallDiscards.filter(x=>x.discard===choice.afterCallDiscard);
  if(rows.length!==1)fail('invalid or ambiguous call after-discard');
  return {a,value:rows[0],tile:choice.afterCallDiscard};
 }
 if(choice.afterCallDiscard!==null)fail('unexpected call after-discard');
 const match=a.detail?.match(/(?:[mps][0-9]|z[1-7])(?:_)?/);
 return {a,value:c,tile:a.group<=37?match?.[0]??null:null};
}
function seatValue(i,x,seat){
 const board=get(i,'board'),riv=get(i,'seat-'+seat)?.discards;
 if(!Number.isInteger(seat)||seat<0||seat>3||seat===board?.ownSeat||!Array.isArray(riv))
  fail('invalid public opponent seat');
 if(!Array.isArray(x.value.safety))fail('genbutsu safety not available for action');
 const entry=x.value.safety.filter(v=>v.seat===seat);
 if(entry.length!==1||typeof entry[0].ownRiverGenbutsu!=='boolean'||!x.tile)
  fail('target seat or concrete discard missing');
 const tile=x.tile.match(/[mps][0-9]|z[1-7]/)?.[0];
 if(!tile)fail('unavailable concrete discarded tile');
 const actual=riv.some(d=>typeof d.tile==='string'&&norm(d.tile)===norm(tile));
 if(actual!==entry[0].ownRiverGenbutsu)fail('safety flag contradicts public river');
 return actual;
}
function conditionalPoint(x,tile,mode){
 const xs=x.value.conditionalNormalWins;
 if(!Array.isArray(xs))return {status:'not_supplied'};
 const options=xs.filter(y=>y.tile===tile);
 if(options.length!==1)return {status:'not_supplied'};
 const v=options[0][mode];
 if(!v)return {status:'no_scored_win_under_assumptions'};
 if(!Number.isSafeInteger(v.basePoints)||v.basePoints<=0||!Array.isArray(v.yaku))fail('invalid source conditional score');
 return {status:'conditionally_scored',basePoints:v.basePoints,yaku:[...v.yaku]};
}
function publicClaim(i,left,right,c){
 if(!c||typeof c!=='object'||Array.isArray(c))fail('invalid factual claim');
 if(c.type==='actionKind'){
  if(!exact(c,['type','recommended','alternative','relation']))fail('action-kind keys');
  const a=actionKind(left.a.group),b=actionKind(right.a.group);
  if(c.recommended!==a||c.alternative!==b||c.relation!==comparable(a,b))fail('false action-kind comparison');
  return a!==b;
 }
 if(c.type==='shape'){
  if(!exact(c,['type','metric','recommended','alternative','relation'])||!nums.has(c.metric))fail('shape claim keys');
  const a=left.value[c.metric],b=right.value[c.metric];
  if(typeof a!=='number'||!Number.isFinite(a)||typeof b!=='number'||!Number.isFinite(b))
   fail('shape values absent or undefined for this candidate');
  if(c.recommended!==a||c.alternative!==b||c.relation!==relation(a,b))fail('false shape comparison');
  return a!==b;
 }
 if(c.type==='furiten'){
  if(!exact(c,['type','recommended','alternative','relation']))fail('furiten keys');
  const a=left.value.ownRiverFuriten,b=right.value.ownRiverFuriten;
  if(typeof a!=='boolean'||typeof b!=='boolean')fail('furiten status not verified');
  if(c.recommended!==a||c.alternative!==b||c.relation!==comparable(a,b))fail('false furiten comparison');
  return a!==b;
 }
 if(c.type==='seatGenbutsu'){
  if(!exact(c,['type','seat','recommended','alternative','relation']))fail('genbutsu keys');
  const a=seatValue(i,left,c.seat),b=seatValue(i,right,c.seat);
  if(c.recommended!==a||c.alternative!==b||c.relation!==comparable(a,b))fail('false opponent genbutsu comparison');
  return a!==b;
 }
 if(c.type==='conditionalPoints'){
  if(!exact(c,['type','tile','mode','recommended','alternative','relation'])||
     typeof c.tile!=='string'||!/^[mps][0-9]$|^z[1-7]$/.test(c.tile)||!winModes.has(c.mode))
   fail('conditional point claim keys');
  if((left.a.group===37||right.a.group===37)&&c.mode!=='tsumo')
   fail('riichi/dama must use action-specific conditionalRonByChoice, not same-mode ron');
  const a=conditionalPoint(left,c.tile,c.mode),b=conditionalPoint(right,c.tile,c.mode);
  if(sha(c.recommended)!==sha(a)||sha(c.alternative)!==sha(b)||
     c.relation!==comparable(sha(a),sha(b)))fail('false conditional score or yaku claim');
  return sha(a)!==sha(b);
 }
 if(c.type==='conditionalRonByChoice'){
  if(!exact(c,['type','tile','recommendedMode','alternativeMode','recommended','alternative','relation'])||
     typeof c.tile!=='string'||!/^(?:[mps][0-9]|z[1-7])$/.test(c.tile))fail('conditional by-action ron claim keys');
  // Riichi on this discard and dama on this discard score under DIFFERENT yaku assumptions.
  // No cheating by using a riichi-scored figure for a silent action.
  const modeA=left.a.group===37?'hypotheticalRiichiRon':'ron';
  const modeB=right.a.group===37?'hypotheticalRiichiRon':'ron';
  if(c.recommendedMode!==modeA||c.alternativeMode!==modeB)
    fail('wrong action-specific scoring mode; no hypothetical riichi on dama');
  const a=conditionalPoint(left,c.tile,modeA),b=conditionalPoint(right,c.tile,modeB);
  if(sha(c.recommended)!==sha(a)||sha(c.alternative)!==sha(b)||
     c.relation!==comparable(sha(a),sha(b)))
    fail('falsified action-specific conditional ron score/yaku or relation');
  return sha(a)!==sha(b);
 }
 if(c.type==='rankScenario'){
  if(!exact(c,['type','ronIndex','opponent','ownWinRank','ownDealInRank','winPointChange','dealInPointChange']))
   fail('rank scenario claim keys');
  const board=get(i,'board'),rows=get(i,'rank-scenarios');
  const r=rows?.ron?.[c.ronIndex],own=board?.ownSeat;
  if(rows?.status!=='hypothetical_settlements_only'||!Number.isInteger(c.ronIndex)||!r||
     r.other!==c.opponent||r.other===own||c.ownWinRank!==r.winRanks[own]||
     c.ownDealInRank!==r.lossRanks[own]||
     c.winPointChange!==r.winPoints[own]-board.scores[own].points||
     c.dealInPointChange!==r.lossPoints[own]-board.scores[own].points)
   fail('false rank scenario projection');
  return false; // common hypothetical outcome, NEVER candidate-specific evidence
 }
 fail('unknown proof type or unapproved inference');
}
export function verifyV3PublicContrast(envelope,proof){
 if(!exact(envelope,['request','requestHash'])||
    !['independent','independent-v3-dev'].includes(envelope.request?.stage)||
    sha(envelope.request)!==envelope.requestHash||!envelope.request.input)
   fail('untrusted public case');
 if(!exact(proof,['version','requestHash','recommendation','alternative','comparisons','opponentObservations','reversal','explanation'])||
    proof.version!==PROOF_VERSION_V3||proof.requestHash!==envelope.requestHash)fail('unbound proof');
 const i=envelope.request.input,left=resolveChoice(i,proof.recommendation),right=resolveChoice(i,proof.alternative);
 if(proof.recommendation.key===proof.alternative.key&&
    proof.recommendation.afterCallDiscard===proof.alternative.afterCallDiscard)
   fail('identical concrete choices');
 if(!Array.isArray(proof.comparisons)||proof.comparisons.length<1||proof.comparisons.length>15)fail('no bounded factual comparisons');
 let distinct=0,settlements=0;
 const kinds=new Set();
 for(const c of proof.comparisons){
  const key=c.type==='seatGenbutsu'?c.type+':'+c.seat:
    c.type==='shape'?c.type+':'+c.metric:
    c.type==='conditionalPoints'?c.type+':'+c.mode+':'+c.tile:
    c.type==='conditionalRonByChoice'?c.type+':'+c.tile:
    c.type==='rankScenario'?c.type+':'+c.ronIndex:c.type;
  if(kinds.has(key))fail('repeated fact citation');kinds.add(key);
  if(publicClaim(i,left,right,c))distinct++;
  if(c.type==='rankScenario')settlements++;
 }
 if(!Array.isArray(proof.opponentObservations)||proof.opponentObservations.length<1||
    proof.opponentObservations.length>9)fail('missing opponent observations');
 const seen=new Set(),seatAssessments=new Map(),own=get(i,'board')?.ownSeat;
 for(const o of proof.opponentObservations){
  if(!exact(o,['seat','field','value','assessment'])||!Number.isInteger(o.seat)||
     o.seat<0||o.seat>3||o.seat===own||seen.has(o.seat+':'+o.field)||
     !seatFields.has(o.field)||!['potentially_relevant','not_established'].includes(o.assessment))
   fail('invalid opponent observation');
  if(seatAssessments.has(o.seat)&&seatAssessments.get(o.seat)!==o.assessment)
   fail('opponent seat importance must remain consistent across observed fields');
  seen.add(o.seat+':'+o.field);seatAssessments.set(o.seat,o.assessment);
  const actual=get(i,'public-value-'+o.seat);
  if(!actual||!Object.hasOwn(actual,o.field)||sha(o.value)!==sha(actual[o.field]))
   fail('mismatched public opponent fact');
 }
 if(!exact(proof.reversal,['unknownFactors','ifThen'])||!Array.isArray(proof.reversal.unknownFactors)||
    proof.reversal.unknownFactors.length<1||proof.reversal.unknownFactors.length>6||
    !proof.reversal.unknownFactors.every(x=>typeof x==='string'&&/^[a-zA-Z][a-zA-Z0-9_]{1,40}$/.test(x))||
    new Set(proof.reversal.unknownFactors).size!==proof.reversal.unknownFactors.length||
    !boundText(proof.reversal.ifThen)||!boundText(proof.explanation))
   fail('invalid uncertainty disclosure');
 return {requestHash:envelope.requestHash,candidateFactsVerified:proof.comparisons.length,
  opponentFactsVerified:seen.size,opponentsObserved:seatAssessments.size,meaningfullyDistinctPublicFacts:distinct,
  publicSettlementContextFacts:settlements,
  factualGate:'pass',contrastStatus:distinct?'public_difference_verified':'no_distinguishing_public_fact_established',
  tacticChoice:'not_certified',textualCausality:'not_certified',probability:'not_calibrated',
  limits:'Terminals and unavailable conditional points are NOT estimated; source public records only',
  phase:'v3_development_only'};
}
export function createV3PublicContrastFixture(envelope,choiceA,choiceB){
 const i=envelope.request.input,b=get(i,'board'),a=resolveChoice(i,choiceA),bb=resolveChoice(i,choiceB);
 const cm=[];
 const kindA=actionKind(a.a.group),kindB=actionKind(bb.a.group);
 cm.push({type:'actionKind',recommended:kindA,alternative:kindB,relation:comparable(kindA,kindB)});
 for(const m of nums){
  if(Number.isFinite(a.value[m])&&Number.isFinite(bb.value[m])){
   cm.push({type:'shape',metric:m,recommended:a.value[m],alternative:bb.value[m],
    relation:relation(a.value[m],bb.value[m])});
  }
 }
 const seat=[0,1,2,3].find(s=>s!==b.ownSeat&&get(i,'public-value-'+s));
 if(seat===undefined)fail('missing public seats');
 const source=get(i,'public-value-'+seat),proof={version:PROOF_VERSION_V3,
  requestHash:envelope.requestHash,recommendation:choiceA,alternative:choiceB,
  comparisons:cm,opponentObservations:[{seat,field:'riichi',value:source.riichi,assessment:'not_established'}],
  reversal:{unknownFactors:['pWin','pDealIn'],
   ifThen:'放銃・和了の確率が不明なため候補の確定計算だけでは最善の打牌を証明できない。'},
  explanation:'これは公開事実に関する機械的な正常例であり、強い麻雀判断を実行した証拠にはならない。'};
 verifyV3PublicContrast(envelope,proof);
 return proof;
}
