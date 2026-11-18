/*
 * Mahjong LAB S42 evaluation analytics.
 * The 0-100 "learning index" is a TRANSPARENT IN-HOUSE measure,
 * not a Tenhou/Mahjong Soul rating or calibrated outcome value.
 * S42 Q values cannot be decomposed into shanten/danger/final score.
 * Everything stays in browser memory / local storage; no remote requests.
 */
export const INDEX_VERSION = 'S42-relative-Q-v1';
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
  const gap=Math.max(0,sorted[0].q-picked.q);
  const range=Math.max(1e-9,sorted[0].q-sorted[sorted.length-1].q);
  const relativeGap=Math.max(0,Math.min(1,gap/range));
  const rank=sorted.findIndex(x=>x.index===action)+1;
  const stateValue=sorted.reduce((sum,x)=>sum+x.q,0)/sorted.length;
  return {
    action,rank,legal:sorted.length,best:op.best,chosenQ:picked.q,bestQ:sorted[0].q,
    stateValue,chosenAdvantage:picked.q-stateValue,bestAdvantage:sorted[0].q-stateValue,
    gap,relativeGap,agreement:action===op.best,
    badCandidate:relativeGap>=0.30&&op.best!==action,
    index:Math.round(100*(1-relativeGap)),top:sorted.slice(0,6)
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
  const judged=(Array.isArray(log)?log:[]).map(x=>x?.s42Review).filter(x=>x&&Number.isFinite(x.index)&&Number.isInteger(x.rank));
  const n=judged.length;
  const agreements=judged.filter(x=>x.agreement).length;
  const suspected=judged.filter(x=>x.badCandidate).length;
  const score=n?Math.round(judged.reduce((t,x)=>t+x.index,0)/n):null;
  return {version:INDEX_VERSION,count:n,agreements,suspected,index:score,\n    callCount:(Array.isArray(log)?log:[]).filter(x=>x?.type==='call'&&x?.s42Review).length,\n    riichiCount:(Array.isArray(log)?log:[]).filter(x=>x?.riichiAvailable&&x?.s42Review).length,
    agreementRate:n?agreements/n:null,badCandidateRate:n?suspected/n:null};
}
export function combineAggregates(all){
  const a=(Array.isArray(all)?all:[]).filter(x=>x&&x.version===INDEX_VERSION&&x.count>0&&x.index!=null);
  const count=a.reduce((t,x)=>t+x.count,0);
  if(!count)return {count:0,index:null,agreementRate:null,badCandidateRate:null};
  const index=Math.round(a.reduce((t,x)=>t+x.count*x.index,0)/count);
  return {count,index,
    agreementRate:a.reduce((t,x)=>t+x.agreements,0)/count,
    badCandidateRate:a.reduce((t,x)=>t+x.suspected,0)/count};
}
export const PERCENT=v=>v==null?'—':(100*v).toFixed(1)+'%';
