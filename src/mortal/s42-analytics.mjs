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
export function analyzeDecision(op,chosen,riichi=false){
  if(!op||!Array.isArray(op.qLegal)||op.qLegal.length!==46||!Number.isInteger(op.best))return null;
  const action=actionForDiscard(chosen,riichi);
  if(action==null||typeof op.qLegal[action]!=='number'||!Number.isFinite(op.qLegal[action]))return null;
  const sorted=op.qLegal.map((q,i)=>({index:i,q}))
    .filter(x=>typeof x.q==='number'&&Number.isFinite(x.q)).sort((a,b)=>b.q-a.q||a.index-b.index);
  if(sorted.length<2||sorted[0].index!==op.best)return null;
  const picked=sorted.find(x=>x.index===action);
  if(!picked)return null;
  const gap=Math.max(0,sorted[0].q-picked.q);
  const range=Math.max(1e-9,sorted[0].q-sorted[sorted.length-1].q);
  const relativeGap=Math.max(0,Math.min(1,gap/range));
  const rank=sorted.findIndex(x=>x.index===action)+1;
  // Mortal DQN V4 dueling head: mean of legal Q equals V(s), since action advantages are centered.
  const stateValue=sorted.reduce((sum,x)=>sum+x.q,0)/sorted.length;
  const chosenAdvantage=picked.q-stateValue;
  const bestAdvantage=sorted[0].q-stateValue;
  return {
    action,rank,legal:sorted.length,
    best:op.best,chosenQ:picked.q,bestQ:sorted[0].q,
    stateValue,chosenAdvantage,bestAdvantage,
    gap,relativeGap,
    agreement:action===op.best,
    // Predeclared heuristic threshold, NOT empirically calibrated mahjong mistakes.
    badCandidate:relativeGap>=0.30 && !((op.best===37&&riichi)||(op.best===action)),
    index:Math.round(100*(1-relativeGap)),
    top:sorted.slice(0,6)
  };
}
export function aggregateDecisions(log){
  const judged=(Array.isArray(log)?log:[]).map(x=>x?.s42Review).filter(x=>x&&Number.isFinite(x.index)&&Number.isInteger(x.rank));
  const n=judged.length;
  const agreements=judged.filter(x=>x.agreement).length;
  const suspected=judged.filter(x=>x.badCandidate).length;
  const score=n?Math.round(judged.reduce((t,x)=>t+x.index,0)/n):null;
  return {version:INDEX_VERSION,count:n,agreements,suspected,index:score,
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
