// P2a-v2 verifier-only: riichi on/off packages (riichi declaration + 1000-point
// escrow + recomputed hypothetical rank tables). NOT a single-factor causal
// experiment, a long-term EV oracle, or an opponent hidden-hand inference.
// No reference outputs may enter the independent GPT Stage1 request.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const fail=s=>{throw Error('paired-contrast-v2: '+s);};
const without=(x,fields)=>Object.fromEntries(Object.entries(x).filter(([k])=>!fields.includes(k)));
function evidence(input,id){return input.evidence.find(x=>x.id===id)?.value;}
function cmp(a,b,msg){if(hash(a)!==hash(b))fail(msg);}
function order(es,l){
 if(!Array.isArray(es)||!Array.isArray(l)||es.length!==l.length)fail('mismatched frozen input/lineage');
 const by=new Map();
 for(let n=0;n<l.length;n++){
  const x=l[n],e=es[n];
  if(x.pilotId!==e.request?.input?.id||x.requestHash!==e.requestHash||hash(e.request)!==e.requestHash)fail('lineage and request hash');
  if(x.kind==='contrast'){
   if(!Number.isInteger(x.pair)||!['a','b'].includes(x.version))fail('bad paired lineage');
   const key=x.pair+':'+x.version;
   if(by.has(key))fail('duplicate variant');
   by.set(key,e);
  }
 }
 if(by.size!==8)fail('expected exactly four pair packages');
 return by;
}
function diffRiichiEvent(a,b,seat){
 const ea=evidence(a,'history'),eb=evidence(b,'history');
 if(!Array.isArray(ea)||!Array.isArray(eb)||ea.length!==eb.length)fail('history size');
 let changed=0;
 for(let k=0;k<ea.length;k++){
  const x=ea[k],y=eb[k];
  if(hash(x)===hash(y))continue;
  if(x?.種類!=='打牌'||x.席!==seat||x.立直宣言!==true||
     y.立直宣言!==false||x.牌!==y.牌||x.ツモ切り!==y.ツモ切り||
     hash(without(x,['立直宣言']))!==hash(without(y,['立直宣言'])))fail('not a single public reach event toggle');
  changed++;
 }
 if(changed!==1)fail('expected one declaration event difference');
}
// Independently recompute all public hypothetical settlements from the board,
// instead of permitting arbitrary derived rank-scenarios to change together
// with a deposit toggle. These are counterfactual ledgers, NOT risk/EV labels.
function checkHypotheticalRankEvidence(input){
 const b=evidence(input,'board'),r=evidence(input,'rank-scenarios');
 if(!b||!r||r.status!=='hypothetical_settlements_only'||b.pendingReach)fail('unsupported rank settlement evidence');
 const scores=b.scores.map(x=>x.points),order=b.initialOrder,own=b.ownSeat;
 if(scores.length!==4||order.length!==4||new Set(order).size!==4)fail('invalid score/rank metadata');
 const rank=pts=>pts.map((p,s)=>1+pts.filter((q,t)=>t!==s&&(q>p||q===p&&order.indexOf(t)<order.indexOf(s))).length);
 cmp(r.initialOrder,order,'rank original seat order');
 cmp(r.currentRanks,rank(scores),'current public ranks');
 if(r.ron.length!==15||r.tsumo.length!==12)fail('invalid hypothetical row count');
 const tiers=[[1000,1500],[2000,2900],[3900,5800],[7700,11600],[8000,12000]];
 let k=0;
 for(const other of [0,1,2,3].filter(s=>s!==own)){
  for(const [child,parent] of tiers){
   const w=scores.slice(),l=scores.slice();
   const gain=(own===0?parent:child)+300*b.honba;
   const loss=(other===0?parent:child)+300*b.honba;
   w[own]+=gain+1000*b.kyotaku;w[other]-=gain;
   l[own]-=loss;l[other]+=loss+1000*b.kyotaku;
   const expected={other,winBase:own===0?parent:child,winPoints:w,winRanks:rank(w),
    lossBase:other===0?parent:child,lossPoints:l,lossRanks:rank(l)};
   cmp(r.ron[k++],expected,'invalid ron hypothetical settlement');
  }
 }
 k=0;
 for(const winner of [0,1,2,3]){
  for(const unit of [500,1000,2000]){
   const out=scores.slice();
   for(let seat=0;seat<4;seat++)if(seat!==winner){
    const payment=(winner===0||seat===0?2*unit:unit)+100*b.honba;
    out[seat]-=payment;out[winner]+=payment;
   }
   out[winner]+=1000*b.kyotaku;
   cmp(r.tsumo[k++],{winner,childPay:winner===0?2*unit:unit,
    parentPay:winner===0?null:2*unit,points:out,ranks:rank(out)},'invalid tsumo hypothetical settlement');
  }
 }
}

