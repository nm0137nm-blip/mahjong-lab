// Exploratory 120 pairs: each job independently verifies a frozen 20-source cell before publishing only aggregated outcomes.
import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';import {patchPinnedRunner} from './patch-first-riichi-runner.mjs';
const check=(v,m)=>{if(!v)throw Error(m)},sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex'),same=(a,b)=>sha(a)===sha(b);
const plan=JSON.parse(fs.readFileSync('handoff/learning-l2/exploratory-120-plan.json','utf8'));
check(plan.schema==='l2-exploratory-120-v1'&&plan.groups.length===6&&plan.groups.every(g=>g.rows.length===20)&&new Set(plan.groups.flatMap(g=>g.rows.map(r=>r[0]))).size===120,'frozen plan invalid');
const group=plan.groups[Number(process.env.L2_GROUP)];check(group&&Number.isInteger(Number(process.env.L2_GROUP)),'group missing');
const remainingCases=group.rows.map(row=>({...Object.fromEntries(['shard','seed','dealer','decisionIndex','actorSeat'].map((k,i)=>[k,row[i]])),cell:group.cell}));
const sources=[];
const ruleHash='3acee28840a6c152702f49b136ce82e5afebcb90d6187b50a3f5b7eb052fa10f';
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
   check(m.seed===expected.seed&&p.qijia===expected.dealer,'seed/dealer');check(sha(p.rule)===ruleHash&&sha(r.rule)===ruleHash,'rule drift');
   check(r.decisionIndex===expected.decisionIndex&&r.actorSeat===expected.actorSeat&&r.mode===mode,'receipt identity');
   const original=r.policyOriginal,alternative={dapai:original.dapai.slice(0,-1)};
   check(original.dapai.endsWith('*')&&same(r.applied,mode==='baseline'?original:alternative),'applied choice drift');
   check(r.legalPayloads.some(x=>same(x,original))&&r.legalPayloads.some(x=>same(x,alternative)),'legal set drift');
   if(mode==='baseline'){
     const source={shard:expected.shard,seed:m.seed,dealer:p.qijia,decisionIndex:r.decisionIndex,actorSeat:r.actorSeat,publicHash:sha(r.publicRequest),prefixHash:sha(r.prefix),logHash:sha(p.log),wallHash:sha(w),ruleHash:sha(p.rule),originalActionHash:sha(original),alternativeActionHash:sha(alternative),cell:expected.cell};
     sources.push(source); // whole-cell source commitment must match before any outcomes are released
   }else{
     const base=result[0].r;
     check(same(base.publicRequest,r.publicRequest)&&same(base.prefix,r.prefix)&&same(base.policyOriginal,original),'alternative source drift');
   }
   const round=r.prefix.length-1,index=r.prefix[round].length;check(same(p.log.slice(0,round).concat([p.log[round].slice(0,index)]),r.prefix),'output prefix drift');check(p.log[round][index]?.dapai?.l===r.actorSeat&&p.log[round][index].dapai.p===r.applied.dapai,'logged action drift');
   check(a.fallbacks===0&&a.sharedWorker&&a.activeSeats===3&&a.model+a.forced===a.decisions,'CPU audit');
   check(p.score.reduce((x,y)=>x+y,0)===100000&&same(p.rank.slice().sort(),[1,2,3,4]),'score/rank');const order=[0,1,2,3].sort((a,b)=>p.score[b]-p.score[a]||((a-p.qijia+4)%4)-((b-p.qijia+4)%4));check(order.every((id,i)=>p.rank[id]===i+1),'tie order');
   check(w.length===p.log.length,'wall count');for(const wall of w){let tiles=wall.split(','),c={};for(const t of tiles){const k=t.replace('0','5');c[k]=(c[k]||0)+1}check(tiles.length===136&&Object.keys(c).length===34&&Object.values(c).every(x=>x===4)&&['m','p','s'].every(x=>tiles.filter(t=>t===x+'0').length===1),'wall physical');}
   result.push({p,w,r});
   console.log('BRANCH_TECHNICAL_PASS shard='+expected.shard+' mode='+mode);
 }
 const [a,b]=result;check(same(a.r.state,b.r.state)&&same(a.r.legalPayloads,b.r.legalPayloads),'prestate/legal divergence');
 const wallMap=x=>{const seen={},o=new Map();x.p.log.forEach((es,i)=>{const q=es[0].qipai,k=[q.zhuangfeng,q.jushu,q.changbang].join(':'),n=seen[k]||0;seen[k]=n+1;o.set(k+':'+n,x.w[i])});return o};let common=0;const aw=wallMap(a),bw=wallMap(b);for(const [k,v] of aw)if(bw.has(k)){check(v===bw.get(k),'common wall mismatch');common++}check(common>=a.r.prefix.length,'shared wall undercoverage');
 const counters=await auditPrivatePackets([a.p,b.p]);
 const payload={riichi:a.p,dama:b.p,roundIndex:a.r.prefix.length-1,actorId:0};
 const accounting=spawnSync('python3',['handoff/learning-l2/variance-accounting.py'],{input:JSON.stringify(payload),encoding:'utf8',maxBuffer:1048576});
 check(accounting.status===0,'independent settlement accounting failed');
 const values=JSON.parse(accounting.stdout);check(['riichiRound','damaRound','deltaRound','deltaFinal','deltaFourth'].every(k=>Number.isSafeInteger(values[k])),'invalid paired outcomes');
 console.log('L2_EXPLORATORY_TECHNICAL_PASS shard='+expected.shard+' commonWallKeys='+common+' packetPoison='+JSON.stringify(counters));
 return values;
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
 const n=xs.length,m=mean(xs),s=sd(xs),half=2.093024054*s/Math.sqrt(n);
 let rng=173119;const boot=[];
 for(let b=0;b<2000;b++){let sum=0;for(let i=0;i<n;i++){rng=(Math.imul(rng,1664525)+1013904223)>>>0;sum+=xs[Math.floor(rng/4294967296*n)]}boot.push(sum/n)}
 boot.sort((a,b)=>a-b);
 return {n,mean:m,sd:s,t95:[m-half,m+half],bootstrap95:[boot[49],boot[1949]],distinct:new Set(xs).size};
};
try{
 for(const expected of remainingCases){
  fs.writeFileSync(runner,pristine);fs.writeFileSync(html,initialHtml);fs.writeFileSync(coach,initialCoach);
  outcomes.push(await run(expected));
 }
 check(outcomes.length===20&&sources.length===20&&sha(sources)===group.sourceHash,'frozen whole-cell source commitment mismatch');
 const primary=summarize(outcomes.map(x=>x.deltaRound));
 const result={schema:'l2-exploratory-120-cell-v1',cell:group.cell,frameN:group.frameN,n:20,sourceCommitmentVerified:true,primaryRoundRiichiMinusDama:primary,secondaryFinal:summarize(outcomes.map(x=>x.deltaFinal)),secondaryFourth:summarize(outcomes.map(x=>x.deltaFourth)),meanRiichiRound:mean(outcomes.map(x=>x.riichiRound)),meanDamaRound:mean(outcomes.map(x=>x.damaRound)),fourthDiscordant:{riichiOnly:outcomes.filter(x=>x.deltaFourth===1).length,damaOnly:outcomes.filter(x=>x.deltaFourth===-1).length},primaryPrecisionGate:primary.t95[1]-primary.t95[0]<=1000&&primary.bootstrap95[1]-primary.bootstrap95[0]<=1000&&primary.distinct>=5,scope:'exploratory S42 selected first riichi; one decision per hanchan; no strategy recommendation or human generalization'};
 console.log('L2_EXPLORATORY_CELL='+JSON.stringify(result));
}catch(e){console.log('L2_EXPLORATORY_FAILED completed='+outcomes.length+' category='+String(e.message).slice(0,100));process.exitCode=1}
finally{for(const p of ['/tmp/development','/tmp/l2-private.log','/tmp/l2-plan.json'])fs.rmSync(p,{recursive:true,force:true})}
