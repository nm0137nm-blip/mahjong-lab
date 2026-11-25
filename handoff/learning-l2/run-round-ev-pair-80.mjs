// Remaining four pre-selected technical smoke pairs. No publication of raw receipts, actions, or outcomes.
import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';import {patchPinnedRunner} from './patch-push-genbutsu-runner.mjs';
const check=(v,m)=>{if(!v)throw Error(m)},sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex'),same=(a,b)=>sha(a)===sha(b);
const plan=JSON.parse(fs.readFileSync('handoff/learning-l2/round-ev-pair-80-plan.json','utf8'));
check(plan.schema==='round-ev-new-pair-v2'&&plan.groups.length===4&&plan.groups.every(g=>g.rows.length===20)&&new Set(plan.groups.flatMap(g=>g.rows.map(r=>r[0]))).size===80,'invalid frozen plan');
const group=plan.groups[Number(process.env.L2_GROUP)];check(group&&Number.isInteger(Number(process.env.L2_GROUP)),'missing group');
const remainingCases=group.rows.map(row=>({...Object.fromEntries(['shard','seed','dealer','decisionIndex','actorSeat','logHashPrefix','originalHashPrefix','alternativeHashPrefix','predictedDelta'].map((k,i)=>[k,row[i]])),band:group.band}));
const ruleHash='3acee28840a6c152702f49b136ce82e5afebcb90d6187b50a3f5b7eb052fa10f',sources=[];

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
   check(m.seed===expected.seed&&p.qijia===expected.dealer,'seed/dealer');check(sha(p.rule)===ruleHash&&sha(r.rule)===ruleHash,'rule drift');
   check(r.decisionIndex===expected.decisionIndex&&r.actorSeat===expected.actorSeat&&r.mode===mode,'receipt identity');
   check(r.legalPayloads.some(x=>same(x,r.policyOriginal))&&r.legalPayloads.some(x=>same(x,r.applied)),'legal set drift');
   if(mode==='baseline')check(same(r.applied,r.policyOriginal),'baseline action drift');
   else check(!same(r.applied,r.policyOriginal)&&same(r.publicRequest,result[0].r.publicRequest)&&same(r.prefix,result[0].r.prefix)&&same(r.policyOriginal,result[0].r.policyOriginal),'alternate source drift');
   const round=r.prefix.length-1,index=r.prefix[round].length;check(same(p.log.slice(0,round).concat([p.log[round].slice(0,index)]),r.prefix),'output prefix drift');check(p.log[round][index]?.dapai?.l===r.actorSeat&&p.log[round][index].dapai.p===r.applied.dapai,'logged action drift');
   check(a.fallbacks===0&&a.sharedWorker&&a.activeSeats===3&&a.model+a.forced===a.decisions,'CPU audit');
   check(p.score.reduce((x,y)=>x+y,0)===100000&&same(p.rank.slice().sort(),[1,2,3,4]),'score/rank');const order=[0,1,2,3].sort((a,b)=>p.score[b]-p.score[a]||((a-p.qijia+4)%4)-((b-p.qijia+4)%4));check(order.every((id,i)=>p.rank[id]===i+1),'tie order');
   check(w.length===p.log.length,'wall count');for(const wall of w){let tiles=wall.split(','),c={};for(const t of tiles){const k=t.replace('0','5');c[k]=(c[k]||0)+1}check(tiles.length===136&&Object.keys(c).length===34&&Object.values(c).every(x=>x===4)&&['m','p','s'].every(x=>tiles.filter(t=>t===x+'0').length===1),'wall physical');}
   result.push({p,w,r});
   console.log('BRANCH_TECHNICAL_PASS shard='+expected.shard+' mode='+mode);
 }
 const [a,b]=result;check(sha(a.p.log).startsWith(expected.logHashPrefix)&&sha(a.r.policyOriginal).startsWith(expected.originalHashPrefix)&&sha(b.r.applied).startsWith(expected.alternativeHashPrefix),'source log or action commitment mismatch');check(same(a.r.state,b.r.state)&&same(a.r.legalPayloads,b.r.legalPayloads),'prestate/legal divergence');
 const wallMap=x=>{const seen={},o=new Map();x.p.log.forEach((es,i)=>{const q=es[0].qipai,k=[q.zhuangfeng,q.jushu,q.changbang].join(':'),n=seen[k]||0;seen[k]=n+1;o.set(k+':'+n,x.w[i])});return o};let common=0;const aw=wallMap(a),bw=wallMap(b);for(const [k,v] of aw)if(bw.has(k)){check(v===bw.get(k),'common wall mismatch');common++}check(common>=a.r.prefix.length,'shared wall undercoverage');
 const counters=await auditPrivatePackets([a.p,b.p]);
 sources.push({shard:expected.shard,seed:expected.seed,dealer:a.p.qijia,decisionIndex:a.r.decisionIndex,actorSeat:a.r.actorSeat,band:expected.band,publicHash:sha(a.r.publicRequest),prefixHash:sha(a.r.prefix),logHash:sha(a.p.log),wallHash:sha(a.w),ruleHash:sha(a.p.rule),originalActionHash:sha(a.r.policyOriginal),alternativeActionHash:sha(b.r.applied)});
 const acc=spawnSync('python3',['handoff/learning-l2/variance-accounting.py'],{input:JSON.stringify({riichi:a.p,dama:b.p,roundIndex:a.r.prefix.length-1,actorId:0}),encoding:'utf8',maxBuffer:1048576});
 check(acc.status===0,'independent settlement accounting failed');const values=JSON.parse(acc.stdout);
 check(['riichiRound','damaRound','deltaRound','deltaFinal','deltaFourth'].every(k=>Number.isSafeInteger(values[k])),'invalid outcomes');
 console.log('L2_PUSH_EXPLORATORY_PAIR_PASS shard='+expected.shard+' commonWallKeys='+common+' packetPoison='+JSON.stringify(counters));return {...values,predictedDelta:expected.predictedDelta,error:expected.predictedDelta-values.deltaRound};
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
const outcomes=[];
const mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
const sd=xs=>Math.sqrt(xs.reduce((a,b)=>a+(b-mean(xs))**2,0)/(xs.length-1));
const summarize=xs=>{
 const n=xs.length,m=mean(xs),s=sd(xs),half=2.093024054*s/Math.sqrt(n);let rng=173119;const boot=[];
 for(let b=0;b<2000;b++){let sum=0;for(let i=0;i<n;i++){rng=(Math.imul(rng,1664525)+1013904223)>>>0;sum+=xs[Math.floor(rng/4294967296*n)]}boot.push(sum/n)}
 boot.sort((a,b)=>a-b);return {n,mean:m,sd:s,t95:[m-half,m+half],bootstrap95:[boot[49],boot[1949]],distinct:new Set(xs).size};
};
try{
 for(const expected of remainingCases){fs.writeFileSync(runner,pristine);fs.writeFileSync(html,initialHtml);fs.writeFileSync(coach,initialCoach);outcomes.push(await run(expected))}
 check(outcomes.length===20&&sources.length===20,'frozen source commitment mismatch');
 const primary=summarize(outcomes.map(x=>x.deltaRound));
 const error=summarize(outcomes.map(x=>x.error));console.log('ROUND_EV_PAIR_CELL='+JSON.stringify({schema:'round-ev-new-pair-v2',group:Number(process.env.L2_GROUP),band:group.band,n:20,sourceCommitmentsVerified:true,actual:primary,predicted:summarize(outcomes.map(x=>x.predictedDelta)),error,precisionGate:error.t95[1]-error.t95[0]<=1000,scope:'new extension development-only diagnostic; out-of-fold model prediction frozen; one-step intervention; not a general causal estimate'}));
}catch(e){console.log('L2_PUSH_EXPLORATORY_FAILED completed='+outcomes.length+' category='+String(e.message).slice(0,100));process.exitCode=1}
finally{for(const p of ['/tmp/development','/tmp/l2-private.log','/tmp/l2-plan.json'])fs.rmSync(p,{recursive:true,force:true})}
