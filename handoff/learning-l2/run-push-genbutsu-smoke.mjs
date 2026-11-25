// Remaining four pre-selected technical smoke pairs. No publication of raw receipts, actions, or outcomes.
import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';import {patchPinnedRunner} from './patch-push-genbutsu-runner.mjs';
const check=(v,m)=>{if(!v)throw Error(m)},sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex'),same=(a,b)=>sha(a)===sha(b);
const remainingCases=[
  {
    "shard": 665,
    "seed": 4102569599,
    "dealer": 0,
    "decisionIndex": 95,
    "actorSeat": 3,
    "band": "early",
    "publicHash": "383918d0c4ae664e3afe790185a31d2ca1740e97340c7997c348089f79df7997",
    "prefixHash": "f197e77d2ddbbb36394c5176444f5a8f63a8aee3c50bfaf8dc97817a8d7641c1",
    "logHash": "2c8a4ec1c464ca094c9722fe30b6db7fa8023a4d9194ec359c61f2e17bb3e84c",
    "wallHash": "d15752b4a6f022c9f6ab7ffff4f8b64b6d360aeb1081441c2d33509318657e1a",
    "originalActionHash": "68a53c2a621ff0973be9ffc2173c438f7f0dd5f33e0556dc8d7090d816a84838",
    "alternativeActionHash": "647f15c638354f425c8b0656e1caa38046b9b37f697fb7e8611f38b60b82753b",
    "ruleHash": "3acee28840a6c152702f49b136ce82e5afebcb90d6187b50a3f5b7eb052fa10f"
  },
  {
    "shard": 972,
    "seed": 4045480718,
    "dealer": 3,
    "decisionIndex": 114,
    "actorSeat": 2,
    "band": "mid",
    "publicHash": "08499d3b6de5ec9fa4b2e8273fd0fab78307c856da5a5db8ac09f8e795976601",
    "prefixHash": "26f132ae59c46c7bf23cae1cd59a893a6c328e277a7a4c5260e29b2eba222be2",
    "logHash": "1a9a016ef626de2d2aafdc5a5c5d042ed1029f2f61373bd481ec5d3432916e48",
    "wallHash": "9838d81a89fd4b89ede4bdeeb9c054e06670275a93a5fa651a559728e305c504",
    "originalActionHash": "b5642d701be810ef3e041b413ff991e443b86d3e4cfcb9e3dc7a81f4472e4c9c",
    "alternativeActionHash": "c7e4f45f8cc66e40bb76b9ddb3bcaa982aa59b725a0a3978de992cdc3c2bee0f",
    "ruleHash": "3acee28840a6c152702f49b136ce82e5afebcb90d6187b50a3f5b7eb052fa10f"
  },
  {
    "shard": 231,
    "seed": 133835446,
    "dealer": 2,
    "decisionIndex": 18,
    "actorSeat": 2,
    "band": "late",
    "publicHash": "4c47b615f2ca72d8346e6cb94e4b8e1b69b61ace188b0e9efad95e3dbb3f18ae",
    "prefixHash": "0a4c54bec9af54d282a4acb5e23f259811907a5d27ca0b8c45644aa30da86238",
    "logHash": "1c4ce8da5250d72e433363129b734c62e0f2a716683524165c5ba183d9b86b0b",
    "wallHash": "a910f9c3e1e54335d48d5fb440e353bdf0ee9134f5ba2ea3601dded549359e6f",
    "originalActionHash": "42e3ae9c97435a7c9221d29758b5c33a6ef1b8dd44a3f8b01fa986bcca714c89",
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
   fs.writeFileSync('/tmp/l2-plan.json',JSON.stringify({mode,decisionIndex:expected.decisionIndex,band:expected.band}),{mode:0o600});
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
 console.log('L2_PUSH_TECH_PASS shard='+expected.shard+' pairs=1 commonWallKeys='+common+' fullBaseline=1 legalAction=1 packetPoison='+JSON.stringify(counters)+' strategicCertification=0');
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
console.log('L2_PUSH_TECH_SUMMARY pass='+passes+' fail='+failures);
try{if(failures||passes!==remainingCases.length)throw Error('remaining case gate')}catch(e){console.log('L2_SMOKE_FAILED='+String(e.message).slice(0,100));process.exitCode=1}finally{for(const p of ['/tmp/development','/tmp/l2-private.log','/tmp/l2-plan.json'])fs.rmSync(p,{recursive:true,force:true})}
