import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script, runInNewContext } from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'inline game JavaScript is present');
const marker='})(typeof window!=="undefined"?window:globalThis);';
const boundary=script.indexOf(marker);
assert.ok(boundary>0,'embedded Majiang engine is available');
const context={window:{}};
new Script(script.slice(0,boundary+marker.length)).runInNewContext(context);
const M=context.window.MajiangCore;
const rules=M.rule({'場数':1,'延長戦方式':0,'オーラス止めあり':true,'オーラス単独トップ止め':true,'トビ終了あり':true});

function engine({scores,dealer=0,round=3,wind=0,repeat=true,abortive=false,rule=rules}) {
  const player_id=Array.from({length:4},(_,i)=>(dealer+i)%4);
  const g={
    _model:{defen:scores.slice(),player_id,qijia:0,jushu:round,zhuangfeng:wind,lunban:-1},
    _rule:rule,_lianzhuang:repeat,_no_game:abortive,_max_jushu:Number(rule['場数'])*4-1,
    delay(fn){fn();},jieju(){this.next='end';},qipai(){this.next='continue';}
  };
  M.Game.prototype.last.call(g);
  return g.next;
}

const start=script.indexOf('  function willFinishAfterResult() {');
const end=script.indexOf('  // The player must be able',start);
assert.ok(start>=0&&end>start,'end-screen predictor exists');
const predict=runInNewContext(script.slice(start,end)+';(game)=>{globalThis.game=game;return willFinishAfterResult();}');

function both(name,{scores,fenpei=[0,0,0,0],dealer=0,round=3,wind=0,repeat=true,abortive=false,rule=rules},expected) {
  test(name,()=>{
    const final=scores.map((x,i)=>x+fenpei[i]);
    assert.equal(engine({scores:final,dealer,round,wind,repeat,abortive,rule}),expected?'end':'continue','engine result');
    const player_id=Array.from({length:4},(_,i)=>(dealer+i)%4);
    const game={
      model:{defen:scores.slice(),player_id,qijia:0,jushu:round,zhuangfeng:wind},
      _rule:rule,_max_jushu:Number(rule['場数'])*4-1,_lianzhuang:repeat,
      _no_game:abortive,_fenpei:fenpei.slice(),_hule:[]
    };
    assert.equal(Boolean(predict(game)),expected,'result-screen finish preview');
  });
}

