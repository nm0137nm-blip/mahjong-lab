// Restricted development diagnostic. Actual bundled engine, standard CPU only.
// This is not B4 certification and not a posterior or a real-game forecast.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {pathToFileURL} from 'node:url';
const html=fs.readFileSync('index.html','utf8');
const start=html.indexOf('(function(root){'),last='})(typeof window!=="undefined"?window:globalThis);',end=html.indexOf(last,start);
assert(start>=0&&end>start&&html.slice(start,end).includes('@kobalab/majiang-core v1.4.1'));
const sandbox={console};vm.createContext(sandbox);vm.runInContext(html.slice(start,end+last.length),sandbox);
const M=sandbox.MajiangCore,AI=sandbox.MajiangAI;assert(M?.Game&&AI);
const json=x=>JSON.parse(JSON.stringify(x)),sort=x=>Array.from(x).sort(),same=(a,b)=>assert.deepEqual(json(a),json(b));
const tiles=h=>[...h.toString().split(',')[0].matchAll(/([mpsz])([0-9]+)/g)].flatMap(m=>[...m[2]].map(t=>m[1]+t));
const rule=()=>M.rule({'配給原点':25000,'赤牌':{m:1,p:1,s:1},'場数':2,'延長戦方式':0,'オーラス止めあり':true,'オーラス単独トップ止め':true,'トビ終了あり':true,'順位点':['0.0','0.0','0.0','0.0']});
// Deliberately simple alternative continuation policies; all use only each player's Board.
const nrm=p=>p.slice(0,2).replace('0','5');
class Attack extends AI {
 select_dapai(){
  const h=this.shoupai,ps=this.get_dapai(h)||[];
  const rows=ps.map(p=>{const a=h.clone().dapai(p),sh=M.Util.xiangting(a);return {p,sh,u:(M.Util.tingpai(a)||[]).length};}).sort((a,b)=>a.sh-b.sh||b.u-a.u||Number(a.p[1]==='0')-Number(b.p[1]==='0')||a.p.localeCompare(b.p));
  const p=rows[0]?.p;if(!p)throw Error('attack no discard');return p+(this.select_lizhi(p)?'*':'');
 }
}
class Defense extends AI {
 select_dapai(){
  const h=this.shoupai,b=this.model,threats=[0,1,2,3].filter(i=>i!==this._menfeng&&b.shoupai[i].lizhi);
  if(!threats.length)return super.select_dapai();
  const ps=(this.get_dapai(h)||[]).map(p=>({p,safe:threats.filter(i=>b.he[i]._pai.some(t=>nrm(t)===nrm(p))).length,sh:M.Util.xiangting(h.clone().dapai(p))})).sort((a,b)=>b.safe-a.safe||a.sh-b.sh||a.p.localeCompare(b.p));
  if(!ps.length)throw Error('defense no discard');return ps[0].p;
 }
}
export function simulate(row,trajectory,action,policy='standard'){
 const s=row.scene,own=s.ownSeat,r=rule(),players=Array.from({length:4},(_,i)=>i===s.initialOrder[own]||policy==='standard'?new AI():policy==='attack'?new Attack():policy==='defense'?new Defense():null);
 assert(players.every(Boolean));
 const g=new M.Game(players,()=>{},r,'v14 internal rollout');
 const b=g.model;g._sync=true;let done=false;g.last=()=>{done=true};
 g.kaiju(0);b.zhuangfeng='東南西北'.indexOf(s.round[0]);b.jushu=Number(s.round[1])-1;b.changbang=s.honba;
 const playerIds=Array.from({length:4},(_,i)=>(b.jushu+i)%4);
 same(Array.from({length:4},(_,i)=>playerIds.indexOf(i)),s.initialOrder);
 b.lizhibang=s.kyotaku-s.rivers.filter(v=>v.riichi).length;assert(b.lizhibang>=0);
 b.defen=Array(4).fill(0);for(let i=0;i<4;i++)b.defen[playerIds[i]]=s.scores[i].points+1000*Number(s.rivers[i].riichi);
 const shan=new M.Shan(r),dead=trajectory.dead.slice();dead.splice(4,0,s.dora[0]);
 shan._pai=[...dead,...trajectory.wall.slice().reverse(),...trajectory.draws.slice().reverse(),...trajectory.initial.flat().reverse()];
 assert.equal(shan._pai.length,136);shan._baopai=[shan._pai[4]];shan._fubaopai=r['裏ドラあり']?[shan._pai[9]]:null;
 shan._weikaigang=false;shan._closed=false;g.qipai(shan);g.reply_qipai();
 // Replay observed actions with all intervening reaction responses set to pass.
 // The engine still updates actual per-seat Board and temporal furiten.
 let drawIdx=0;
 for(const e of s.publicEvents){
  if(e.種類==='自摸'){
   assert.equal(g._status,'zimo');assert.equal(b.lunban,e.席);assert.equal(b.shoupai[e.席]._zimo,trajectory.draws[drawIdx++]);
  }else{
   assert.equal(g._status,'zimo');assert.equal(b.lunban,e.席);
   const p=e.牌+(e.ツモ切り?'_':'');assert(g.get_dapai().includes(p),'history discard illegal');
   if(e.立直宣言)assert(g.allow_lizhi(p),'history riichi illegal');
   g._reply=Array.from({length:4},()=>({}));g._reply[b.player_id[e.席]]={dapai:p+(e.立直宣言?'*':'')};g.reply_zimo();
   assert.equal(g._status,'dapai');assert.equal(g._dapai,p+(e.立直宣言?'*':''));
   g._reply=Array.from({length:4},()=>({}));g.reply_dapai();assert(!done&&g._status==='zimo','history terminated before target');
  }
 }
 assert.equal(drawIdx,trajectory.draws.length);assert.equal(b.lunban,own);assert.equal(g._status,'zimo');assert.equal(b.shan.paishu,s.remaining);assert.equal(b.lizhibang,s.kyotaku);
 same(b.player_id.map(i=>b.defen[i]),s.scores.map(x=>x.points));same(b.shan.baopai,s.dora);
 for(let i=0;i<4;i++){
  same(sort(tiles(b.shoupai[i])),sort(trajectory.current[i]));assert.equal(Boolean(b.shoupai[i].lizhi),s.rivers[i].riichi);
  same(b.he[i]._pai,s.rivers[i].discards.map(d=>d.tile+(d.tsumogiri?'_':'')+(d.riichi?'*':'')));
 }
 same(sort(tiles(b.shoupai[own])),sort(s.hand));assert.equal(b.shoupai[own]._zimo,s.drawn);
 const archive=sort(row.actions.filter(a=>a.action<37).flatMap(a=>a.details));same(sort(g.get_dapai()),archive);
 const actualGroups=[...new Set([...(g.get_dapai()||[]).map(p=>{const s='mpsz'.indexOf(p[0]),n=Number(p[1]);return n===0?34+s:s===3?26+n:9*s+n-1;}),...(g.allow_lizhi()? [37]:[]),...((g.get_gang_mianzi()||[]).length?[42]:[]),...(g.allow_hule()?[43]:[]),...(g.allow_pingju()?[44]:[])])].sort((a,b)=>a-b);
 same(actualGroups,row.actions.map(a=>a.action).sort((a,b)=>a-b));
 if(action===null)return {legalGroups:actualGroups,legalDiscards:archive};
 const original=b.defen[b.player_id[own]];assert(g.get_dapai().includes(action));
 g._reply[b.player_id[own]]={dapai:action};
 let steps=0;
 while(!done){
  if(++steps>350)throw Error('continuation step limit');
  assert.equal(g._reply.filter(x=>x).length,4,'missing CPU response');
  const status=g._status;
  if(status==='zimo'||status==='gangzimo'){
   const a=g.get_reply(b.lunban);
   if(a.dapai){const p=a.dapai.replace(/\*$/,'');assert(g.get_dapai().includes(p),'CPU illegal discard');if(a.dapai.endsWith('*'))assert(g.allow_lizhi(p),'CPU illegal reach');}
   else if(a.hule)assert(g.allow_hule(),'CPU illegal tsumo');
   else if(a.gang)assert(g.get_gang_mianzi().includes(a.gang),'CPU illegal kan');
   else if(a.daopai)assert(g.allow_pingju(),'CPU illegal abort');
   else throw Error('CPU missing turn action');
   g.reply_zimo();
  }else if(status==='dapai'||status==='gang'){
   for(let i=0;i<4;i++){
    if(i===b.lunban)continue;const a=g.get_reply(i);
    if(a.hule)assert(g.allow_hule(i),'CPU illegal ron');
    if(a.fulou){assert.equal(status,'dapai');assert([...g.get_chi_mianzi(i),...g.get_peng_mianzi(i),...g.get_gang_mianzi(i)].includes(a.fulou),'CPU illegal call');}
   }
   status==='dapai'?g.reply_dapai():g.reply_gang();
  }else if(status==='fulou'){
   const a=g.get_reply(b.lunban);if(g.get_dapai()?.length)assert(g.get_dapai().includes(a.dapai),'CPU illegal after-call discard');g.reply_fulou();
  }else if(status==='hule')g.reply_hule();
  else if(status==='pingju')g.reply_pingju();
  else throw Error('unexpected status '+status);
 }
 const logs=g._paipu.log[0],wins=logs.filter(x=>x.hule).map(x=>x.hule);
 assert(wins.length||logs.some(x=>x.pingju),'no terminal settlement');
 const net=b.defen[b.player_id[own]]-original;assert(Number.isFinite(net));
 return {net,win:wins.some(w=>w.l===own),dealIn:wins.some(w=>w.baojia===own),steps};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
const rows=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),cases=[],failures=[];
const began=performance.now();
for(const row of rows){
 const choices=row.actions.filter(a=>a.action<37).map(a=>a.details[0]);assert(choices.length>=2);
 const pair=[choices[0],choices.at(-1)]; // deterministic public-only pair; not a tactical decision.
 const results=[];
 for(const [n,sample] of row.samples.entries()){
  try{const a=simulate(row,sample,pair[0]),b=simulate(row,sample,pair[1]);results.push({a,b});}
  catch(e){failures.push({shard:row.shard,decision:row.decision,sample:n,error:String(e).slice(0,300)});}
 }
 const delta=results.map(r=>r.a.net-r.b.net),mean=delta.length?delta.reduce((a,b)=>a+b,0)/delta.length:null;
 cases.push({shard:row.shard,decision:row.decision,candidates:pair,planned:row.samples.length,completed:results.length,meanPairedNetDifference:mean,raw:results});
}
const out={status:'restricted_engine_rollout_probe_not_B4',cases:cases.length,plannedPairs:cases.reduce((n,c)=>n+c.planned,0),completedPairs:cases.reduce((n,c)=>n+c.completed,0),elapsedSeconds:(performance.now()-began)/1000,failures,results:cases,limitations:['standard CPU continuation only','no-call starting histories only; future calls allowed by engine','constructive samples are not a calibrated conditional distribution','candidate selection is arbitrary public-only for cost/legality check','no model comparison or tactical label']};
fs.writeFileSync(process.argv[3],JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({...out,results:cases.map(({raw,...rest})=>rest)},null,2));
assert.equal(out.completedPairs,out.plannedPairs);

}
