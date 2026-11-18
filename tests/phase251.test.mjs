import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script, runInNewContext } from 'node:vm';
import {
  actionForCall, actionForDiscard, analyzeAction, analyzeDecision,
  riichiComparison, aggregateDecisions, kanComparison
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
  assert.equal(analyzeAction(op,37)?.ratingContribution,1);
  assert.equal(analyzeAction(op,45)?.rank,2);
  assert.equal(analyzeAction(op,43),null);
  assert.equal(analyzeDecision(op,'m7'),null); // m7 is not legal in this sample
  assert.equal(riichiComparison(op,45)?.recommended,'リーチ');
  const judged=analyzeAction(op,45);
  const ag=aggregateDecisions([{type:'call',s42Review:judged},{riichiAvailable:true,s42Review:judged}]);
  assert.equal(ag.count,2);
  assert.equal(ag.ratingCount,2);
  assert.ok(Number.isFinite(ag.rating));
  assert.equal(ag.callCount,1);
  assert.equal(ag.riichiCount,1);
});


test('nine terminals/honors abortive draw is legal only on first draw',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
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

test('rendered rivers omit called tiles and transfer their tsumogiri metadata to melds',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 const fn=script.slice(script.indexOf('function visibleRiver('),script.indexOf('function renderRiver('));
 const visible=runInNewContext(fn+';visibleRiver',{});
 const river=visible(['m3','m6_-','p5*+','z1_','p1','p2','p3','p4','p5']);
 assert.equal(river.length,7);
 assert.equal(river[1].p,'z1_');assert.equal(river[1].carried,true);
 assert.equal(river.some(x=>x.calledAway),false);
 assert.match(script,/const river=visibleRiver\(raw\);/);
 const p=script.indexOf('function parseMeld('),p2=script.indexOf('function fitBoard(',p);
 const n=script.indexOf('function calledDiscardNote('),n2=script.indexOf('function appendMeldTiles(',n);
 const note=runInNewContext(script.slice(p,p2)+'\n'+script.slice(n,n2)+';calledDiscardNote',{});
 assert.equal(note({l:1,m:'p555-'},{l:0,p:'p5_'}).tsumogiri,true);
 assert.equal(note({l:1,m:'p555-'},{l:0,p:'p5'}).tsumogiri,false);
 assert.equal(note({l:1,m:'p555-'},{l:2,p:'p5_'}),null);
 assert.match(html,/副露の青点＝鳴いた牌がツモ切り/);
});
test('own-turn special actions and both immediate/late S42 results use the same evaluator',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 const a=script.indexOf('function recordTurnAction('),b=script.indexOf('function answer(',a);
 const source=script.slice(a,b);
 const q=Array(46).fill(null);q[42]=1;q[0]=0;
 const op={best:42,qLegal:q,id:17};
 const log=[];
 const context={decisionLog:log,game:{model:{zhuangfeng:0,jushu:0}},F:['東'],
   human:{shoupai:{}},M:{Util:{xiangting:()=>1}},mortalClient:{activeDecision:()=>17,current:op},
   parseMeld:()=>[],tileName:p=>p,captureS42Scene:()=>({}),captureCoachChoices:()=>({phase:'turn',kan:['m1111']}),
   s42Analytics:{analyzeAction,analyzeDecision,riichiComparison,kanComparison},
   lastFeedback:null,lastCandidateInfo:[],candidateInfo:[{p:'m1',shanten:1,ukeire:6,handTiles:['m2'],melds:[]}]};
 const record=runInNewContext(source+';recordTurnAction',context);
 record({gang:['m1111']},{gang:'m1111'});
 assert.equal(log.length,1);
 assert.equal(log[0].type,'action');
 assert.equal(log[0].s42Review.ratingContribution,1);
 assert.equal(log[0].kanComparison.chosen,'カンする');
 assert.equal(log[0].mortalDecision,17);
 assert.equal(log[0].candidates[0].p,'m1');
 assert.equal(log[0].candidates[0].ukeire,6);
 context.candidateInfo[0].handTiles.push('m9');
 assert.equal(log[0].candidates[0].handTiles.length,1);
 assert.match(script,/if\(entry.kanAvailable\)entry.kanComparison=/);
 assert.match(script,/kanAvailable:!!pending.gang\?\.length/);
});

