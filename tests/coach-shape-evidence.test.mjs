import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {shapeFacts,buildEvidence} from '../src/coach/phoenix-coach.mjs';
const src=readFileSync(new URL('../index.html',import.meta.url),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const b='})(typeof window!=="undefined"?window:globalThis);';
const ctx={window:{}};new Script(src.slice(0,src.indexOf(b)+b.length)).runInNewContext(ctx);const M=ctx.window.MajiangCore;
const types=[...('mps')].flatMap(s=>Array.from({length:9},(_,i)=>s+(i+1))).concat(Array.from({length:7},(_,i)=>'z'+(i+1)));
const pool=Object.fromEntries(types.map(p=>[p,0]));
const v=()=>({ownSeat:1,round:'東1局',rivers:Array.from({length:4},()=>({discards:[],melds:[]})),dora:['p2']});
const h=s=>M.Shoupai.fromString(s);
test('kokushi structural wait and newly discarded self-river furiten',()=>{
 const f=shapeFacts(M,h('m19p19s19z1234567'),pool,v(),'m1');
 assert.equal(f.向聴内訳.国士無双,0);assert.equal(f.形式待ち.length,13);
 assert.equal(f.自己河フリテン,true);assert.deepEqual(f.自己河フリテン該当牌,['m1']);
});
test('open dora-only tenpai is not ordinary yaku; yakuhai changes it',()=>{
 let f=shapeFacts(M,h('m234p234s67z11,m111-'),pool,v());
 assert.equal(f.門前,false);assert.equal(f.向聴内訳.七対子,null);assert.equal(f.向聴内訳.国士無双,null);
 assert.ok(f.形式待ち.every(x=>x.通常ロン役.length===0&&x.通常ツモ役.length===0));
 f=shapeFacts(M,h('m234p234s67z11,z555+'),pool,v());
 assert.ok(f.形式待ち.every(x=>x.通常ロン役.includes('翻牌 白')));
});
test('called red discard and exhausted wait still cause self-river furiten',()=>{
 const a=v();a.rivers[1].discards=[{tile:'p0',called:true}];
 const f=shapeFacts(M,h('m234p234s678z11p67'),{...pool,p5:4},a);
 assert.equal(f.自己河フリテン,true);assert.deepEqual(f.自己河フリテン該当牌,['p5']);
 assert.equal(f.形式待ち.find(x=>x.牌==='p5').残上限,0);
 assert.ok(f.形式待ち.some(x=>x.牌==='p8'));
});
test('chiitoitsu and ordinary hand shanten remain distinct',()=>{
 const f=shapeFacts(M,h('m1122p3344s5566z7'),pool,v());
 assert.equal(f.向聴内訳.七対子,0);assert.ok(f.向聴内訳.一般形>0);
});
test('candidate evidence preserves actual two-draw regression',()=>{
 const expand=s=>[...s.matchAll(/[mpsz][0-9]+/g)].flatMap(([x])=>[...x.slice(1)].map(n=>x[0]+n));
 const a={...v(),snapshotVersion:2,hand:expand('m1245999p45s18899'),selfMelds:[],dora:['s2']};
 const candidates=['m1','s1','m2'].map(p=>{const handTiles=a.hand.slice();handTiles.splice(handTiles.indexOf(p),1);return {p,handTiles,melds:[],shanten:2,ukeire:20}});
 const e=buildEvidence({scene:a,discard:'m1',candidates,mortalOpinion:{tile:'s1'}},M);
 assert.deepEqual(e.候補別牌姿.map(x=>x.二連続向聴改善.組合せ数),[256,268,256]);
 assert.ok(e.候補別牌姿.every(x=>x.形と和了条件.向聴内訳));
});

test('actual engine scoring separates dama and reach, and no-yaku from possible points',()=>{
 const a=v();
 const f=shapeFacts(M,h('m234p345s45667m88'),pool,a);
 assert.equal(f.向聴内訳.一般形,0);
 const row=f.形式待ち.find(x=>x.牌==='s5');
 assert.ok(row.通常ロン基本点>0);
 assert.ok(row.仮立直ロン基本点>=row.通常ロン基本点);
 const g=shapeFacts(M,h('m234p234s67z11,m111-'),pool,a);
 assert.ok(g.形式待ち.every(x=>x.通常ロン基本点===null&&x.仮立直ロン基本点===undefined));
});
