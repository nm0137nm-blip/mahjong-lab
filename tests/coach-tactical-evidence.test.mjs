import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {comparePublicCandidates,selectTacticalEvidence} from '../src/coach/tactical-evidence.mjs';
import {buildPrompt} from '../src/coach/phoenix-coach.mjs';
function fixture(){
 const scene={snapshotVersion:2,ownSeat:0,hand:['m1','m2','m3','p1','p2','p3','s4','s5','s6','z5','z5','z6','p4','p0'],rivers:[0,1,2,3].map(()=>({riichi:false,discards:[],melds:[]})),round:'東1局',dora:['m9'],selfMelds:[]};
 const fact=(p,s,u,d,safe=[])=>({打牌:p,向聴:s,受け入れ:u,保持ドラ翻:d,相手別現物:[1,2,3].map(i=>({席:i,現物:safe.includes(i)}))});
 const facts={候補別牌姿:[fact('p4',1,20,2),fact('p0',1,19,1)]};
 const q=Array(46).fill(null);q[12]=1;q[35]=0;
 const entry={type:'discard',scene,discard:'p0_',mortalDecision:8,mortalOpinion:{id:8,source:'Mortal-S42',best:12,qLegal:q},legalChoices:{phase:'turn',discards:['p4','p0_'],riichiDiscards:[],kan:[]}};
 return {scene,facts,entry,fact};
}
test('empirical support matches a specific pair, not guessed model reasons',()=>{
 const {entry,facts}=fixture();const r=selectTacticalEvidence(entry,facts);
 const d=r.find(x=>x.ID==='DORA_TIE');assert.equal(d.経験則が支持する候補,'p4');assert.equal(d.別対局照合.判断局面,583);assert.equal(d.別対局照合.逆方向_pct,17.15);
 assert.ok(!JSON.stringify(r).includes('qLegal'));
 entry.mortalOpinion.best=35;entry.mortalOpinion.qLegal[35]=2;
 assert.equal(selectTacticalEvidence(entry,facts).find(x=>x.ID==='DORA_TIE').経験則が支持する候補,'p4'); // Do not force agreement with actual Q.
});
test('do not apply when stale, special action, incomplete evidence or illegal mask',()=>{
 for(const mutate of [
  ({entry})=>entry.mortalDecision=9,
  ({entry})=>entry.mortalOpinion.source='heuristic',
  ({entry})=>entry.legalChoices.riichiDiscards=['p4'],
  ({entry})=>entry.mortalOpinion.qLegal[37]=2,
  ({entry})=>entry.legalChoices.discards.push('s4'),
  ({facts})=>facts.候補別牌姿.pop(),
  ({scene})=>scene.snapshotVersion=1,
  ({entry})=>entry.type='reaction'
 ]){const f=fixture();mutate(f);assert.deepEqual(selectTacticalEvidence(f.entry,f.facts),[]);}
});
test('genbutsu rule checks same shanten and single riichi, not all non-genbutsu dangerous',()=>{
 const {scene,facts,fact}=fixture();scene.rivers[2].riichi=true;
 facts.候補別牌姿=[fact('p4',1,20,1,[2]),fact('p0',1,19,1)];
 assert.equal(comparePublicCandidates(scene,facts,[12,35],12,35).find(x=>x.ID==='SAFE_TIE').経験則が支持する候補,'p4');
 scene.rivers[1].riichi=true;assert.ok(!comparePublicCandidates(scene,facts,[12,35],12,35).some(x=>x.ID==='SAFE_TIE'));
});
test('coaching default stays unchanged; opt-in adds evidence only when applicable',()=>{
 const source=readFileSync(new URL('../index.html',import.meta.url),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
 const boundary='})(typeof window!=="undefined"?window:globalThis);';
 const w={};runInNewContext(source.slice(0,source.indexOf(boundary)+boundary.length),{window:w});const M=w.MajiangCore;
 const scene={snapshotVersion:2,ownSeat:0,hand:['m1','m2','m4','m5','m9','m9','m9','p4','p5','s1','s8','s8','s9','s9'],rivers:[0,1,2,3].map(()=>({riichi:false,discards:[],melds:[]})),round:'東1局',dora:['s2'],selfMelds:[]};
 const ts=[...new Set(scene.hand)];
 const candidates=ts.map(t=>{const handTiles=scene.hand.slice();handTiles.splice(handTiles.indexOf(t),1);const h=M.Shoupai.fromString(handTiles.join(''));return {p:t,shanten:M.Util.xiangting(h),ukeire:0,handTiles,melds:[]};});
 const ids=ts.map(t=>'mps'.indexOf(t[0])*9+Number(t[1])-1);
 const q=Array(46).fill(null);ids.forEach(i=>q[i]=-1);q[0]=1;
 const entry={type:'discard',scene,discard:'s1',mortalDecision:1,mortalOpinion:{id:1,source:'Mortal-S42',best:0,qLegal:q,tile:'m1'},legalChoices:{phase:'turn',discards:ts,riichiDiscards:[],kan:[]},candidates};
 const legacy='test\n\n【判断時点の記録】\n'+JSON.stringify({S42:{test:true}});
 const a=buildPrompt(legacy,entry,M);assert.equal(a,buildPrompt(legacy,entry,M,{tacticalEvidence:false}));assert.ok(!a.includes('類似条件の戦術統計'));
 const c=buildPrompt(legacy,entry,M,{tacticalEvidence:true});
 // This case need not match; check that the output retains all current objective evidence and Q.
 const A=JSON.parse(a.split('【判断時点の記録】\n')[1]),C=JSON.parse(c.split('【判断時点の記録】\n')[1]);
 assert.deepEqual(A.コーチ計算情報,C.コーチ計算情報);assert.deepEqual(A.S42,C.S42);
});