test('Phoenix coach exports frozen public information, all legal Q values and independent coaching rules',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 const a=script.indexOf('function buildPhoenixPrompt('),b=script.indexOf('function renderPhoenixCoach(',a);
 assert.ok(a>=0&&b>a);
 const build=runInNewContext(script.slice(a,b)+';buildPhoenixPrompt',{s42ActionLabel:i=>'action'+i});
 const q=Array(46).fill(null);q[0]=1;q[1]=0;q[37]=.5;
 const scene={snapshotVersion:2,round:'南4局',mode:'半荘',ownWind:'南',honba:2,kyotaku:1,ownDiscards:5,remaining:40,hand:['m1','m2','p0','z7'],drawn:'p0',selfMelds:['s123-'],
   scores:[{name:'あなた',wind:'南',points:20000,rank:3}],rivers:[{name:'CPU',wind:'東',riichi:true,discards:[{tile:'m3',tsumogiri:true,riichi:true,called:true}],melds:['p555+']}],dora:['s3'],wall:['SECRET_WALL'],opponentHand:['SECRET_OPPONENT']};
 const entry={type:'discard',round:'南4局',discard:'m2_',choiceLabel:'打2萬',scene,legalChoices:{phase:'turn',discards:['m1','m2_'],riichiDiscards:['m1'],kan:[]},
   candidates:[{p:'m2_',shanten:1,ukeire:5,usefulDetails:[{p:'p2',count:2}]}],
   s42Review:{action:1,chosenQ:0,bestQ:1,recommendation:0.00004},mortalOpinion:{best:0,qLegal:q},result:'SECRET_RESULT'};
 const output=build(entry,'押し引きの根拠');
 const data=JSON.parse(output.split('【判断時点の記録】\n')[1].split('\n\n【追加で確認したい点】')[0]);
 assert.equal(data.ツモ牌,'p0');assert.equal(data.本場,2);assert.equal(data.供託本数,1);
 assert.equal(data.河と副露[0].捨牌履歴[0].ツモ切り,true);
 assert.equal(data.河と副露[0].捨牌履歴[0].鳴かれた,true);
 assert.equal(data.S42.合法Q.length,3);assert.equal(data.S42.選択Q,0);
 assert.equal(data.合法選択肢.立直可能打牌[0],'m1');
 assert.match(output,/鳳凰卓/);assert.match(output,/不一致や低推奨度だけで格下げしない/);
 assert.match(output,/押し引きの根拠/);
 assert.doesNotMatch(output,/SECRET_/);
 const call=build({type:'call',choiceLabel:'ポン',discard:'p5_',chosenMeld:'p555+',scene,
   legalChoices:{phase:'reaction',from:2,tile:'p5_',pon:['p555+'],chi:[],kan:[],ron:false,pass:true}});
 const callData=JSON.parse(call.split('【判断時点の記録】\n')[1]);
 assert.equal(callData.選択.副露選択,'p555+');assert.equal(callData.合法選択肢.スルー,true);assert.equal(callData.S42,null);
 const old=JSON.parse(build({type:'discard',scene:{hand:['m1'],rivers:[{tiles:['p3']}]}}).split('【判断時点の記録】\n')[1]);
 assert.equal(old.ツモ牌,null);assert.equal(old.自風,null);assert.match(old.記録仕様,/旧版/);
 assert.equal(build({}),null);
});
test('Phoenix snapshot uses only own concealed hand and pre-decision public fields',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 const a=script.indexOf('function captureS42Scene('),b=script.indexOf('function s42Aggregated(',a);
 const capture=runInNewContext(script.slice(a,b)+';captureS42Scene',{
   game:{model:{qijia:0,player_id:[1,2,3,0],defen:[25000,25000,25000,25000],zhuangfeng:0,jushu:1,changbang:1,lizhibang:0,lunban:3,
    shan:{baopai:['s3'],paishu:52,_pai:['SECRET_WALL']},
    he:[{_pai:['p5_+','m3*']},{_pai:[]},{_pai:[]},{_pai:['s8']}],
    shoupai:[{_fulou:['z111+'],lizhi:true,_bingpai:'SECRET_HAND'},{_fulou:[]},{_fulou:[]},{_fulou:[]}] }},
   human:{shoupai:{_fulou:[]}},ownSeat:()=>3,tileList:()=>['m1','p0_'],visibleRiver:raw=>raw.filter(p=>!/[+=-]$/.test(p)).map(p=>({p})),
   F:['東','南'],WINDS:['東','南','西','北'],NAMES:['自分','A','B','C'],userLabel:l=>'seat'+l,mode:'2',latestDiscard:{l:0,p:'m3*'}
 });
 const v=capture();assert.equal(v.drawn,'p0');assert.equal(v.ownWind,'北');assert.equal(v.scores[3].rank,1);
 assert.equal(v.rivers[0].discards[0].called,true);assert.equal(v.rivers[0].discards[1].riichi,true);
 assert.doesNotMatch(JSON.stringify(v),/SECRET_/);
});

test('inline Q display is independent of old analytics formatting exports for calls and discards',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 const a=script.indexOf('function recommendationText('),b=script.indexOf('function renderCoach()',a);
 assert.ok(a>=0&&b>a);
 const node=(tag,cls='',text='')=>({tag,cls,textContent:text,children:[],classList:{add(){},remove(){},toggle(){}},append(...nodes){this.children.push(...nodes)},replaceChildren(){this.children=[]}});
 const flash=node('div'),main=node('div');
 const review={chosenQ:-1.12345,bestQ:0.12345,gap:1.2469,recommendation:0.00000001,rank:2,legal:8,agreement:false};
 const context={lastFeedback:{type:'call',choiceLabel:'ポン',s42Review:review,mortalOpinion:{label:'スルー'},candidates:[]},s42Analytics:{},mortalClient:{workerReady:true},
   $:id=>id==='coachFlash'?flash:main,el:node,tileImg:()=>node('img'),tileName:p=>p};
 const render=runInNewContext(script.slice(a,b)+';renderInlineCoach',context);
 const flatten=n=>[n.textContent,...n.children.flatMap(flatten)].join(' ');
 render();assert.match(flatten(main),/あなた：ポン/);assert.match(flatten(main),/Q値：あなた -1\.123 ／ S42 0\.123/);assert.match(flatten(main),/推奨度 0\.05%未満/);
 context.lastFeedback={type:'discard',choiceLabel:'打1萬',discard:'m1',s42Review:review,mortalOpinion:{label:'打2萬',tile:'m2'},candidates:[{p:'m1',shanten:2,ukeire:10},{p:'m2',shanten:2,ukeire:12}]};
 render();assert.match(flatten(main),/Q値：あなた/);assert.match(flatten(main),/有効牌 10→12枚/);
 context.lastFeedback={type:'call',choiceLabel:'スルー',candidates:[],s42Review:null};render();assert.match(flatten(main),/未取得／解析中/);assert.doesNotMatch(flatten(main),/Q値：あなた/);
});
