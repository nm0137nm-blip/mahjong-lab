// Pilot-only calculation from strictly projected public input. No archived derived facts.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
export function loadEngine(file='index.html'){
 const html=fs.readFileSync(file,'utf8'),start=html.indexOf('(function(root){'),last='})(typeof window!=="undefined"?window:globalThis);',end=html.indexOf(last,start);
 assert(start>=0&&end>start&&html.slice(start,end).includes('@kobalab/majiang-core v1.4.1'));
 const box={console};vm.createContext(box);vm.runInContext(html.slice(start,end+last.length),box);
 return box.MajiangCore;
}
const norm=t=>t[0]+(t[1]==='0'?'5':t[1]);
const TYPES=[...'mps'].flatMap(s=>Array.from({length:9},(_,i)=>s+(i+1))).concat(Array.from({length:7},(_,i)=>'z'+(i+1)));
const mt=m=>[...m.slice(1)].filter(x=>/\d/.test(x)).map(x=>m[0]+x);
const json=x=>JSON.parse(JSON.stringify(x));
const equal=(a,b)=>assert.deepEqual(json(a),json(b));
const sort=x=>Array.from(x).sort();
function tiles(h){
 const out=[];
 for(const t of TYPES){const [s,n]=t;const a=h._bingpai[s],r=n==='5'&&s!=='z'?a[0]:0;out.push(...Array(r).fill(s+'0'),...Array(a[Number(n)]-r).fill(t));}
 return out;
}
const rule=M=>M.rule({'配給原点':25000,'赤牌':{m:1,p:1,s:1},'場数':2,'延長戦方式':0,'オーラス止めあり':true,'オーラス単独トップ止め':true,'トビ終了あり':true,'順位点':['0.0','0.0','0.0','0.0']});
function handFrom(f,M){
 const h=new M.Shoupai(f.hand);
 h._fulou=f.ownMelds.slice();h._lizhi=f.rivers[f.ownSeat].riichi;
 h._zimo=f.drawn??(f.hand.length+3*f.ownMelds.length===14?f.ownMelds.at(-1):null);
 assert.equal(f.hand.length+3*f.ownMelds.length,f.activeSeat===f.ownSeat?14:13);
 equal(sort(tiles(h)),sort(f.hand));
 return h;
}
function doraHan(ts,dora){return ts.reduce((n,t)=>n+Number(t[1]==='0')+dora.filter(d=>d===norm(t)).length,0);}
function metric(h,f,M,visible,dora,redVisible,discard=null){
 const ts=tiles(h),melds=Array.from(h._fulou),all=ts.concat(melds.flatMap(mt));
 assert.equal(ts.length+3*melds.length,13);
 const counts=Object.fromEntries(TYPES.map(t=>[t,0]));for(const t of all)counts[norm(t)]++;
 assert(Math.max(...Object.values(counts))<=4);
 const sh=M.Util.xiangting(h);
 const forms={standard:M.Util.xiangting_yiban(h),sevenPairs:M.Util.xiangting_qidui(h),orphans:M.Util.xiangting_guoshi(h)};
 for(const k in forms)if(!Number.isFinite(forms[k]))forms[k]=null;
 // A virtual fifth same-type tile is never a physical improvement.
 const improving=TYPES.filter(t=>counts[t]<4 && M.Util.xiangting(h.clone().zimo(t))<sh);
 const ambiguous=sh===0&&!improving.length;
 const ownRiver=new Set(f.rivers[f.ownSeat].discards.map(d=>norm(d.tile)));if(discard)ownRiver.add(norm(discard));
 const out={hand:ts,melds,closed:h.menqian,shanten:ambiguous?null:sh,forms:ambiguous?null:forms,physicalShapeWarning:ambiguous?'virtual_completion_not_used':null,improving:improving.map(t=>({tile:t,remainingUpperBound:4-visible[t]})),ukeireUpperBound:improving.reduce((n,t)=>n+4-visible[t],0),retainedDoraHan:doraHan(all,dora),ownRiverFuriten:sh===0&&!ambiguous?improving.some(t=>ownRiver.has(t)):null};
 if(sh===0&&!ambiguous){
  const base={zhuangfeng:'東南西北'.indexOf(f.round[0]),menfeng:f.ownSeat,baopai:f.doraIndicators,rule:rule(M)};
  const param=M.Util.hule_param(base),reach=h.menqian?M.Util.hule_param({...base,lizhi:1}):null;
  const price=v=>v?.defen>0?{basePoints:v.defen,yaku:v.hupai.filter(y=>!['ドラ','赤ドラ','裏ドラ'].includes(y.name)).map(y=>y.name)}:null;
  out.conditionalNormalWins=improving.flatMap(t=>{
   // Only a physically available tile type can be used in a hypothetical score.
   if(visible[t]>=4)return [];
   const variants=t[0]!=='z'&&t[1]==='5'?[...(visible[t]-redVisible[t[0]]<3?[t]:[]),...(redVisible[t[0]]<1?[t[0]+'0']:[])]:[t];
   return variants.map(p=>({tile:p,ron:price(M.Util.hule(h,p+'+',param)),tsumo:price(M.Util.hule(h.clone().zimo(p),null,param)),hypotheticalRiichiRon:reach?price(M.Util.hule(h,p+'+',reach)):null}));
  });
  out.scoreAssumptions='見え枚数上で残り得る通常牌・赤牌別の仮の和了基本点。裏・一発・海底等・本場供託なし。自己河フリテン等のロン可否と別。';
 }
 return out;
}
function rankEvidence(f){
 if(f.pendingReach)return {status:'withheld_pending_riichi'};
 const base=f.scores.map(x=>x.points),own=f.ownSeat;
 const rank=(scores,seat)=>1+scores.filter((v,i)=>i!==seat&&(v>scores[seat]||v===scores[seat]&&f.initialOrder.indexOf(i)<f.initialOrder.indexOf(seat))).length;
 const rows=[];
 for(const other of [0,1,2,3].filter(i=>i!==own)){
  for(const [child,parent] of [[1000,1500],[2000,2900],[3900,5800],[7700,11600],[8000,12000]]){
   const win=base.slice(),lose=base.slice(),gain=(own===0?parent:child)+300*f.honba,loss=(other===0?parent:child)+300*f.honba;
   win[own]+=gain+1000*f.kyotaku;win[other]-=gain;lose[own]-=loss;lose[other]+=loss+1000*f.kyotaku;
   rows.push({other,winBase:own===0?parent:child,winPoints:win,winRanks:win.map((_,i)=>rank(win,i)),lossBase:other===0?parent:child,lossPoints:lose,lossRanks:lose.map((_,i)=>rank(lose,i))});
  }
 }
 const tsumo=[];
 for(const winner of [0,1,2,3]){
  for(const unit of [500,1000,2000]){
   const scores=base.slice();
   for(const i of [0,1,2,3])if(i!==winner){const pay=(winner===0||i===0?2*unit:unit)+100*f.honba;scores[i]-=pay;scores[winner]+=pay;}
   scores[winner]+=1000*f.kyotaku;
   tsumo.push({winner,childPay:winner===0?2*unit:unit,parentPay:winner===0?null:2*unit,points:scores,ranks:scores.map((_,i)=>rank(scores,i))});
  }
 }
 return {status:'hypothetical_settlements_only',initialOrder:f.initialOrder,currentRanks:base.map((_,i)=>rank(base,i)),ron:rows,tsumo,note:'仮の和了・放銃点棒移動。実際の和了可能性・打点や終局・複数和了は推定しない。'};
}
export function enrichPublic(input,f,M){
 const {counts:visible,redVisible}=input.evidence.find(x=>x.id==='visible').value,h=handFrom(f,M),r=rule(M),dora=f.doraIndicators.map(p=>M.Shan.zhenbaopai(p)); 
 const evidence=[{id:'dora',kind:'calculated',value:{actualDora:dora}},{id:'rank-scenarios',kind:'calculated',value:rankEvidence(f)}],actions=[];
 const safety=p=>f.rivers.filter(x=>x.seat!==f.ownSeat).map(x=>({seat:x.seat,ownRiverGenbutsu:x.discards.some(d=>norm(d.tile)===norm(p))}));
 for(const opp of f.rivers.filter(x=>x.seat!==f.ownSeat)){
  const ts=opp.melds.flatMap(mt),wind='z'+('東南西北'.indexOf(f.round[0])+1);
  const yakuhai=opp.melds.reduce((n,m)=>{const a=mt(m).map(norm);return n+(a[0][0]==='z'&&a.every(t=>t===a[0])?Number(Number(a[0][1])>=5)+Number(a[0]===wind)+Number(a[0]==='z'+(opp.seat+1)):0);},0);
  evidence.push({id:'public-value-'+opp.seat,kind:'calculated',value:{exposedDoraHan:doraHan(ts,dora),exposedYakuhaiHan:yakuhai,meldCount:opp.melds.length,riichi:opp.riichi,discardCount:opp.discards.length,recentHandDiscards:opp.discards.filter(d=>!d.tsumogiri).slice(-4).map(d=>d.tile),points:f.scores[opp.seat].points,pointGapFromOwn:f.scores[opp.seat].points-f.scores[f.ownSeat].points}});
 }
 const ds=f.phase==='turn'?Array.from(M.Game.get_dapai(r,h)||[]):[];
 if(f.phase==='turn')equal(sort(ds),sort(input.actions.filter(a=>a.group<37).map(a=>a.detail)));
 const rd=f.phase==='turn'?ds.filter(p=>M.Game.allow_lizhi(r,h,p,f.remaining,f.scores[f.ownSeat].points)):[];
 if(f.phase==='turn')assert.equal(Boolean(rd.length),input.actions.some(a=>a.group===37),'riichi group mismatch');
 const calc=(id,x,p=null)=>({id,kind:'calculated',value:{...metric(x,f,M,visible,dora,redVisible,p),safety:p?safety(p):null}});
 for(const a of input.actions){
  if(a.group===37){
   // Concrete riichi discard is reconstructed uniformly; group-only model comparison remains separate.
   for(const [i,p] of sort(rd).entries()){
    const key='a37-'+i;actions.push({key,group:37,detail:'立直 '+p});
    evidence.push(calc('calc-'+key,h.clone().dapai(p),p));
   }
  }else{
   actions.push(a);
   if(a.group<37)evidence.push(calc('calc-'+a.key,h.clone().dapai(a.detail),a.detail));
   else if(a.group===45)evidence.push(calc('calc-'+a.key,h.clone()));
   else if(a.group>=38&&a.group<=41){
    const after=h.clone().fulou(a.detail),ps=sort(M.Game.get_dapai(r,after)||[]);
    assert(ps.length);const choices=ps.map(p=>({discard:p,...metric(after.clone().dapai(p),f,M,visible,dora,redVisible,p),safety:safety(p)}));
    evidence.push({id:'calc-'+a.key,kind:'calculated',value:{afterCallDiscards:choices}});
   }else if(a.group===42){
    const after=f.phase==='turn'?h.clone().gang(a.detail):h.clone().fulou(a.detail);
    evidence.push(calc('calc-'+a.key,after));
   }else evidence.push({id:'calc-'+a.key,kind:'calculated',value:{status:'terminal_action_no_future_shape'}});
  }
 }
 // Rebuild action records after riichi group expansion; every key has an actual calculation record.
 input.evidence=input.evidence.filter(e=>e.kind!=='legal_choice_record');
 for(const a of actions)input.evidence.push({id:a.key,kind:'legal_choice_record',value:{...a}});
 input.actions=actions;input.evidence.push(...evidence);
 return input;
}
