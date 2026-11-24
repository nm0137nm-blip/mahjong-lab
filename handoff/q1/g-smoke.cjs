// Q1 bounded synthetic restart feasibility, no actual data or candidate EV.
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const html=fs.readFileSync('lab/index.html','utf8'),src=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
const marker='})(typeof window!=="undefined"?window:globalThis);';const end=src.indexOf(marker);assert(end>0);
const cases=[{id:'east3-low-dealer',rounds:1,wind:0,round:2,honba:0,kyotaku:1,initial:0,scores:[11100,23700,500,63700]},{id:'south4-close',rounds:2,wind:1,round:3,honba:1,kyotaku:2,initial:0,scores:[19000,18000,37000,24000]}];
let rows=[],seeds=new Set();
for(const c of cases)for(let rep=0;rep<4;rep++){
 const seed=crypto.createHash('sha256').update('q1-g-smoke-20261124:'+c.id+':'+rep).digest().readUInt32LE(0);assert(!seeds.has(seed));seeds.add(seed);
 let x=seed;const math=Object.create(Math);math.random=()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};
 const context={window:{},Math:math,console:{log(){},warn(){},error(){}}};new vm.Script(src.slice(0,end+marker.length)).runInNewContext(context);
 const M=context.window.MajiangCore,AI=context.window.MajiangAI;
 const rule=M.rule({'配給原点':25000,'赤牌':{m:1,p:1,s:1},'場数':c.rounds,'延長戦方式':0,'オーラス止めあり':true,'オーラス単独トップ止め':true,'トビ終了あり':true,'順位点':['0.0','0.0','0.0','0.0']});
 let publicChecks=0;const players=Array.from({length:4},()=>new class extends AI{action(msg,cb){if(msg.qipai){assert.equal(msg.qipai.shoupai.filter(Boolean).length,1);publicChecks++;}const z=msg.zimo||msg.gangzimo;if(z&&z.l!==this._menfeng){assert.equal(z.p,'');publicChecks++;}return super.action(msg,cb);}});
 const game=new M.Game(players,()=>{},rule,'Q1 synthetic');game._sync=true;game.kaiju(c.initial);
 Object.assign(game.model,{zhuangfeng:c.wind,jushu:c.round,changbang:c.honba,lizhibang:c.kyotaku,defen:c.scores.slice()});
 const start=performance.now();let steps=0;
 while(game._status!=='jieju'){
  const fn=game['reply_'+game._status];if(game._status==='gangzimo')game.reply_zimo();else{assert.equal(typeof fn,'function','unknown status '+game._status);fn.call(game);}
  assert(++steps<10000,'step cap');
 }
 const p=game._paipu,q=p.log[0][0].qipai,d=(c.initial+c.round)%4;
 assert.deepEqual(Array.from(q.defen),Array.from({length:4},(_,l)=>c.scores[(d+l)%4]));
 assert.equal(q.zhuangfeng,c.wind);assert.equal(q.jushu,c.round);assert.equal(q.changbang,c.honba);assert.equal(q.lizhibang,c.kyotaku);
 assert.equal(p.defen.reduce((a,b)=>a+b,0),100000);assert.deepEqual(Array.from(p.rank).sort(),[1,2,3,4]);assert(publicChecks>0);
 rows.push({case:c.id,rep,seed,remainingHands:p.log.length,steps,seconds:(performance.now()-start)/1000,publicChecks,rankValid:true,totalScoreValid:true,firstBoundaryValid:true});
}
const result={scope:'8 synthetic boundary restarts, fixed four standard AI, no candidate EV or calibration',rows};fs.writeFileSync('q1-g-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
