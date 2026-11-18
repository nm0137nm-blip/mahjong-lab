/*
 * Mahjong LAB S42 evaluation analytics.
 * Rating follows the core mjai-reviewer computation (not a skill rating):
 *   100 * (sum_i(r_i) / n) ** 2,
 *   r_i = 1 if chosen action == Mortal output, otherwise
 *   (Q(chosen)-min_legal_Q) / max(1e-6, max_legal_Q-min_legal_Q).
 * Only decisions with two or more comparable legal actions contribute.
 * Original reviewer also has special kan action expansion and aka-equivalent
 * action matching that our 46-action observation bridge cannot always mirror.
 * Historical in-house index records stay separate from this official-style
 * rating. Nothing is sent outside the browser.
 */
export const INDEX_VERSION = 'S42-relative-Q-v1'; // historical records only
export const RATING_VERSION = 'S42-mjai-reviewer-rating-v1';
export const BAD_MOVE_VERSION = 'S42-softmax-0.1-under5-v1';
export const SOFTMAX_TEMPERATURE = 0.1;
export const BAD_MOVE_THRESHOLD = 0.05;
const HONORS=['E','S','W','N','P','F','C'];
export function actionForDiscard(tile,riichi=false){
  if(riichi)return 37;
  if(typeof tile!=='string'||tile.length<2)return null;
  const suit=tile[0],num=tile[1];
  if(suit==='z'){
    const n=Number(num);
    return n>=1&&n<=7?27+n-1:null;
  }
  const offset={m:0,p:9,s:18}[suit];
  if(offset==null)return null;
  if(num==='0')return ({m:34,p:35,s:36})[suit];
  const n=Number(num);
  return n>=1&&n<=9?offset+n-1:null;
}
export function actionForCall(meld){
  if(typeof meld!=='string'||!/^[mpsz]/.test(meld))return null;
  const digits=[...meld.slice(1).matchAll(/([0-9])([+\-=]?)/g)].map(m=>({num:Number(m[1])||5,called:!!m[2]}));
  const claimed=digits.filter(x=>x.called);
  if(claimed.length!==1||digits.length<3||digits.length>4)return null;
  if(digits.length===4)return 42; // daiminkan
  if(digits.every(x=>x.num===digits[0].num))return 41; // pon
  if(digits.length===3&&meld[0]!=='z'){
    const nums=digits.map(x=>x.num).sort((x,y)=>x-y);
    if(nums[2]-nums[0]!==2||new Set(nums).size!==3)return null;
    // chi_low/mid/high describe the position of the claimed tile.
    return 38+nums.indexOf(claimed[0].num);
  }
  return null;
}
export function analyzeAction(op,action){
  if(!op||!Array.isArray(op.qLegal)||op.qLegal.length!==46||!Number.isInteger(op.best))return null;
  if(!Number.isInteger(action)||action<0||action>=46||
     typeof op.qLegal[action]!=='number'||!Number.isFinite(op.qLegal[action]))return null;
  const sorted=op.qLegal.map((q,i)=>({index:i,q}))
    .filter(x=>typeof x.q==='number'&&Number.isFinite(x.q)).sort((a,b)=>b.q-a.q||a.index-b.index);
  if(sorted.length<2||sorted[0].index!==op.best)return null;
  const picked=sorted.find(x=>x.index===action);
  if(!picked)return null;
  // Match the Mortal mjai-reviewer recommendation calculation (tau=0.1).
  // Only legal Q values participate. Subtract max Q for numerical stability.
  const weights=sorted.map(x=>Math.exp((x.q-sorted[0].q)/SOFTMAX_TEMPERATURE));
  const weightSum=weights.reduce((sum,w)=>sum+w,0);
  if(!Number.isFinite(weightSum)||weightSum<=0)return null;
  const ranked=sorted.map((x,i)=>({...x,recommendation:weights[i]/weightSum}));
  const recommendation=ranked.find(x=>x.index===action).recommendation;
  const gap=Math.max(0,sorted[0].q-picked.q);
  const range=Math.max(1e-9,sorted[0].q-sorted[sorted.length-1].q);
  const relativeGap=Math.max(0,Math.min(1,gap/range));
  // Exact reviewer rule: matching chosen action earns 1.0 regardless of Q.
  // Otherwise normalize against worst and best *legal* Q, with a 1e-6 floor.
  const minQ=sorted[sorted.length-1].q;
  const ratingContribution=action===op.best?1:
    (picked.q-minQ)/Math.max(1e-6,sorted[0].q-minQ);
  const rank=sorted.findIndex(x=>x.index===action)+1;
  const stateValue=sorted.reduce((sum,x)=>sum+x.q,0)/sorted.length;
  return {
    action,rank,legal:sorted.length,best:op.best,chosenQ:picked.q,bestQ:sorted[0].q,
    stateValue,chosenAdvantage:picked.q-stateValue,bestAdvantage:sorted[0].q-stateValue,
    gap,relativeGap,agreement:action===op.best,
    recommendation,badMove:recommendation<BAD_MOVE_THRESHOLD,
    ratingContribution,top:ranked.slice(0,6)
  };
}
export function riichiComparison(op,chosenAction){
  if(!op||!Array.isArray(op.qLegal)||!Number.isFinite(op.qLegal[37]))return null;
  const noReach=op.qLegal.slice(0,37).filter(x=>typeof x==='number'&&Number.isFinite(x));
  if(!noReach.length)return null;
  const reachQ=op.qLegal[37],noReachQ=Math.max(...noReach);
  return {recommended:reachQ>=noReachQ?'リーチ':'リーチせず打牌',
    chosen:chosenAction===37?'リーチ':'リーチせず打牌',
    reachQ,noReachQ,gap:Math.abs(reachQ-noReachQ)};
}
export function analyzeDecision(op,chosen,riichi=false){
  return analyzeAction(op,actionForDiscard(chosen,riichi));
}
export function aggregateDecisions(log){
  const entries=Array.isArray(log)?log:[];
  const judged=entries.map(x=>x?.s42Review)
    .filter(x=>x&&Number.isFinite(x.ratingContribution)&&
      x.ratingContribution>=0&&x.ratingContribution<=1&&Number.isInteger(x.rank));
  const n=judged.length;
  const agreements=judged.filter(x=>x.agreement).length;
  // Do NOT round individual contributions or square them individually.
  const ratingRawSum=judged.reduce((t,x)=>t+x.ratingContribution,0);
  const rating=n?100*Math.pow(ratingRawSum/n,2):null;
  // Bad-move rate remains a separate softmax <5% *discard-only* metric.
  const discards=entries.filter(x=>x?.type==='discard');
  const evaluatedDiscards=discards.filter(x=>
    x.s42Review&&Number.isFinite(x.s42Review.recommendation)&&
    x.s42Review.recommendation>=0&&x.s42Review.recommendation<=1);
  const badReviewed=evaluatedDiscards.length;
  const badCount=evaluatedDiscards.filter(x=>x.s42Review.recommendation<BAD_MOVE_THRESHOLD).length;
  return {version:RATING_VERSION,ratingVersion:RATING_VERSION,
    count:n,ratingCount:n,ratingRawSum,rating,agreements,
    callCount:entries.filter(x=>x?.type==='call'&&x?.s42Review?.ratingContribution!=null).length,
    riichiCount:entries.filter(x=>x?.riichiAvailable&&x?.s42Review?.ratingContribution!=null).length,
    agreementRate:n?agreements/n:null,
    badRateVersion:BAD_MOVE_VERSION,discardCount:discards.length,
    badReviewed,badCount,badMoveRate:badReviewed?badCount/badReviewed:null};
}
export function combineAggregates(all){
  const a=(Array.isArray(all)?all:[]).filter(x=>
    x&&(x.version===INDEX_VERSION||x.version===RATING_VERSION)&&
    Number.isInteger(x.count)&&x.count>0&&
    Number.isInteger(x.agreements)&&x.agreements>=0&&x.agreements<=x.count);
  const count=a.reduce((t,x)=>t+x.count,0);
  // A historical average of rounded, unsquared per-decision scores is NOT
  // sufficient to reconstruct Mortal rating. Never relabel or square it.
  const rated=a.filter(x=>x.ratingVersion===RATING_VERSION&&
    x.version===RATING_VERSION&&x.ratingCount===x.count&&
    Number.isFinite(x.ratingRawSum)&&x.ratingRawSum>=0&&
    x.ratingRawSum<=x.ratingCount+1e-8);
  const ratingCount=rated.reduce((t,x)=>t+x.ratingCount,0);
  const ratingRawSum=rated.reduce((t,x)=>t+x.ratingRawSum,0);
  const rating=ratingCount?100*Math.pow(ratingRawSum/ratingCount,2):null;
  // Under-5% statistics can include a historical entry only when its policy
  // version was already the same. Never blend with 30% gap records.
  const current=a.filter(x=>x.badRateVersion===BAD_MOVE_VERSION&&
    Number.isInteger(x.badReviewed)&&x.badReviewed>=0&&
    Number.isInteger(x.badCount)&&x.badCount>=0&&x.badCount<=x.badReviewed);
  const badReviewed=current.reduce((t,x)=>t+x.badReviewed,0);
  const badCount=current.reduce((t,x)=>t+x.badCount,0);
  const badMoveRate=badReviewed?badCount/badReviewed:null;
  return {count,ratingCount,ratingRawSum,rating,
    agreementRate:count?a.reduce((t,x)=>t+x.agreements,0)/count:null,
    badReviewed,badCount,badMoveRate};
}
export const RATING_TEXT=v=>v==null?'—':Number(v).toFixed(1)+'/100';
export const PERCENT=v=>v==null?'—':(100*v).toFixed(1)+'%';
