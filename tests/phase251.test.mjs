import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script, runInNewContext } from 'node:vm';
import {
  actionForCall, actionForDiscard, analyzeAction, analyzeDecision,
  riichiComparison, aggregateDecisions
} from '../src/mortal/s42-analytics.mjs';
import { MortalMjaiBridge, toMjai } from '../src/mortal/mjai-bridge.mjs';

test('inline game JavaScript parses and all review controls exist', () => {
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script,'inline script');
  assert.doesNotThrow(()=>new Script(script));
  for(const id of ['mortalDownloadBtn','mortalModelFile','resultDecisionReview','endLastReview',
    's42EndSummary','coachOverlay','s42ReviewOverlay','callTray']){
    assert.ok(html.includes('id="'+id+'"'),id);
  }
  assert.ok(html.includes('Mortal-S42 準備完了'),'actual model readiness status');
  const start=script.indexOf('function visibleRiver(raw,showCalled=false)');
  const end=script.indexOf('function renderRiver(pos,l)',start);
  assert.ok(start>=0&&end>start);
  const visible=runInNewContext(script.slice(start,end)+'; visibleRiver', {});
  const samples=['m6_-','p5+','s8_','z1*','m1'];
  const ghost=visible(samples,true);
  assert.equal(ghost.length,5);
  assert.equal(ghost[0].calledAway,true);
  assert.equal(ghost[0].p.includes('_'),true);
  assert.equal(ghost[1].calledAway,true);
  assert.equal(ghost[2].calledAway,false);
  assert.equal(visible(samples).length,3);
});

test('chi, pon and daiminkan map to Mortal action IDs',()=>{
  assert.equal(actionForCall('m1-23'),38);
  assert.equal(actionForCall('m12-3'),39);
  assert.equal(actionForCall('m123-'),40);
  assert.equal(actionForCall('p555+'),41);
  assert.equal(actionForCall('s5555='),42);
  assert.equal(actionForCall('z111+'),41);
  assert.equal(actionForCall('m222'),null);
  assert.equal(actionForCall(null),null);
  assert.equal(actionForDiscard('m0_'),34);
  assert.equal(actionForDiscard('z1'),27);
  assert.equal(actionForDiscard('s8',true),37);
});

test('Q analysis never invents illegal actions and correctly compares reach vs no reach',()=>{
  const q=Array(46).fill(null);q[37]=1.2;q[45]=.9;q[8]=.8;
  const op={qLegal:q,best:37};
  assert.equal(analyzeAction(op,37)?.index,100);
  assert.equal(analyzeAction(op,45)?.rank,2);
  assert.equal(analyzeAction(op,43),null);
  assert.equal(analyzeDecision(op,'m7'),null); // m7 is not legal in this sample
  assert.equal(riichiComparison(op,45)?.recommended,'リーチ');
  const judged=analyzeAction(op,45);
  const ag=aggregateDecisions([{type:'call',s42Review:judged},{riichiAvailable:true,s42Review:judged}]);
  assert.equal(ag.count,2);
  assert.equal(ag.callCount,1);
  assert.equal(ag.riichiCount,1);
});


test('nine terminals/honors abortive draw is legal only on first draw',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const script=html.match(/<script>([\\s\\S]*?)<\\/script>/)?.[1];
  const boundary='})(typeof window!=="undefined"?window:globalThis);';
  const end=script.indexOf(boundary);
  assert.ok(end>0,'embedded Majiang engine');
  const context={window:{}};
  new Script(script.slice(0,end+boundary.length)).runInNewContext(context);
  const M=context.window.MajiangCore;
  const good=M.Shoupai.fromString('m119p19s19z1234567');
  const poor=M.Shoupai.fromString('m123456789p12345');
  assert.equal(M.Game.allow_pingju(M.rule(),good,true),true);
  assert.equal(M.Game.allow_pingju(M.rule(),good,false),false);
  assert.equal(M.Game.allow_pingju(M.rule(),poor,true),false);
  assert.equal(M.Game.allow_pingju(M.rule({'途中流局あり':false}),good,true),false);
});

test('inference worker uses serialized evaluation and retains pending judgment IDs',()=>{
  const worker=readFileSync(new URL('../src/mortal/mortal-worker.mjs',import.meta.url),'utf8');
  const client=readFileSync(new URL('../src/mortal/mortal-client.mjs',import.meta.url),'utf8');
  assert.ok(worker.includes('workQueue=workQueue.then('),'queued inference');
  assert.equal(worker.includes("if(working)return fail('処理中'"),false);
  assert.ok(client.includes('pending.size>192'),'bounded pending decisions');
  assert.equal(client.includes('this.pending.clear()'),false,'no losing outstanding decision IDs');
});
test('MJAI bridge preserves exact public discards and called tiles',()=>{
  const bridge=new MortalMjaiBridge();
  const q=bridge.receive({qipai:{
    zhuangfeng:0,jushu:0,baopai:'m2',changbang:0,lizhibang:0,
    defen:[25000,25000,25000,25000],shoupai:['m123456789p1234','','','']
  }});
  assert.equal(q.reset,true);
  assert.equal(q.seat,0);
  assert.equal(q.events[1].tehais[0].length,13);
  const discard=bridge.receive({dapai:{l:0,p:'m1_'}});
  assert.equal(discard.events[0].tsumogiri,true);
  const meld=bridge.receive({fulou:{l:1,m:'m111+'}});
  assert.equal(meld.events[0].type,'pon');
  assert.equal(meld.events[0].target,0);
  assert.equal(toMjai('z6'),'F');
});
