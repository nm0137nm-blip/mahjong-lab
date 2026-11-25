// Remaining four pre-selected technical smoke pairs. No publication of raw receipts, actions, or outcomes.
import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';import {patchPinnedRunner} from './patch-first-riichi-runner.mjs';
const check=(v,m)=>{if(!v)throw Error(m)},sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex'),same=(a,b)=>sha(a)===sha(b);
const remainingCases=[
  {
    "shard": 3,
    "seed": 3783714667,
    "dealer": 2,
    "decisionIndex": 29,
    "actorSeat": 1,
    "publicHash": "15c97f96966b6edf6ce5ffc9559a9b958ac131ef56787f570ba1ec1a74285cde",
    "prefixHash": "f5f23a50dbdedb04ec0bc5fbfd69136e3278dc3849e12d1693fe961cbaf3c447",
    "logHash": "afb722810d4d480d4d4995d392ced73da20a9b0049ca8a474f29b45b2325ff7a",
    "wallHash": "de468927a02bb41b8f21eabc28ffaa5d7fa4a3e6e1892ef8a97231ba27133f10",
    "originalActionHash": "3d931909f3c47cbd928ab7ad85702e2dc36a882729662cc85de9d6c6bfa624ea",
    "alternativeActionHash": "32ce92f16d02c8d365564206514e1b3e230f6eb6d7a4e7cd95aa822af846c607",
    "ruleHash": "3acee28840a6c152702f49b136ce82e5afebcb90d6187b50a3f5b7eb052fa10f"
  },
  {
    "shard": 4,
    "seed": 1235711231,
    "dealer": 3,
    "decisionIndex": 4,
    "actorSeat": 1,
    "publicHash": "c530325f149e4db0fe633f3763969105d364c7a2a00a3842af09f3e7eefee907",
    "prefixHash": "55dd322ee0f470f0e5ba3c00a5d2b7c6a4df8f262e8bb084b5c2785722580cb0",
    "logHash": "b095293fa9e856238e0bb9944b0178cb8cd6447a6b789ae8a7cbd8c3fc4bb1a6",
    "wallHash": "116a05655d1c2edcc3fecec7f29085865dd2306b18bce24e8417ad9fe8a21c1e",
    "originalActionHash": "668fd6b542b78a8313cdd07a08719e8246baae92de4ed37d5edf95068a274940",
    "alternativeActionHash": "eace5879051f18f390cae9c9cd867e7f76549bce45f6320e6cb64e87c8ce28d3",
    "ruleHash": "3acee28840a6c152702f49b136ce82e5afebcb90d6187b50a3f5b7eb052fa10f"
  },
  {
    "shard": 5,
    "seed": 1588703502,
    "dealer": 0,
    "decisionIndex": 90,
    "actorSeat": 2,
    "publicHash": "9c2a72128a9d493577a99c1f799543793da94e0892e86535be1d1840e781a583",
    "prefixHash": "4f19cdbfcbadbabf2b22d9ed6b2da07fb6fbf7f0d36c5abbe02c359448dc0a69",
    "logHash": "a6e9420c205a13b7c8057da1b7e1e78f1335b7286c3be2a465a7599637c80ee8",
    "wallHash": "b677a3855dd42ad59b8783861091f8560ed183501da2fdadc1935f00abe8e449",
    "originalActionHash": "668fd6b542b78a8313cdd07a08719e8246baae92de4ed37d5edf95068a274940",
    "alternativeActionHash": "eace5879051f18f390cae9c9cd867e7f76549bce45f6320e6cb64e87c8ce28d3",
    "ruleHash": "3acee28840a6c152702f49b136ce82e5afebcb90d6187b50a3f5b7eb052fa10f"
  },
  {
    "shard": 6,
    "seed": 2202078673,
    "dealer": 1,
    "decisionIndex": 6,
    "actorSeat": 3,
    "publicHash": "0771d631612398b39a40e2cf8dcc5da8597b0a00e979936984f90e34df25d897",
    "prefixHash": "addecab4eb274d0f0cf81ddc78543e0bfe571b979ff70b2b2f3dcf329e49b5e4",
    "logHash": "b6667e3c93338e2b1120ecb53deb5c4395dd67d73c9e2beb0982522fb929c1d9",
    "wallHash": "dec04e19fa601446031233d49fd5459580970d4da3f15c3bc9c6e53f52cda7a9",
    "originalActionHash": "224be06c56ca6797cb1a84c44e8f4e05248793f26a8b4d3ac81055a9506b33f9",
    "alternativeActionHash": "875ef22484562ec8c253712d1a480afc338bdd7d53d0e49ca43a74936caaae1e",
    "ruleHash": "3acee28840a6c152702f49b136ce82e5afebcb90d6187b50a3f5b7eb052fa10f"
  }
];
const lab='/tmp/lab',runner=path.join(lab,'tests/next/run-p1-v2-dev.cjs'),html=path.join(lab,'index.html'),coach=path.join(lab,'src/coach/phoenix-coach.mjs');
function read(p){return JSON.parse(fs.readFileSync(p,'utf8'))}
async function run(expected){
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
   console.log('BRANCH_TECHNICAL_PASS shard='+expected.shard+' mode='+mode);
 }
 const [a,b]=result;check(same(a.r.state,b.r.state)&&same(a.r.legalPayloads,b.r.legalPayloads),'prestate/legal divergence');
 const wallMap=x=>{const seen={},o=new Map();x.p.log.forEach((es,i)=>{const q=es[0].qipai,k=[q.zhuangfeng,q.jushu,q.changbang].join(':'),n=seen[k]||0;seen[k]=n+1;o.set(k+':'+n,x.w[i])});return o};let common=0;const aw=wallMap(a),bw=wallMap(b);for(const [k,v] of aw)if(bw.has(k)){check(v===bw.get(k),'common wall mismatch');common++}check(common>=a.r.prefix.length,'shared wall undercoverage');
 const counters=await auditPrivatePackets([a.p,b.p]);
 console.log('L2_SMOKE_PASS shard='+expected.shard+' pairs=1 commonWallKeys='+common+' fullBaseline=1 legalAction=1 packetPoison='+JSON.stringify(counters)+' strategicCertification=0');
}

