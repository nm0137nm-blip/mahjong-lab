// South 4 FIRST start only. No action effect, no hidden information, no implicit pooling.
const check=(v,m)=>{if(!v)throw Error(m)};
const exact=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===k.slice().sort().join('|');
const ranks=[1,2,3,4],dims={all:['all'],dealer:['parent','child'],gap:['0–3900','4000–8000','8100+']};
export function classifyAllLastStart(s){
 check(exact(s,['wind','hand','firstStart','scores','initialDealer','dealer','ownId','sticks']),'invalid public snapshot');
 check(s.wind===1&&s.hand===3&&s.firstStart===true,'not first South 4');
 check(Array.isArray(s.scores)&&s.scores.length===4&&s.scores.every(v=>Number.isSafeInteger(v)&&v>=0&&v%100===0),'invalid scores');
 check([s.initialDealer,s.dealer,s.ownId].every(v=>Number.isInteger(v)&&v>=0&&v<4)&&s.dealer===(s.initialDealer+3)%4,'invalid seats');
 check(Number.isSafeInteger(s.sticks)&&s.sticks>=0&&s.scores.reduce((a,b)=>a+b,0)+1000*s.sticks===100000,'score conservation');
 const order=[0,1,2,3].sort((a,b)=>s.scores[b]-s.scores[a]||((a-s.initialDealer+4)%4)-((b-s.initialDealer+4)%4));
 const rank=order.indexOf(s.ownId)+1,near=[2,1,4,3][rank-1];
 const gap=Math.abs(s.scores[s.ownId]-s.scores[order[near-1]]);
 return Object.freeze({rank,near,gap,role:s.ownId===s.dealer?'parent':'child',gapBand:gap<=3900?'0–3900':gap<=8000?'4000–8000':'8100+'});
}
export function makeAllLastQuery(data){
 check(data?.schema==='l1-v5-south4-initial-rank-v1'&&data.matches===970&&data.bootstrap===2000&&data.reached_s4===710&&data.not_reached===260&&data.observations===2840,'wrong aggregate version');
 check(Array.isArray(data.cells)&&data.cells.length===24,'wrong aggregate cells');
 const idx=new Map(),key=(r,d,l)=>[r,d,l].join('|');
 for(const c of data.cells){
  check(ranks.includes(c.start_rank)&&dims[c.dimension]?.includes(c.level),'invalid cell');
  const k=key(c.start_rank,c.dimension,c.level);check(!idx.has(k),'duplicate cell');
  check(Number.isSafeInteger(c.n)&&c.n>0&&c.n<=710&&c.n===c.hands&&c.n===c.matches,'bad denominator');
  check(Array.isArray(c.metrics)&&c.metrics.length===4,'invalid ranks');
  const metrics=c.metrics.map((m,i)=>{
   check(m.final_rank===i+1&&Number.isSafeInteger(m.count)&&m.count>=0&&m.count<=c.n,'bad outcome count');
   check(Number.isFinite(m.pct)&&Math.abs(m.pct-100*m.count/c.n)<=0.0000051,'bad proportion');
   check(Array.isArray(m.ci95)&&m.ci95.length===2&&m.ci95.every(v=>Number.isFinite(v)&&v>=0&&v<=100)&&m.ci95[0]<=m.ci95[1],'bad CI');
   check(typeof m.supported==='boolean','bad support flag');
   const supported=m.supported&&c.n>=200&&m.count>=10&&c.n-m.count>=10&&m.ci95[1]-m.ci95[0]<=10;
   return Object.freeze(supported?{rank:i+1,status:'supported',pct:m.pct,ci95:Object.freeze([...m.ci95])}:{rank:i+1,status:'insufficient_support'});
  });
  check(c.metrics.reduce((n,m)=>n+m.count,0)===c.n,'rank total mismatch');
  idx.set(k,{n:c.n,metrics:Object.freeze(metrics),counts:c.metrics.map(m=>m.count)});
 }
 for(const r of ranks){
  const total=idx.get(key(r,'all','all'));check(total?.n===710,'all rank denominator');
  for(const d of ['dealer','gap']){
   const cells=dims[d].map(l=>idx.get(key(r,d,l)));check(cells.every(Boolean)&&cells.reduce((a,c)=>a+c.n,0)===total.n,'partition denominator');
   for(let i=0;i<4;i++)check(cells.reduce((a,c)=>a+c.counts[i],0)===total.counts[i],'partition rank mismatch');
  }
 }
 return function query(snapshot,dimension,mode,timing){
  check(['coach','self','assessment'].includes(mode)&&['during','after'].includes(timing),'invalid timing');
  if(mode==='assessment'&&timing==='during')return {status:'disabled_during_assessment'};
  check(Object.hasOwn(dims,dimension),'unknown dimension');
  const f=classifyAllLastStart(snapshot),level=dimension==='all'?'all':dimension==='dealer'?f.role:f.gapBand,c=idx.get(key(f.rank,dimension,level));
  return {status:'descriptive_only',filter:f,dimension,level,n:c.n,metrics:c.metrics,scope:'S42 selfplay 710 first-South4 matches of 970 development matches',causal:false,humanValidated:false};
 };
}
