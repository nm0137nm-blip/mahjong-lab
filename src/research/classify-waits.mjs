// Independent exhaustive structural decomposition; tile indices 0–8 m, 9–17 p, 18–26 s, 27–33 z. Input fixed meld counts must be independently validated; not a yaku/ron/physical availability or strategic classifier.
export function classifyStructuralWaits(concealed, meldCounts = Array(34).fill(0), meldCount = 0) {
  const require = (v,m) => { if(!v) throw Error(m); };
  const validCounts = a => Array.isArray(a) && a.length===34 && a.every(x=>Number.isInteger(x)&&x>=0&&x<=4);
  const sum = a => a.reduce((x,y)=>x+y,0);
  require(validCounts(concealed)&&validCounts(meldCounts),"34-tile counts required");
  require(Number.isInteger(meldCount)&&meldCount>=0&&meldCount<=4,"meld count");
  require(sum(concealed)===13-3*meldCount,"concealed tile count");
  require(sum(meldCounts)>=3*meldCount&&sum(meldCounts)<=4*meldCount,"fixed meld tile count");
  require(concealed.every((n,i)=>n+meldCounts[i]<=4),"physical tile overflow");
  const needed=4-meldCount, terminal=new Set([0,8,9,17,18,26,27,28,29,30,31,32,33]);
  const out=[];
  for(let t=0;t<34;t++){
    if(concealed[t]+meldCounts[t]>=4)continue;
    const a=concealed.slice();a[t]++;
    const types=new Set();
    function record(groups,pair){
      if(pair===t)types.add("tanki");
      for(const g of groups){
        if(g.kind==="triplet"&&g.start===t)types.add("shanpon");
        if(g.kind==="sequence"&&t>=g.start&&t<=g.start+2){
          const pos=t-g.start,rank=g.start%9+1;
          if(pos===1)types.add("kanchan");
          else if((pos===0&&rank===7)||(pos===2&&rank===1))types.add("penchan");
          else types.add("ryanmen");
        }
      }
    }
    function visit(groups,pair){
      const i=a.findIndex(n=>n>0);
      if(i<0){if(groups.length===needed&&pair!==null)record(groups,pair);return;}
      if(pair===null&&a[i]>=2){a[i]-=2;visit(groups,i);a[i]+=2;}
      if(groups.length===needed)return;
      if(a[i]>=3){a[i]-=3;visit([...groups,{kind:"triplet",start:i}],pair);a[i]+=3;}
      if(i<27&&i%9<=6&&a[i+1]>0&&a[i+2]>0){a[i]--;a[i+1]--;a[i+2]--;visit([...groups,{kind:"sequence",start:i}],pair);a[i]++;a[i+1]++;a[i+2]++;}
    }
    visit([],null);
    if(meldCount===0){
      if(a.filter(n=>n===2).length===7&&a.every(n=>n===0||n===2))types.add("chiitoitsu");
      if(a.every((n,i)=>terminal.has(i)?n>=1&&n<=2:n===0)&&[...terminal].filter(i=>a[i]===2).length===1)types.add("kokushi");
    }
    if(types.size)out.push({tile:t,types:[...types].sort()});
  }
  return {waits:out,anyRyanmen:out.some(x=>x.types.includes("ryanmen")),everyWaitRyanmen:out.length>0&&out.every(x=>x.types.includes("ryanmen")),ryanmenOnly:out.length>0&&out.every(x=>x.types.length===1&&x.types[0]==="ryanmen")};
}
