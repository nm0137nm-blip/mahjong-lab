// One pre-selected technical smoke pair. No publication of raw receipts, actions, or outcomes.
import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';import {patchPinnedRunner} from './patch-first-riichi-runner.mjs';
const check=(v,m)=>{if(!v)throw Error(m)},sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex'),same=(a,b)=>sha(a)===sha(b);
const expected={shard:1,seed:113264466,dealer:0,decisionIndex:44,actorSeat:3,publicHash:'0444522dba68074705d1915dbb604c0a76b9f5587a774f1b08a99d2b08b9706d',prefixHash:'841d69b5fe29c159f42a00c46b926370db93a117e792bc1b9836f9620aeaaca0',logHash:'957e3f6faa23ccba4bbda8793f7cd4510b6efadaf685a92e725f9d6ce347cfe9',wallHash:'72b034bff7a21c5016690c435cba83707894633477d1c9f25f54c0d565d1a08d',ruleHash:'3acee28840a6c152702f49b136ce82e5afebcb90d6187b50a3f5b7eb052fa10f',originalActionHash:'34dc0e9dd0ead42287e95b1596dc367fbeb5b348e66056ce5eecc9c8f49d622e',alternativeActionHash:'e528d5a6bc3afce014ac2d01c6ebd1c021d190c549691768eedbb55977da4508'};
const lab='/tmp/lab',runner=path.join(lab,'tests/next/run-p1-v2-dev.cjs'),html=path.join(lab,'index.html'),coach=path.join(lab,'src/coach/phoenix-coach.mjs');
function read(p){return JSON.parse(fs.readFileSync(p,'utf8'))}
function run(){
 check(process.env.GITHUB_ACTIONS==='true','CI only');let s=patchPinnedRunner(fs.readFileSync(runner,'utf8'));
 function patch(a,b){check(s.split(a).length===2,'runner anchor');s=s.replace(a,b)}
 patch('for(let i=0;i<4;i++){\n const child=spawn(', 'for(let i=0;i<0;i++){\n const child=spawn(');
 patch("console.log('ARENA_MATCH='+JSON.stringify(rows.at(-1)));","console.log('S42 technical smoke finished');");
 patch("fs.writeFileSync('/tmp/development/paipu.json',JSON.stringify(outcome.game));","fs.writeFileSync('/tmp/development/paipu.json',JSON.stringify(outcome.game));\n   fs.writeFileSync('/tmp/development/wallOrder.json',JSON.stringify(outcome.walls));");
 patch('return {rank:game._paipu.rank,score:game._paipu.defen,qijia:game._paipu.qijia,log:game._paipu.log};','return {rank:game._paipu.rank,score:game._paipu.defen,qijia:game._paipu.qijia,log:game._paipu.log,rule:game._rule,point:game._paipu.point};');
 fs.writeFileSync(runner,s);check(spawnSync('node',['--check',runner],{stdio:'ignore'}).status===0,'runner syntax');
 const originals=[html,coach].map(p=>[p,fs.readFileSync(p)]);
 check(createHash('sha256').update(originals[0][1]).digest('hex')==='19d62e1acaa1d4334bf9828fbc14c3aca56734be0aff6b96ce749de4b18d34c5','patched engine drift');
 fs.writeFileSync('/tmp/v2-dev-seeds.json',JSON.stringify({status:'locked_v2_development_only',codeSha:process.env.GITHUB_SHA,entries:[{shard:1,seed:expected.seed,dealer:expected.dealer,family:'s42',policy:'s42'}]}));
 const result=[];
 for(const mode of ['baseline','alternative']){
   for(const [p,b] of originals)fs.writeFileSync(p,b);
   fs.rmSync('/tmp/development',{recursive:true,force:true});
   fs.writeFileSync('/tmp/l2-plan.json',JSON.stringify({mode,decisionIndex:expected.decisionIndex}),{mode:0o600});
   const fd=fs.openSync('/tmp/l2-private.log','w',0o600);
   let proc;try{proc=spawnSync('node',[runner],{env:{...process.env,COACH_ARENA_QA:'1',ARENA_PAIR:'1',L2_PLAN_FILE:'/tmp/l2-plan.json'},stdio:['ignore',fd,fd],timeout:300000})}finally{fs.closeSync(fd)}
   if(proc.status!==0){const log=fs.readFileSync('/tmp/l2-private.log','utf8');const cats=['L2 source action','L2 target not uniquely legal','L2 configuration','L2 receipt','L2 intervention','L2 not first riichi','reference mask mismatch','decision progression mismatch','CPU arena failure','arena stall','TimeoutError','page.evaluate','legal_mask_mismatch','private qipai contract','private draw contract'];console.log('RUNNER_DIAGNOSTIC='+JSON.stringify(cats.filter(c=>log.includes(c))));throw Error('private runner failed '+mode)}
   const p=read('/tmp/development/paipu.json'),w=read('/tmp/development/wallOrder.json'),r=read('/tmp/development/l2-receipt.json'),m=read('/tmp/development/manifest.json'),a=m.rows[0].cpuAudit;
   check(m.seed===expected.seed&&p.qijia===expected.dealer,'seed/dealer');check(sha(p.rule)===expected.ruleHash&&sha(r.rule)===expected.ruleHash,'rule drift');
   check(r.decisionIndex===expected.decisionIndex&&r.actorSeat===expected.actorSeat&&r.mode===mode,'receipt identity');
   check(sha(r.publicRequest)===expected.publicHash,'public view drift');check(sha(r.prefix)===expected.prefixHash,'prefix drift');check(sha(r.policyOriginal)===expected.originalActionHash,'original action drift');
   check(sha(r.applied)===(mode==='baseline'?expected.originalActionHash:expected.alternativeActionHash),'applied choice drift');
   check(r.legalPayloads.some(x=>sha(x)===expected.originalActionHash)&&r.legalPayloads.some(x=>sha(x)===expected.alternativeActionHash),'legal set drift');
   const round=r.prefix.length-1,index=r.prefix[round].length;check(same(p.log.slice(0,round).concat([p.log[round].slice(0,index)]),r.prefix),'output prefix drift');check(p.log[round][index]?.dapai?.l===r.actorSeat&&p.log[round][index].dapai.p===r.applied.dapai,'logged action drift');
   check(a.fallbacks===0&&a.sharedWorker&&a.activeSeats===3&&a.model+a.forced===a.decisions,'CPU audit');
   check(p.score.reduce((x,y)=>x+y,0)===100000&&same(p.rank.slice().sort(),[1,2,3,4]),'score/rank');const order=[0,1,2,3].sort((a,b)=>p.score[b]-p.score[a]||((a-p.qijia+4)%4)-((b-p.qijia+4)%4));check(order.every((id,i)=>p.rank[id]===i+1),'tie order');
   check(w.length===p.log.length,'wall count');for(const wall of w){let tiles=wall.split(','),c={};for(const t of tiles){const k=t.replace('0','5');c[k]=(c[k]||0)+1}check(tiles.length===136&&Object.keys(c).length===34&&Object.values(c).every(x=>x===4)&&['m','p','s'].every(x=>tiles.filter(t=>t===x+'0').length===1),'wall physical');}
   if(mode==='baseline')check(sha(p.log)===expected.logHash&&sha(w)===expected.wallHash,'baseline full replay mismatch');
   result.push({p,w,r});
   console.log('BRANCH_TECHNICAL_PASS='+mode);
 }
 const [a,b]=result;check(same(a.r.state,b.r.state)&&same(a.r.legalPayloads,b.r.legalPayloads),'prestate/legal divergence');
 const wallMap=x=>{const seen={},o=new Map();x.p.log.forEach((es,i)=>{const q=es[0].qipai,k=[q.zhuangfeng,q.jushu,q.changbang].join(':'),n=seen[k]||0;seen[k]=n+1;o.set(k+':'+n,x.w[i])});return o};let common=0;const aw=wallMap(a),bw=wallMap(b);for(const [k,v] of aw)if(bw.has(k)){check(v===bw.get(k),'common wall mismatch');common++}check(common>=a.r.prefix.length,'shared wall undercoverage');
 console.log('L2_SMOKE_PASS pairs=1 commonWallKeys='+common+' fullBaseline=1 legalAction=1 privateScopePoisonAudit=0 strategicCertification=0');
}
try{run()}catch(e){console.log('L2_SMOKE_FAILED='+String(e.message).slice(0,100));process.exitCode=1}finally{for(const p of ['/tmp/development','/tmp/l2-private.log','/tmp/l2-plan.json'])fs.rmSync(p,{recursive:true,force:true})}
