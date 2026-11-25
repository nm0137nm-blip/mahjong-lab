// Deterministic educational tasks only. No claim about optimal actions, S42 or human probabilities.
// Amounts in points; fixed illustrative distribution in percent. End-of-match hypothetical settlements.
const check=(x,m)=>{if(!x)throw Error(m)};
const pt={tokujou6:[75,30,0,-120],houou7:[90,45,0,-135]};
export function rankOrder(scores,dealer){
 check(Array.isArray(scores)&&scores.length===4&&scores.every(x=>Number.isSafeInteger(x)&&x%100===0)&&scores.reduce((a,b)=>a+b,0)===100000,'invalid scores');
 check(Number.isInteger(dealer)&&dealer>=0&&dealer<4,'invalid dealer');
 return [0,1,2,3].sort((a,b)=>scores[b]-scores[a]||((a-dealer+4)%4)-((b-dealer+4)%4));
}
export function minimumTransfer(scores,dealer,receiver,payer,target){
 check([receiver,payer,target].every(x=>Number.isInteger(x)&&x>=0&&x<4)&&receiver!==payer&&receiver!==target,'invalid seats');
 rankOrder(scores,dealer);
 // Arithmetic question, not a claim that each amount is a legal mahjong hand value.
 for(let amount=0;amount<=100000;amount+=100){
  const next=scores.slice();next[receiver]+=amount;next[payer]-=amount;
  const order=rankOrder(next,dealer);
  if(order.indexOf(receiver)<order.indexOf(target))return amount;
 }
 throw Error('no arithmetic solution');
}
export function expectedPt(distribution,profile){
 check(Object.hasOwn(pt,profile)&&Array.isArray(distribution)&&distribution.length===4&&distribution.every(x=>Number.isInteger(x)&&x>=0&&x<=100)&&distribution.reduce((a,b)=>a+b,0)===100,'invalid distribution');
 return distribution.reduce((a,x,i)=>a+x*pt[profile][i],0)/100;
}
export function breakEvenTopForFourth(profile,second,baseTop,baseSecond,baseThird,baseFourth){
 check(Object.hasOwn(pt,profile)&&Number.isInteger(second)&&second>=0&&second<=100,'invalid second');
 const baseline=expectedPt([baseTop,baseSecond,baseThird,baseFourth],profile);
 // Action X: x% first, fixed second%, 0% third, remainder fourth.
 // Integer percentage points; strictly higher expected pt, not equality.
 for(let x=0;x<=100-second;x++)if(expectedPt([x,second,0,100-second-x],profile)>baseline)return x;
 return null;
}
const bank={
 baseline:[
 ['transfer',[31000,28000,21500,19500],0,3,2,2],
 ['transfer',[31000,28000,21500,19500],3,3,2,2],
 ['transfer',[33500,27200,21100,18200],1,3,0,2],
 ['transfer',[32000,29100,21500,17400],2,2,0,1],
 ['expected','tokujou6',[30,20,30,20]],
 ['expected','houou7',[22,28,30,20]],
 ['compare','tokujou6',[32,20,22,26],[18,24,42,16]],
 ['compare','houou7',[25,25,25,25],[18,30,36,16]],
 ['break','tokujou6',20,20,25,35,20],
 ['break','houou7',30,20,25,35,20],
 ['compare','tokujou6',[30,25,25,20],[25,30,30,15]],
 ['transfer',[36000,25000,20100,18900],1,3,2,2]
 ],
 transfer:[
 ['transfer',[31000,26600,22200,20200],3,3,2,2],
 ['transfer',[34400,26200,21200,18200],0,3,2,2],
 ['transfer',[35000,26900,20800,17300],2,3,0,2],
 ['transfer',[33000,28000,22000,17000],1,2,0,1],
 ['expected','tokujou6',[24,32,29,15]],
 ['expected','houou7',[35,15,30,20]],
 ['compare','tokujou6',[35,15,20,30],[15,35,35,15]],
 ['compare','houou7',[33,17,20,30],[20,20,45,15]],
 ['break','tokujou6',25,25,20,40,15],
 ['break','houou7',15,30,20,30,20],
 ['compare','houou7',[33,22,20,25],[23,32,27,18]],
 ['transfer',[33700,26900,20000,19400],3,3,2,2]
 ]};
function compile(raw,id){
 const [kind,...args]=raw;
 if(kind==='transfer'){
  const [scores,dealer,receiver,payer,target]=args;
  return {id,kind,unit:'点',prompt:'終局確定後の算術問題。4人の点棒 '+scores.join(' / ')+'、起家ID '+dealer+'。ID '+payer+' から ID '+receiver+' に100点刻みで移すとき、受取人が ID '+target+' を順位で上回る最小額は？ 同点は起家順。実際の合法和了点や終局条件は問わない。',answer:minimumTransfer(...args)};
 }
 if(kind==='expected'){
  const [p,d]=args;return {id,kind,unit:'pt',prompt:p+' 東南戦。仮定の1～4着確率（%） '+d.join(' / ')+'。固定段位pt '+pt[p].join(' / ')+' の平均は？',answer:expectedPt(d,p)};
 }
 if(kind==='compare'){
  const [p,a,b]=args;return {id,kind,unit:'pt',prompt:p+' 東南戦。仮定の1～4着確率（%）A '+a.join(' / ')+'、B '+b.join(' / ')+'。固定段位pt '+pt[p].join(' / ')+'。期待段位ptの差 A−B は？',answer:expectedPt(a,p)-expectedPt(b,p)};
 }
 const [p,second,...d]=args;
 return {id,kind,unit:'%',prompt:p+' 東南戦。Bの仮定の1～4着確率（%） '+d.join(' / ')+'。Aは2着 '+second+'%、3着0%、1着x%、残り4着。固定段位pt '+pt[p].join(' / ')+'。AがBより厳密に上回る最小整数xは？',answer:breakEvenTopForFourth(...args)};
}
export function trainingSet(group){
 check(Object.hasOwn(bank,group),'unknown exercise group');
 return bank[group].map((r,i)=>compile(r,group+'-'+(i+1)));
}
export function createTrainingSession(group){
 const tasks=trainingSet(group),responses=new Map();
 return Object.freeze({
  questions:()=>tasks.map(({answer,...q})=>({...q})),
  submit(id,value,confidence,elapsedMs,reason){
   check(!responses.has(id),'already submitted');
   const t=tasks.find(x=>x.id===id);
   check(t&&typeof value==='number'&&Number.isFinite(value)&&Number.isInteger(confidence)&&confidence>=1&&confidence<=5&&Number.isFinite(elapsedMs)&&elapsedMs>=0&&typeof reason==='string'&&reason.length<=1000,'invalid submission');
   const result={id,kind:t.kind,value,confidence,elapsedMs,reason,correct:Math.abs(value-t.answer)<1e-8,answer:t.answer};
   responses.set(id,result);return {...result};
  },
  summary:()=>({group,answered:responses.size,total:tasks.length,correct:[...responses.values()].filter(x=>x.correct).length,complete:responses.size===tasks.length,scope:'deterministic calculation only; not mahjong strategy or human learning effectiveness',responses:[...responses.values()].map(x=>({...x}))})
 });
}