function checkPackage(a,b){
 const x=a.request.input,y=b.request.input;
 checkHypotheticalRankEvidence(x);checkHypotheticalRankEvidence(y);
 if(x.phase!==y.phase||x.version!==y.version)fail('unmatched phase/version');
 cmp(x.actions,y.actions,'different legal choice mask');
 if(x.evidence.length!==y.evidence.length||x.evidence.some((e,i)=>e.id!==y.evidence[i].id||e.kind!==y.evidence[i].kind))fail('mismatched evidence projection');
 const seats=[0,1,2,3].filter(s=>evidence(x,'seat-'+s)?.riichi===true&&evidence(y,'seat-'+s)?.riichi===false);
 if(seats.length!==1)fail('expected exactly one riichi removal');
 const seat=seats[0],bx=evidence(x,'board'),by=evidence(y,'board'),rx=evidence(x,'seat-'+seat),ry=evidence(y,'seat-'+seat);
 if(bx.kyotaku!==by.kyotaku+1||by.scores[seat].points!==bx.scores[seat].points+1000)fail('1000-point escrow not balanced');
 cmp(without(bx,['kyotaku','scores','rank']),without(by,['kyotaku','scores','rank']),'other public board changes');
 for(let i=0;i<4;i++){
  if(i!==seat&&bx.scores[i].points!==by.scores[i].points)fail('non-reaching seat point movement');
 }
 if(rx.discards.length!==ry.discards.length||rx.discards.filter((d,k)=>d.riichi!==ry.discards[k].riichi).length!==1)fail('reach marker mismatch');
 for(let i=0;i<rx.discards.length;i++){
  const d=rx.discards[i],e=ry.discards[i];
  if(d.riichi!==e.riichi){
   if(d.riichi!==true||e.riichi!==false)fail('reverse reach marker');
   cmp(without(d,['riichi']),without(e,['riichi']),'discard mutation beyond reach marker');
  }else cmp(d,e,'other discard changed');
 }
 cmp(without(rx,['riichi','discards']),without(ry,['riichi','discards']),'opponent public river mutation');
 diffRiichiEvent(x,y,seat);
 for(let s=0;s<4;s++)if(s!==seat)cmp(evidence(x,'seat-'+s),evidence(y,'seat-'+s),'non-target opponent public river changed');
 const allowed=new Set(['board','history','seat-'+seat,'public-value-'+seat,'rank-scenarios']);
 for(const row of x.evidence){
  if(!allowed.has(row.id))cmp(row.value,evidence(y,row.id),'other input evidence changed: '+row.id);
 }
 const ra=evidence(x,'rank-scenarios'),rb=evidence(y,'rank-scenarios');
 if(ra?.status!=='hypothetical_settlements_only'||rb?.status!=='hypothetical_settlements_only')fail('rank scenario missing');
 const pva=evidence(x,'public-value-'+seat),pvb=evidence(y,'public-value-'+seat);
 if(pva?.riichi!==true||pvb?.riichi!==false||
    pva.points!==bx.scores[seat].points||pvb.points!==by.scores[seat].points||
    pva.pointGapFromOwn!==pva.points-bx.scores[bx.ownSeat].points||
    pvb.pointGapFromOwn!==pvb.points-by.scores[by.ownSeat].points)fail('derived seat value inconsistent');
 cmp(without(pva,['riichi','points','pointGapFromOwn']),
    without(pvb,['riichi','points','pointGapFromOwn']),'seat value other changes');
 return {seat,package:'riichi_declaration_plus_1000_point_deposit',
  noUnrelatedPrimaryFactsChanged:true,publicEventToggleCount:1,
  independentInputsAreDifferent:true,canClaimSingleFactor:false,
  tacticalTruth:'not_established_by_this_comparison'};
}
function top(p,i){
 const v=p.variants?.[i];
 if(!v||!Array.isArray(v.q)||v.q.length!==46||!Number.isInteger(v.best)||!Number.isFinite(v.q[v.best]))fail('invalid reference variant');
 if(v.q[v.best]!==Math.max(...v.q.filter(Number.isFinite)))fail('bad reference top');
 return v.best;
}
export function verifyPairedPackages(es,lineage,mortal){
 const by=order(es,lineage);
 if(mortal?.status!=='paired_reference_diagnostic_not_gold_label'||!Array.isArray(mortal.rows)||mortal.rows.length!==4||
    mortal.modelSHA256!=='30381bf21389e2d25d3edf48fed11bf772336ef3daeee67d1bdae7fb9dd30cb4')fail('pinned reference record unavailable');
 const rows=[];
 for(let n=1;n<=4;n++){
  const a=by.get(n+':a'),b=by.get(n+':b');
  if(!a||!b)fail('pair missing');
  const delta=checkPackage(a,b),ref=mortal.rows.find(x=>x.pair===n);
  if(!ref||ref.archiveAnchorMatched!==true)fail('reference anchor not reproduced');
  const first=top(ref,'a'),second=top(ref,'b');
  const agroups=new Set(a.request.input.actions.map(x=>x.group));
  if(!agroups.has(first)||!agroups.has(second))fail('reference not in legal action groups');
  if(Boolean(ref.referenceChange)!==(first!==second))fail('reference change marker mismatch');
  rows.push({pair:n,caseA:a.request.input.id,caseB:b.request.input.id,requestHashA:a.requestHash,
   requestHashB:b.requestHash,...delta,reference:{source:'pinned_Mortal_S42',
    bestA:first,bestB:second,changed:first!==second},
   warning:'Mortal response to a coupled reach-plus-deposit package, not objective Mahjong truth or a controlled single-factor causal effect'});
 }
 return {version:'p2a-v2-paired-reference-verifier-only-1',frozenInputHash:hash(es),
  modelSHA256:mortal.modelSHA256,legalPrimaryPairedPackages:rows.length,
  referenceChanged:rows.filter(r=>r.reference.changed).length,
  referenceMaintained:rows.filter(r=>!r.reference.changed).length,
  rows,certification:'verifier_only_mortal_sensitivity_specificity_not_B3_B4'};
}
export function evaluatePairResponses(es,verified,predicted){
 if(!verified||verified.frozenInputHash!==hash(es)||verified.legalPrimaryPairedPackages!==4||
    verified.rows?.length!==4||!Array.isArray(predicted))fail('bad paired audit inputs');
 const indices=new Map(es.map(e=>[e.request.input.id,e]));
 const preds=new Map();
 for(const p of predicted){
  if(!p||!['string','number'].includes(typeof p.group)||!Number.isInteger(p.group)||
     typeof p.id!=='string'||preds.has(p.id)||!indices.has(p.id))fail('bad or duplicate predicted group');
  if(!indices.get(p.id).request.input.actions.some(a=>a.group===p.group))fail('illegal predicted action group');
  preds.set(p.id,p.group);
 }
 const pairs=verified.rows.map(row=>{
  const a=preds.get(row.caseA),b=preds.get(row.caseB),present=a!==undefined&&b!==undefined;
  return {pair:row.pair,hasBoth:present,referenceChanged:row.reference.changed,
   predictionChanged:present?a!==b:null,
   bothTop:present?a===row.reference.bestA&&b===row.reference.bestB:null,
   referenceResponseMatched:present?(a!==b)===row.reference.changed:null,
   seat:row.seat};
 });
 return {pairs,total:4,complete:pairs.filter(x=>x.hasBoth).length,
  groupExactPair:pairs.filter(x=>x.bothTop).length,
  matchedSensitivity:pairs.filter(x=>x.referenceChanged&&x.referenceResponseMatched).length,
  totalSensitivity:pairs.filter(x=>x.referenceChanged).length,
  matchedSpecificity:pairs.filter(x=>!x.referenceChanged&&x.referenceResponseMatched).length,
  totalSpecificity:pairs.filter(x=>!x.referenceChanged).length,
  missingIncludedInDenominator:true,primaryLabel:'Mortal_focal_response_only',
  strategyCertification:'not_proved',longTermEV:'not_measured'};
}
