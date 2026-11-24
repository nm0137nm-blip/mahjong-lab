// Test actual research-patched engine end-of-round decisions independently of gameplay.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(process.argv[2],'utf8'),rule=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
const marker='})(typeof window!=="undefined"?window:globalThis);';
const src=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];const end=src.indexOf(marker);assert(end>0);
const ctx={window:{},Math,console};new vm.Script(src.slice(0,end+marker.length)).runInNewContext(ctx);
const M=ctx.window.MajiangCore;
const cases=[
 ['early-not-stop',5,7,0,[40000,20000,20000,20000],true,false,false,7],
 ['south4-all-under30',7,7,0,[26000,25000,25000,24000],false,false,false,8],
 ['south4-exact30',7,7,0,[30000,25000,25000,20000],false,false,true,7],
 ['south4-dealer-top-under30',7,7,0,[24000,25000,25000,26000],true,false,false,7],
 ['south4-dealer-top-30',7,7,0,[25000,25000,20000,30000],true,false,true,7],
 ['west1-renchan-other-top',8,8,0,[26000,32000,24000,18000],true,false,false,8],
 ['west1-renchan-dealer-top',8,8,0,[30000,25000,25000,20000],true,false,true,8],
 ['west1-rotate-no30',8,8,0,[26000,25000,25000,24000],false,false,false,9],
 ['west1-rotate-30',8,8,0,[26000,30000,24000,20000],false,false,true,8],
 ['west4-rotate-cap',11,11,0,[26000,25000,25000,24000],false,false,true,11],
 ['west4-repeat-under30',11,11,0,[26000,25000,25000,24000],true,false,false,11],
 ['abort-no-stop',7,7,0,[20000,20000,20000,40000],true,true,false,7],
 ['tobi',0,7,0,[40000,35000,25100,-100],false,false,true,7],
 ['zero-continues',0,7,0,[50000,30000,20000,0],false,false,false,7],
 ['ties-start-seat-dealer-wins',7,7,1,[30000,20000,30000,20000],true,false,false,7],
 ['ties-start-seat-dealer-loses',7,7,0,[30000,20000,20000,30000],true,false,false,7],
 ['sticks-not-in-threshold',7,7,0,[29000,25000,25000,20000],false,false,false,8]
];
// Last case with rotated initial 1: dealer absolute 0; top tie to seat2 by initial order, so continues.
for(const [name,cur,max,initial,scores,repeat,abort,expected,newMax] of cases){
 const oya=(initial+cur%4)%4;let result=null;
 const fake={_model:{qijia:initial,zhuangfeng:Math.floor(cur/4),jushu:cur%4,player_id:Array.from({length:4},(_,l)=>(oya+l)%4),defen:scores.slice()},_rule:rule,_lianzhuang:repeat,_no_game:abort,_max_jushu:max,delay:f=>f(),jieju:()=>result=true,qipai:()=>result=false};
 M.Game.prototype.last.call(fake);assert.equal(result,expected,name);assert.equal(fake._max_jushu,newMax,name+' max');
}
// Test compound yakuman Pao. South player wins with open dragons and all honors.
const h=M.Shoupai.fromString('z11222,z555+,z666=,z777-');
const p=M.Util.hule_param({rule,menfeng:1,zhuangfeng:0,changbang:2,lizhibang:1});
const result=M.Util.hule(h,null,p);
assert.equal(result.damanguan,2);
assert.equal(result.fenpei[0],-64600);assert.equal(result.fenpei[1],65600);assert.equal(result.fenpei[2],0);assert.equal(result.fenpei[3],0);
// Kakan following an open kan: no reveal during chankan decision, reveal only after no Ron.
// Three simultaneous chankan Ron requests end as abortive draw.
let seq=[];const fake={_model:{lunban:0,shoupai:Array.from({length:4},()=>({gang(){},toString(){return 'synthetic'},clone(){return {zimo(){return M.Shoupai.fromString('m123456789p123z1')}}}}))},_rule:rule,_gang:'p5555+',_n_gang:[0,0,0,0],_hule:[],_neng_rong:[true,true,true,true],add_paipu(){},call_players(){seq.push('reaction')},kaigang(){seq.push('dora');this._gang=null},get_reply(){return {hule:true}},allow_hule(){return true},say(){},delay:f=>f(),hule(){seq.push('win')},pingju(n){seq.push(n)},gangzimo(){seq.push('rinshan')}};
M.Game.prototype.gang.call(fake,'m111+1');assert.deepEqual(seq,['reaction']);
M.Game.prototype.reply_gang.call(fake);assert.deepEqual(seq,['reaction','三家和']);
seq=[];fake._hule=[];fake._gang='p5555+';fake.get_reply=()=>({});M.Game.prototype.gang.call(fake,'m111+1');assert.deepEqual(seq,['reaction']);
M.Game.prototype.reply_gang.call(fake);assert.deepEqual(seq,['reaction','dora','rinshan']);
console.log(JSON.stringify({status:'PASS',endCases:cases.length,paoCases:1,kanCases:2,scope:'targeted boundary and known rule difference regression; not full Tenhou certification'}));
