import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {buildEvidence,buildPrompt,nextPublicEvents,VERSION} from '../src/coach/phoenix-coach.mjs';
const src=readFileSync(new URL('../index.html',import.meta.url),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const b='})(typeof window!=="undefined"?window:globalThis);';
const ctx={window:{}};new Script(src.slice(0,src.indexOf(b)+b.length)).runInNewContext(ctx);const M=ctx.window.MajiangCore;
const expand=s=>[...s.matchAll(/[mpsz][0-9]+/g)].flatMap(([x])=>[...x.slice(1)].map(n=>x[0]+n));
const rivers=()=>Array.from({length:4},()=>({discards:[],melds:[],riichi:false}));
function scene(hand){
 return {snapshotVersion:2,round:'東1局',mode:'半荘',ownSeat:2,hand:expand(hand),selfMelds:[],dora:['s2'],rivers:rivers(),scores:[25000,25000,25000,25000].map(points=>({points})),initialOrder:[2,3,0,1],honba:0,kyotaku:0,publicEvents:[]};
}
function candidate(v,p){const handTiles=v.hand.slice();handTiles.splice(handTiles.indexOf(p),1);return {p,handTiles,melds:[],shanten:2,ukeire:20};}
test('runtime coach objectively reproduces reported two-draw comparison and red/dora distinction',()=>{
 const v=scene('m1245999p45s18899');
 const entry={scene:v,discard:'m1',candidates:['m1','s1','m2'].map(p=>candidate(v,p)),mortalOpinion:{tile:'s1'}};
 const e=buildEvidence(entry,M);
 assert.deepEqual(e.実ドラ,['s3']);
 assert.deepEqual(e.候補別牌姿.map(x=>x.受け入れ),[20,20,20]);
 assert.deepEqual(e.候補別牌姿.map(x=>x.二連続向聴改善.組合せ数),[256,268,256]);
 assert.deepEqual(e.候補別牌姿.map(x=>x.二連続向聴改善.内訳.find(y=>y.ツモ==='m3').次の受け入れ),[12,15,12]);
 assert.equal(e.点棒変動例.現在順位,1);
 const ron=e.点棒変動例.ロンと放銃.find(x=>x.相手===0&&x.仮ロン基本点===3900);
 assert.deepEqual(ron.自分和了後点棒,[21100,25000,28900,25000]);
 assert.deepEqual(ron.放銃後点棒,[30800,25000,19200,25000]);
});
test('public chronology strips concealed draws, qipai, results and extraneous fields',()=>{
 let events=nextPublicEvents([{old:true}],{qipai:{shoupai:'SECRET_HAND'}});
 events=nextPublicEvents(events,{zimo:{l:0,p:'SECRET_DRAW'}});
 events=nextPublicEvents(events,{dapai:{l:0,p:'s1_*',hidden:'SECRET'}});
 events=nextPublicEvents(events,{fulou:{l:2,m:'s111=',hidden:'SECRET'}});
 events=nextPublicEvents(events,{hule:{shoupai:'SECRET_RESULT'}});
 assert.equal(events.length,3);
 assert.deepEqual(events[0],{種類:'自摸',席:0});
 assert.equal(events[1].立直宣言,true);assert.equal(events[1].ツモ切り,true);
 const v=scene('p456s1134788z222');
 v.publicEvents=events.map(e=>({...e,hidden:'SECRET_OTHER'}));
 v.rivers[0].discards=[{tile:'s1',tsumogiri:true,riichi:true,called:false}];v.rivers[0].riichi=true;
 v.dora=['s5'];v.pendingReach=true;
 const e=buildEvidence({scene:v,legalChoices:{phase:'reaction',pon:['s111='],chi:[],kan:[]}},M);
 assert.doesNotMatch(JSON.stringify(e),/SECRET/);
 assert.equal(e.点棒変動例,null);assert.equal(e.スルー後.向聴,1);
 const x=e.鳴き候補[0].合法打牌.find(x=>x.打牌==='s7');
 assert.equal(x.向聴,0);assert.deepEqual(x.有効牌.map(x=>x.牌),['s2','s5']);
});
test('called river tiles are counted once; public yaku separate from dora; old data not invented',()=>{
 const v=scene('m1245999p45s18899');
 v.dora=['p3'];v.rivers[0].discards=[{tile:'p4',called:true}];
 // replace own p45 with two distinct tiles so the open p4 triplet plus
 // the called-away p4 is not incorrectly double counted.
 v.hand=v.hand.map(p=>p==='p4'?'p6':p);
 v.rivers[1].melds=['p444+','z555+'];
 const e=buildEvidence({scene:v},M);
 assert.equal(e.見え枚数.p4,3);assert.equal(e.各家公開事実[1].公開ドラ翻,3);
 assert.equal(e.各家公開事実[1].公開役牌翻,1);
 const old=buildEvidence({scene:{hand:['m1'],dora:['s2']}},M);
 assert.deepEqual(old.実ドラ,['s3']);assert.ok(old.欠落);assert.equal(old.各家公開事実,undefined);
});
test('new prompt retains shortcut prefix, final Q section, user question and no fabricated data',()=>{
 const v=scene('m1245999p45s18899'),entry={scene:v,discard:'m1',candidates:[candidate(v,'m1')]};
 const old='あなたは天鳳の鳳凰位レベル old\n\n【判断時点の記録】\n'+JSON.stringify({S42:{選択Q:-1},手牌_選択前:v.hand})+'\n\n【追加で確認したい点】\n二度受け';
 const p=buildPrompt(old,entry,M);
 assert.ok(p.startsWith('あなたは天鳳の鳳凰位レベル'));assert.match(p,new RegExp(VERSION));assert.match(p,/相対的な手の価値/);
 assert.match(p,/最善手/);assert.match(p,/二度受け$/);
 const data=JSON.parse(p.split('【判断時点の記録】\n')[1].split('\n\n【追加で確認したい点】')[0]);
 assert.equal(Object.keys(data).at(-1),'S42');assert.equal(data.S42.選択Q,-1);assert.deepEqual(data.コーチ計算情報.実ドラ,['s3']);
});
