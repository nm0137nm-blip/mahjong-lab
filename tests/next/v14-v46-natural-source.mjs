// Natural development-only source acquisition, no S42, API, labels or private opponent hands.
// Use the exact bundled Majiang core/standard CPU, deterministic seeded wall RNG.
// Capture from the focal player's REDACTED event stream, never Game.model.
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {nextPublicEvents} from '../../src/coach/phoenix-coach.mjs';
import {actionForDiscard,actionForCall} from '../../src/mortal/s42-analytics.mjs';
import {independentRequest} from '../../src/coach/v14-pilot-boundary.mjs';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const fail=x=>{throw Error('v46-natural-source: '+x);};
const salt='mahjong-lab-p2a-v46-new-natural-development-20261124-v1';
export const SEEDS=Object.freeze(Array.from({length:16},(_,i)=>({
 shard:i+1,seed:createHash('sha256').update(salt+'|'+(i+1)).digest().readUInt32LE(0)||1
})));
if(new Set(SEEDS.map(x=>x.seed)).size!==SEEDS.length)fail('seed collision');
export function verifySeedDisjoint(manifests){
 const used=new Set();
 function walk(x,k=''){
  if(Array.isArray(x)){if(/seeds/i.test(k))for(const v of x)if(Number.isInteger(v))used.add(v);
   for(const v of x)walk(v,k);
  }else if(x&&typeof x==='object')for(const [key,v] of Object.entries(x))walk(v,key);
  else if(Number.isInteger(x)&&/^(?:seed|wallSeed)$/i.test(k))used.add(x);
 }
 for(const m of manifests)walk(m);
 if(used.size<96||SEEDS.some(x=>used.has(x.seed)))fail('historical seed overlap or insufficient audited manifests');
 return {priorSeeds:used.size,priorSeedSetHash:hash([...used].sort((a,b)=>a-b)),newSeeds:SEEDS};
}
function load(seed,htmlPath='index.html'){
 const html=fs.readFileSync(htmlPath,'utf8'),start=html.indexOf('(function(root){'),
 last='})(typeof window!=="undefined"?window:globalThis);',end=html.indexOf(last,start);
 if(start<0||end<start)fail('engine bundle missing');
 const bundle=html.slice(start,end+last.length);
 if(!bundle.includes('@kobalab/majiang-core v1.4.1')||!bundle.includes('@kobalab/majiang-ai v1.3.0'))fail('engine version');
 const box={console};vm.createContext(box);
 vm.runInContext('let rng='+seed+'; Math.random=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;};',box);
 vm.runInContext(bundle,box);
 return {M:box.MajiangCore,AI:box.MajiangAI,bundleHash:createHash('sha256').update(bundle).digest('hex')};
}
function tiles(h){
 const out=[];
 for(const suit of 'mpsz'){
  const a=h._bingpai[suit];
  for(let n=1;n<a.length;n++){
   if(suit!=='z'&&n===5){for(let j=0;j<a[0];j++)out.push(suit+'0');for(let j=0;j<a[5]-a[0];j++)out.push(suit+'5');}
   else for(let j=0;j<a[n];j++)out.push(suit+n);
  }
 }
 return out;
}
function project(player,events){
 const b=player.model,o=player._menfeng,h=player.shoupai;
 return JSON.parse(JSON.stringify({
  snapshotVersion:2,round:'東南西北'[b.zhuangfeng]+(b.jushu+1)+'局',mode:'半荘',ownSeat:o,honba:b.changbang,kyotaku:b.lizhibang,
  hand:tiles(h),drawn:h._zimo?.length===2?h._zimo:null,selfMelds:h._fulou.slice(),dora:b.shan.baopai.slice(),
  rivers:b.he.map((river,l)=>({riichi:!!b.shoupai[l].lizhi,discards:river._pai.map(p=>({tile:p.slice(0,2),tsumogiri:p.includes('_'),riichi:p.includes('*'),called:/[+=-]$/.test(p)})),melds:b.shoupai[l]._fulou.slice()})),
  scores:b.player_id.map(id=>({points:Number(b.defen[id])})),remaining:b.shan.paishu,ownDiscards:b.he[o]._pai.length,activeSeat:b.lunban,
  initialOrder:Array.from({length:4},(_,i)=>b.player_id.indexOf((b.qijia+i)%4)),pendingReach:!!b._lizhi,publicEvents:events
 }));
}
function grouped(items){
 const map=new Map();
 for(const [action,detail] of items){
  if(!Number.isInteger(action)||action<0||action>45||typeof detail!=='string')fail('invalid engine action');
  if(!map.has(action))map.set(action,new Set());map.get(action).add(detail);
 }
 return [...map.entries()].sort((a,b)=>a[0]-b[0]).map(([action,details])=>({action,details:[...details].sort()}));
}
export function collectNatural(entry){
 const {M,AI,bundleHash}=load(entry.seed),rows=[];
 class Focal extends AI{
  constructor(){super();this.events=[];this.serial=0;}
  action(msg,callback){
   if(msg.qipai){if(msg.qipai.shoupai.filter(x=>typeof x==='string'&&x.length).length!==1)fail('opponent hand leak');}
   const draw=msg.zimo||msg.gangzimo;
   if(draw&&draw.l!==this._menfeng&&draw.p!=='')fail('opponent draw leak');
   this.events=nextPublicEvents(this.events,msg);
   return super.action(msg,callback);
  }
  record(phase,actions,reaction){
   const scene=project(this,this.events);
   // No pending riichi transaction; clean and auditable point conservation.
   if(scene.pendingReach||scene.scores.reduce((s,x)=>s+x.points,0)+1000*scene.kyotaku!==100000)return;
   const groups=actions.map(a=>a.action);
   const group=phase==='reaction'&&groups.includes(45)&&groups.some(i=>i>=38&&i<=41)&&!groups.includes(43)&&!groups.includes(42)?'reaction':
    phase==='turn'&&groups.includes(37)&&groups.some(i=>i<37)&&!groups.includes(43)&&!groups.includes(44)?'reach':
    phase==='turn'&&groups.filter(i=>i<37).length>=2&&!groups.some(i=>i>=37)?'discard':null;
   if(!group)return;
   if(scene.remaining<4||scene.remaining>60||scene.round==='東1局'||scene.scores.some(x=>x.points<0))return;
   const raw={id:'case-'+(++this.serial),phase,scene,actions};
   if(reaction)raw.reaction=reaction;
   rows.push({group,raw});
  }
  captureTurn(gangzimo=false,afterCall=false){
   const h=this.shoupai,ds=Array.from(this.get_dapai(h)||[]);
   const a=ds.map(p=>[actionForDiscard(p),p]);
   if(!afterCall){
    if(ds.some(p=>this.allow_lizhi(h,p)))a.push([37,'立直']);
    for(const m of this.get_gang_mianzi(h)||[])a.push([42,m]);
    if(this.allow_hule(h,null,!!gangzimo))a.push([43,'ツモ']);
    if(this.allow_pingju(h))a.push([44,'九種九牌']);
   }
   this.record('turn',grouped(a));
  }
  action_zimo(z,g){if(z.l===this._menfeng)this.captureTurn(g);return super.action_zimo(z,g);}
  action_fulou(f){if(f.l===this._menfeng&&!/^[mpsz]\\d{4}/.test(f.m))this.captureTurn(false,true);return super.action_fulou(f);}
  action_dapai(d){
   if(d.l!==this._menfeng){
    const h=this.shoupai,t=d.p.slice(0,2)+['','+','=','-'][(4+d.l-this._menfeng)%4];
    const a=[...this.get_chi_mianzi(h,t)||[],...this.get_peng_mianzi(h,t)||[],...this.get_gang_mianzi(h,t)||[]].map(m=>[actionForCall(m),m]);
    if(this.allow_hule(h,t))a.push([43,'ロン']);a.push([45,'スルー']);
    if(a.length>1)this.record('reaction',grouped(a),{from:d.l,tile:d.p});
   }
   return super.action_dapai(d);
  }
 }
 const focal=new Focal(),rule=M.rule({'配給原点':25000,'赤牌':{m:1,p:1,s:1},'場数':2,'延長戦方式':0,'オーラス止めあり':true,'オーラス単独トップ止め':true,'トビ終了あり':true,'順位点':['0.0','0.0','0.0','0.0']});
 let complete=false;
 new M.Game([focal,new AI(),new AI(),new AI()],()=>{complete=true;},rule,'v46 natural development').do_sync();
 if(!complete||!rows.length)fail('match incomplete');
 // Fixed public-only ordering. Retain up to four valid public source packets per stratum.
 const accepted=[],rejects=[];
 for(const group of ['reach','reaction','discard']){
  const ranked=rows.filter(x=>x.group===group).sort((a,b)=>hash([salt,entry.shard,a.raw.id,a.raw.scene.round,a.raw.scene.remaining]).localeCompare(hash([salt,entry.shard,b.raw.id,b.raw.scene.round,b.raw.scene.remaining])));
  let n=0;
  for(const x of ranked){
   try{
    const packet=independentRequest(x.raw,'pilot-90',M);
    accepted.push({group,decisionId:x.raw.id,publicHash:hash(x.raw),packet});
    if(++n===4)break;
   }catch(e){rejects.push({group,decisionId:x.raw.id,reason:String(e).slice(0,200)});}
  }
 }
 if(!accepted.length)fail('no legal accepted public sources');
 return {version:'v46-natural-source-public-1',entry,bundleHash,counts:Object.fromEntries(['reach','reaction','discard'].map(g=>[g,rows.filter(x=>x.group===g).length])),accepted,rejects,privateHandsRead:false,modelCalls:0};
}
if(process.argv[1]?.endsWith('v14-v46-natural-source.mjs')){
 const [mode,...args]=process.argv.slice(2);
 if(mode==='seeds'){const files=args.map(p=>JSON.parse(fs.readFileSync(p,'utf8')));console.log(JSON.stringify(verifySeedDisjoint(files)));}
 else if(mode==='collect'){
  const entry=SEEDS.find(x=>x.shard===Number(args[0]));if(!entry)fail('shard');
  const data=collectNatural(entry);fs.writeFileSync(args[1],JSON.stringify(data,null,2)+'\n');
  console.log(JSON.stringify({shard:entry.shard,counts:data.counts,accepted:data.accepted.length,rejected:data.rejects.length}));
 }else fail('mode');
}