test('LAB config explicitly enables Tenhou extension and tobi',()=>{
  assert.match(script,/selectedRule = M\.rule\([^\n]*'延長戦方式':2,'オーラス止めあり':true,'オーラス単独トップ止め':false,'トビ終了あり':true/);
});

both('East 4 dealer wins, leads with less than 30k',
  {scores:[27700,26900,24300,21100],fenpei:[1000,-1000,0,0]},true);
both('East 4 dealer wins, remains second',
  {scores:[26700,30000,23000,20300],fenpei:[1000,-1000,0,0]},false);
both('East 4 dealer tenpai normal draw, leads with less than 30k',
  {scores:[27700,27300,25000,20000],fenpei:[1500,-1500,0,0]},true);
both('East 4 dealer tenpai normal draw, remains second',
  {scores:[27500,28900,24000,19600],fenpei:[1500,1500,-1500,-1500]},false);
both('East 4 tied top cannot end',
  {scores:[28000,28000,24000,20000]},false);
both('East 4 abortive draw cannot end despite dealer lead',
  {scores:[37000,26000,21000,16000],abortive:true},false);
both('East 3 leading dealer continues before all-last',
  {scores:[37000,26000,21000,16000],round:2},false);
both('East 4 dealer noten draw ends after rotation',
  {scores:[25000,30000,26000,19000],repeat:false},true);
both('East 4 child win ends after rotation',
  {scores:[25000,30000,26000,19000],repeat:false},true);
both('South 4 leading dealer win ends',
  {scores:[28400,28000,25000,18600],wind:1,rule:M.rule({...rules,'場数':2})},true);
both('South 4 second-place dealer tenpai continues',
  {scores:[26400,28000,25000,20600],wind:1,rule:M.rule({...rules,'場数':2})},false);
both('Early hand score below zero ends by tobi',
  {scores:[39000,-100,31000,30100],round:0,repeat:false},true);
both('Early hand exactly zero is not tobi',
  {scores:[38000,0,31000,31000],round:0,repeat:false},false);

test('default Majiang engine keeps 30k requirement unless LAB override enabled',()=>{
 const base=M.rule({'場数':1,'オーラス止めあり':true,'延長戦方式':0});
 assert.equal(engine({scores:[28000,27000,25000,20000],rule:base}),'continue');
 assert.equal(engine({scores:[31000,27000,22000,20000],rule:base}),'end');
});

const tenhou=(length)=>M.rule({'場数':length,'延長戦方式':2,'オーラス止めあり':true,'オーラス単独トップ止め':false,'トビ終了あり':true,'ダブル役満あり':false,'Tenhou研究ルール':true});
for(const length of [1,2]){
 const rule=tenhou(length),wind=length-1;
 both('Tenhou '+length+' under30 dealer continues',{scores:[28000,27000,24000,21000],wind,rule},false);
 both('Tenhou '+length+' dealer30 stops',{scores:[30000,26000,24000,20000],wind,rule},true);
 both('Tenhou '+length+' rotate under30 extends',{scores:[28000,27000,24000,21000],wind,repeat:false,rule},false);
 both('Tenhou '+length+' rotate 30 ends',{scores:[30000,26000,24000,20000],wind,repeat:false,rule},true);
 both('Tenhou '+length+' tied dealer earliest at 30 stops',{scores:[30000,30000,20000,20000],wind,rule},true);
 both('Tenhou '+length+' tied dealer later continues',{scores:[30000,30000,20000,20000],dealer:1,wind,rule},false);
 both('Tenhou '+length+' abort continues',{scores:[40000,25000,20000,15000],wind,rule,abortive:true},false);
 test('Tenhou '+length+' extension boundaries and renchan priority',()=>{
  for(const [round,max,scores,repeat,expected] of [[0,length*4,[26000,32000,24000,18000],true,false],[0,length*4,[32000,26000,24000,18000],true,true],[0,length*4,[26000,32000,24000,18000],false,true],[3,(length+1)*4-1,[26000,25000,25000,24000],false,true],[3,(length+1)*4-1,[26000,25000,25000,24000],true,false]]){
   const player_id=[0,1,2,3];
   const g={_model:{defen:scores.slice(),qijia:0,player_id,jushu:round,zhuangfeng:length},_rule:rule,_max_jushu:max,_lianzhuang:repeat,_no_game:false,delay(f){f();},jieju(){this.next=true;},qipai(){this.next=false;}};
   const prediction={model:{...g._model},_rule:rule,_max_jushu:max,_lianzhuang:repeat,_no_game:false,_fenpei:[0,0,0,0],_hule:[]};
   assert.equal(Boolean(predict(prediction)),expected);M.Game.prototype.last.call(g);assert.equal(g.next,expected);
  }
 });
}
const rankStart=script.indexOf('  function tenhouRankPt('),rankEnd=script.indexOf('  function readTenhouProfile',rankStart);
const rankPt=runInNewContext(script.slice(rankStart,rankEnd)+';tenhouRankPt');
test('official fixed-rank pt all supported ranks rooms lengths',()=>{
 for(const room of ['tokujou','houou'])for(let dan=room==='houou'?7:4;dan<=10;dan++)for(const length of [1,2]){
  const positive=room==='tokujou'?[50,20]:[60,30],factor=length===2?1.5:1;
  const expected=[...positive,0,-(20+10*dan)].map(n=>n*factor);
  assert.deepEqual([1,2,3,4].map(rank=>rankPt(room,dan,length,rank)),expected);
 }
 assert.throws(()=>rankPt('houou',6,2,4));assert.throws(()=>rankPt('tokujou',6,0,1));
 assert.match(script,/mahjonglab-measured-tenhou-v1/);
});