// Separate replay of sanitized actual-log events through pinned bridge and packet guard.
// Tests known private fields rejected and extra fields ignored; not a full live inference proof.
async function auditPrivatePackets(matches){
 const {MortalMjaiBridge}=await import('/tmp/lab/src/mortal/mjai-bridge.mjs?v=2601');
 const {assertPrivatePacket}=await import('/tmp/lab/src/mortal/mortal-cpu.mjs');
 let packets=0,ignored=0,rejectedHands=0,rejectedDraws=0;
 const mustReject=(packet,bridge)=>{let rejected=false;try{assertPrivatePacket(packet,bridge)}catch(e){rejected=true}check(rejected,'private packet accepted');};
 for(const p of matches)for(const hand of p.log)for(let seat=0;seat<4;seat++){
   const a=new MortalMjaiBridge(),b=new MortalMjaiBridge();
   for(const raw of hand){
     const packet=structuredClone(raw);
     if(packet.qipai){
       mustReject(packet,a);rejectedHands++;
       packet.qipai.shoupai=packet.qipai.shoupai.map((x,i)=>i===seat?x:'');
     }
     const z=packet.zimo||packet.gangzimo;
     if(z&&z.l!==seat){check(z.p!==''&&typeof z.p==='string','missing original draw');mustReject(packet,a);rejectedDraws++;z.p='';}
     assertPrivatePacket(packet,a);assertPrivatePacket(packet,b);
     const poisoned=structuredClone(packet);
     const trap=()=>{throw Error('unexpected private-field read')};
     for(const key of ['wall','hiddenOracle','opponentHands','privateState'])Object.defineProperty(poisoned,key,{get:trap});
     const key=Object.keys(packet)[0];if(poisoned[key]&&typeof poisoned[key]==='object')for(const name of ['wall','hiddenOracle','opponentHands','privateState'])Object.defineProperty(poisoned[key],name,{get:trap});
     const x=a.receive(packet),y=b.receive(poisoned);check(same(x,y),'bridge event changed under poison');packets++;ignored++;
   }
 }
 check(packets>0&&rejectedHands>0&&rejectedDraws>0,'packet poison coverage');
 return {packets,ignored,rejectedHands,rejectedDraws};
}
const pristine=fs.readFileSync(runner);
const initialHtml=fs.readFileSync(html),initialCoach=fs.readFileSync(coach);
let passes=0,failures=0;
for(const expected of remainingCases){
 try{fs.writeFileSync(runner,pristine);fs.writeFileSync(html,initialHtml);fs.writeFileSync(coach,initialCoach);await run(expected);passes++}
 catch(e){failures++;console.log('L2_CASE_FAILED shard='+expected.shard+' category='+String(e.message).slice(0,100))}
}
console.log('L2_REMAINING_SUMMARY pass='+passes+' fail='+failures);
try{if(failures||passes!==remainingCases.length)throw Error('remaining case gate')}catch(e){console.log('L2_SMOKE_FAILED='+String(e.message).slice(0,100));process.exitCode=1}finally{for(const p of ['/tmp/development','/tmp/l2-private.log','/tmp/l2-plan.json'])fs.rmSync(p,{recursive:true,force:true})}
