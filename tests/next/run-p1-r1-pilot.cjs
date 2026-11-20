// Development-only paired arena. No hidden teacher extraction.
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const readline=require('node:readline');
const crypto=require('node:crypto');
const {chromium}=require('/tmp/probe/node_modules/playwright');
const root=path.resolve(__dirname,'../..');
if(root!=='/tmp/lab'||process.env.GITHUB_ACTIONS!=='true'||process.env.COACH_ARENA_QA!=='1')throw Error('disposable CI checkout only');
const htmlPath=path.join(root,'index.html');
let html=fs.readFileSync(htmlPath,'utf8');
function replaceOnce(a,b){if(html.split(a).length!==2)throw Error('invalid patch anchor '+a);html=html.replace(a,b);}
const anchor='  window.MahjongLabMortalCpuAudit=()=>';
const patch="  let arenaNextPolicy=null,arenaFocalEvaluator=null;\n  // Use the actual bundled standard AI, not a simplified efficiency substitute.\n  // Only its own engine event packets are supplied, and its callbacks are checked.\n  class ArenaBasic extends AI {\n    constructor(){super();this.arenaAudit={events:0,replies:0,actions:0,invalid:0};}\n    action(msg,cb){\n      const audit=this.arenaAudit; audit.events++;\n      const fail=reason=>{audit.invalid++;throw Error('standard CPU: '+reason);};\n      if(msg.qipai){\n        const h=msg.qipai.shoupai;\n        if(!Array.isArray(h)||h.length!==4||h.filter(x=>typeof x==='string'&&x.length>0).length!==1||h.some(x=>typeof x!=='string'))fail('private qipai');\n      }\n      const z=msg.zimo||msg.gangzimo;\n      if(z&&z.l!==this._menfeng&&z.p!=='')fail('private draw');\n      if(!cb)return super.action(msg,cb);\n      return super.action(msg,raw=>{\n        const out=raw||{};const h=(z||msg.dapai||msg.gang||msg.fulou)?this.shoupai:null;\n        audit.replies++;\n        const d=msg.dapai,g=msg.gang,f=msg.fulou;\n        const ownDraw=z&&z.l===this._menfeng;\n        const ownCall=f&&f.l===this._menfeng&&!/^[mpsz]\\d{4}/.test(f.m);\n        if(ownDraw||ownCall){\n          if(out.dapai){\n            const pick=out.dapai.replace(/\\*$/,'');\n            if(!(this.get_dapai(h)||[]).includes(pick)||out.dapai.endsWith('*')&&(!ownDraw||!this.allow_lizhi(h,pick)))fail('illegal discard/riichi');\n          }else if(ownDraw&&out.hule){if(!this.allow_hule(h,null,!!msg.gangzimo))fail('illegal tsumo');}\n          else if(ownDraw&&out.gang){if(!(this.get_gang_mianzi(h)||[]).includes(out.gang))fail('illegal kan');}\n          else if(ownDraw&&out.daopai){if(!this.allow_pingju(h))fail('illegal abort');}\n          else fail('missing turn response');\n          audit.actions++;\n        }else if(out.fulou){\n          if(!d||d.l===this._menfeng)fail('call outside reaction');\n          const t=d.p.slice(0,2)+['','+','=','-'][(4+d.l-this._menfeng)%4];\n          const legal=[...(this.get_chi_mianzi(h,t)||[]),...(this.get_peng_mianzi(h,t)||[]),...(this.get_gang_mianzi(h,t)||[])];\n          if(!legal.includes(out.fulou))fail('illegal call');\n          audit.actions++;\n        }else if(out.hule){\n          const a=d||g;\n          if(!a||a.l===this._menfeng)fail('ron outside reaction');\n          const tile=d?d.p.slice(0,2):g.m[0]+g.m.slice(-1);\n          const t=tile+['','+','=','-'][(4+a.l-this._menfeng)%4];\n          if(g&&/^[mpsz]\\d{4}$/.test(g.m)||!this.allow_hule(h,t,!!g))fail('illegal ron');\n          audit.actions++;\n        }else if(out.dapai||out.gang)fail('unexpected turn action');\n        cb(out);\n      });\n    }\n  }\n  window.MahjongLabArenaSelect=policy=>{\n    if(!['s42','learned','basic'].includes(policy)||game&&!gameEnded)throw Error('arena policy before match only');\n    arenaNextPolicy=policy;\n  };\n  let arenaPolicy=null,arenaTicket=null,arenaCount=0,arenaForced=0,arenaBlind=null;\n  let qaPublic=[],qaOracle=[],qaReference=[];\n  const p1Capture=function p1Capture(game,M,own,pending,tileList,human){\n const model=game.model,norm=t=>t.slice(0,2).replace('0','5');\n if(model.lunban!==own)throw Error('teacher turn owner');\n const hand=h=>tileList(h).map(t=>t.slice(0,2)).sort().join(',');\n if(hand(model.shoupai[own])!==hand(human.shoupai))throw Error('oracle own hand alignment');\n const tiles=[...new Set((pending.options||[]).map(t=>t.slice(0,2)))].sort();\n const opponents=[],cap=game._rule['最大同時和了数'];\n if(![1,2,3].includes(cap))throw Error('unknown multiple Ron rule');\n for(let k=1;k<=3;k++){\n  const seat=(own+k)%4,h=model.shoupai[seat];\n  if(!h||h._zimo||tileList(h).length+3*h._fulou.length!==13)throw Error('unstable opponent hand');\n  const shanten=M.Util.xiangting(h),tenpai=shanten===0;\n  if(!Number.isInteger(shanten)||shanten<0)throw Error('bad shanten');\n  const waits=tenpai?[...new Set((M.Util.tingpai(h)||[]).map(norm))].sort():[];\n  const furiten=waits.some(t=>(model.he[seat]._pai||[]).map(norm).includes(t));\n  const canRon=game._neng_rong[seat];\n  if(![true,false,0,1].includes(canRon))throw Error('missing ron flag');\n  const legalRon={},baseLoss={},firstLoss={};\n  for(const t of tiles){\n   const p=t+'_+=-'[(4+own-seat)%4];\n   const legal=tenpai&&!furiten&&!!canRon&&!!M.Game.allow_hule(game._rule,h,p,model.zhuangfeng,seat,!!h.lizhi||model.shan.paishu===0,!!canRon);\n   legalRon[t]=legal;\n   if(!legal){baseLoss[t]=null;firstLoss[t]=null;continue;}\n   if(!waits.includes(norm(t)))throw Error('ron outside structural waits');\n   const param={rule:game._rule,zhuangfeng:model.zhuangfeng,menfeng:seat,hupai:{lizhi:game._lizhi[seat],yifa:game._yifa[seat],qianggang:false,lingshang:false,haidi:model.shan.paishu===0?2:0,tianhu:0},baopai:model.shan.baopai.slice(),fubaopai:null,jicun:{changbang:0,lizhibang:0}};\n   const score=b=>{const result=M.Util.hule(h.clone(),p,{...param,jicun:{changbang:b,lizhibang:0}});const loss=-result.fenpei?.[own];if(!result.hupai||!Number.isFinite(loss)||loss<=0)throw Error('legal ron without positive payment');return loss;};\n   baseLoss[t]=score(0);firstLoss[t]=score(model.changbang);\n   if(firstLoss[t]<baseLoss[t])throw Error('honba score regression');\n  }\n  opponents.push({seat,tenpai,shanten,structuralWaits:waits,riverFuriten:furiten,canRon:!!canRon,legalRon,baseLoss,firstLoss,privateHand:h.toString(),lizhi:game._lizhi[seat],ippatsu:!!game._yifa[seat]});\n }\n const allAcceptVisibleLoss={};\n for(const t of tiles){\n  let eligible=opponents.filter(o=>o.legalRon[t]);\n  if(cap===2&&eligible.length===3)eligible=[];\n  if(cap===1)eligible=eligible.slice(0,1);\n  allAcceptVisibleLoss[t]=eligible.reduce((n,o,i)=>n+(i?o.baseLoss[t]:o.firstLoss[t]),0);\n }\n // Excluding ura and any currently unrevealed kan dora by definition. This is\n // current-visible-indicator, all-eligible-accept counterfactual, NOT actual Ron choice or actual payment.\n return {version:'p1-visible-no-ura-v1',ownSeat:own,tiles,roundWind:model.zhuangfeng,honba:model.changbang,remaining:model.shan.paishu,visibleIndicators:model.shan.baopai.slice(),pendingKanDora:!!game._gang,multipleRonCap:cap,opponents,allAcceptVisibleLoss};\n};\n  const arenaOptions=c=>c.phase==='turn'?cpuModule.turnOptions(c.discards,c.riichiDiscards,c.kan,c.tsumo,c.nine):cpuModule.reactionOptions([...c.chi,...c.pon,...c.kan],c.ron);\n  window.MahjongLabArenaStart=async policy=>{\n    if(!game||gameEnded||!cpuAudit||!['s42','learned','basic'].includes(policy)||policy!==arenaNextPolicy)throw Error('arena start');\n    arenaBlind=(await import('./src/coach/s42-benchmark.mjs')).makePublicCase;\n    arenaPolicy=policy;arenaTicket=null;arenaCount=0;arenaForced=0;qaPublic=[];qaOracle=[];qaReference=[];debugUsed=true;\n  };\n  async function arenaExecute(choice,forced,prior=null,publicInput=null){\n    const p=choice.payload,index=decisionLog.length+1;\n    // Policy choice has already been irrevocably fixed, before any teacher read.\n    if(!forced){\n      const c=captureCoachChoices(pending),id='d-'+index,request=publicInput||arenaBlind({scene:captureS42Scene(),legalChoices:c,candidates:c.phase==='turn'?candidateInfo:[]},M,id);\n      const legal=arenaOptions(c);if(!arenaFocalEvaluator?.ready)throw Error('reference evaluator not ready');\n      const ref=prior||await arenaFocalEvaluator.evaluate();\n      const q=ref.q.map((v,i)=>ref.legal[i]?v:null);\n      if(JSON.stringify([...legal.keys()].sort((a,b)=>a-b))!==JSON.stringify(request.actions.map(x=>x.action))||JSON.stringify(q.flatMap((v,i)=>v!==null?[i]:[]))!==JSON.stringify(request.actions.map(x=>x.action)))throw Error('reference mask mismatch');\n      if(!legal.has(choice.action)||!Number.isFinite(q[choice.action]))throw Error('chosen group not legal');\n      const truth=c.phase==='turn'?p1Capture(game,M,ownSeat(),pending,tileList,human):null;\n      qaPublic.push({...request,id});qaReference.push({id,q,best:ref.best,chosen:choice.action,payload:p,phase:c.phase,grouped:!!choice.grouped});if(truth)qaOracle.push({id,...truth});\n    }\n    if(p.dapai){riichiMode=p.dapai.endsWith('*');chooseDiscard(p.dapai.replace(/\\*$/,''));}\n    else answer(p);\n    if(decisionLog.length!==index)throw Error('decision progression mismatch');\n    arenaCount++;arenaForced+=Number(forced);\n  }\n  window.MahjongLabArenaNext=async()=>{\n    if(!game||gameEnded||!pending)return null;\n    if(arenaTicket)throw Error('duplicate request');\n    const c=captureCoachChoices(pending),opts=arenaOptions(c);\n    if(!opts.size)throw Error('empty legal choices');\n    if(opts.size===1&&[...opts.values()][0].length===1){\n      await arenaExecute({payload:[...opts.values()][0][0]},true);return {acted:true};\n    }\n    if(arenaPolicy==='s42'){\n      if(!arenaFocalEvaluator?.ready)throw Error('focal native encoder not ready');\n      const r=await arenaFocalEvaluator.evaluate();\n      const choice=await cpuModule.resolveNativeAction(opts,r,arenaFocalEvaluator);\n      await arenaExecute(choice,false,r);\n      return {acted:true};\n    }\n    if(arenaPolicy!=='learned')throw Error('arena policy not configured');\n    // No Q, opinion, selected action, truth label or opponent private card in this request.\n    const id='arena-'+(arenaCount+1);\n    const request=arenaBlind({scene:captureS42Scene(),legalChoices:c,candidates:c.phase==='turn'?candidateInfo:[]},M,id);\n    if(JSON.stringify([...opts.keys()].sort((a,b)=>a-b))!==JSON.stringify(request.actions.map(a=>a.action)))throw Error('public legal mask mismatch');\n    arenaTicket={id,pending,opts,request};\n    return {request};\n  };\n  window.MahjongLabArenaReply=async result=>{\n    if(arenaPolicy!=='learned'||!arenaTicket||arenaTicket.pending!==pending||result.id!==arenaTicket.id)throw Error('stale policy response');\n    const opts=arenaTicket.opts;\n    const legal=Array(46).fill(0),q=Array(46).fill(null);\n    for(const [a,v] of result.scores||[]){\n      if(!opts.has(a)||legal[a]||!Number.isFinite(v))throw Error('bad model score');\n      legal[a]=1;q[a]=v;\n    }\n    if(!opts.has(result.action)||q[result.action]!==Math.max(...q.filter(Number.isFinite)))throw Error('invalid model choice');\n    const choice=cpuModule.resolveAction(opts,{best:result.action,q,legal});\n    const publicInput=arenaTicket.request;arenaTicket=null;await arenaExecute(choice,false,null,publicInput);\n  };\n  window.MahjongLabArenaResult=()=>{\n    if(!gameEnded||!debugUsed||arenaTicket||cpuAudit.fallbacks||arenaCount!==decisionLog.length||arenaPolicy==='basic'&&(human.arenaAudit?.invalid!==0||!human.arenaAudit?.actions))throw Error('incomplete arena');\n    const stats=summarizeMatch(game._paipu);\n    return {policy:arenaPolicy,rank:stats.rank,score:stats.score,hands:stats.hands,wins:stats.wins,dealIns:stats.dealIns,riichiHands:stats.riichiHands,openHands:stats.openHands,winPoints:stats.winPoints,decisions:arenaPolicy==='basic'?human.arenaAudit.actions:arenaCount,forced:arenaForced,standardAudit:arenaPolicy==='basic'?{...human.arenaAudit}:null,cpuAudit:MahjongLabMortalCpuAudit()};\n  };\n\n  window.MahjongLabDevelopmentExport=()=>{if(!gameEnded||arenaTicket||qaPublic.length!==qaReference.length||qaPublic.length+arenaForced!==arenaCount||qaOracle.length!==qaPublic.filter(x=>x.phase==='turn').length)throw Error('development capture coverage');return {public:qaPublic,reference:qaReference,oracle:qaOracle,forced:arenaForced,allDecisions:arenaCount};};\n";
replaceOnce(anchor,patch+anchor);
replaceOnce('  function closeMortalCpus(){for(const cpu of mortalCpus)cpu.close();mortalCpus=[];}', '  function closeMortalCpus(){for(const cpu of mortalCpus)cpu.close();mortalCpus=[];if(arenaFocalEvaluator){arenaFocalEvaluator.close();arenaFocalEvaluator=null;}}');
replaceOnce('    human = new Human(); referenceAI = null;', '    human = new Human(); referenceAI = null;');
replaceOnce('  class Human extends M.Player {\n    action(msg,callback){','  class Human extends M.Player {\n    action(msg,callback){if(arenaFocalEvaluator)arenaFocalEvaluator.feed(msg);');
replaceOnce('    human = new Human(); referenceAI = null;', "    human = arenaNextPolicy==='basic' ? new ArenaBasic() : new Human(); arenaFocalEvaluator=arenaNextPolicy!=='basic'?new cpuModule.SeatEvaluator(mortalClient):null; referenceAI = null;");
replaceOnce('    action_zimo(zimo) {\n      if (zimo.l !== this._menfeng)', '    action_zimo(zimo,gangzimo) {\n      if (zimo.l !== this._menfeng)');
replaceOnce('win: this.allow_hule(this.shoupai), nine:', 'win: this.allow_hule(this.shoupai,null,!!gangzimo), nine:');
// QA-only: independent per-hand wall RNG. Never expose wall contents to policies.
replaceOnce('        model.shan = shan || new Majiang.Shan(this._rule);', `        if(shan) throw Error('unexpected externally supplied wall in duplicate QA');
        const previousRandom=Math.random;
        let x=window.__phase0WallSeed(this._model.zhuangfeng,this._model.jushu,this._model.changbang);
        try { Math.random=()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;}; model.shan=new Majiang.Shan(this._rule); }
        finally { Math.random=previousRandom; }
        window.__phase0CaptureWall(model.shan._pai);`);
replaceOnce('    game.kaiju(); redrawSoon();','    game.kaiju(window.__phase0Dealer); redrawSoon();');
// Capture private audit data only after finished game. Not exposed to policy request.
replaceOnce('  window.MahjongLabMortalCpuAudit=()=>','  window.__phase0Result=()=>{if(!gameEnded)throw Error("audit before completion");return {rank:game._paipu.rank,score:game._paipu.defen,qijia:game._paipu.qijia,log:game._paipu.log};};\n  window.MahjongLabMortalCpuAudit=()=>');
fs.writeFileSync(htmlPath,html);
const coachPath=path.join(root,'src/coach/phoenix-coach.mjs');
const coach=fs.readFileSync(coachPath,'utf8');
if(coach.split('if(selected.includes(x))result.二連続向聴改善=twoDraw(M,h,c);').length!==2)throw Error('coach patch anchor');
fs.writeFileSync(coachPath,coach.replace('if(selected.includes(x))result.二連続向聴改善=twoDraw(M,h,c);',''));
const shard=Number(process.env.ARENA_PAIR);
if(!Number.isInteger(shard)||shard<1||shard>8)throw Error('invalid development pilot seed');
const seed=crypto.createHash('sha256').update('coach-v11-20261120:p1_r1_development:'+shard).digest().readUInt32LE(0)||1;
const subprocess=spawn('python',['-u',path.join(__dirname,'../arena/policy_rpc.py')],{stdio:['pipe','pipe','inherit'],env:{...process.env,OMP_NUM_THREADS:'1',OPENBLAS_NUM_THREADS:'1'}});
const lines=readline.createInterface({input:subprocess.stdout})[Symbol.asyncIterator]();
async function infer(q){
 if(subprocess.exitCode!==null)throw Error('policy subprocess exited');
 subprocess.stdin.write(JSON.stringify(q)+'\n');
 let timer;const t=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('policy subprocess timeout')),20000);});
 try{
  const l=await Promise.race([lines.next(),t]);if(l.done)throw Error('policy EOF');
  const r=JSON.parse(l.value);if(r.error)throw Error('policy '+r.error);return r;
 }finally{clearTimeout(timer);}
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:393,height:852}});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(()=>{
 let x=1,block=1,walls=[],occ={};
 window.__qaSetSeed=(n,dealer)=>{x=n>>>0;block=n>>>0;walls=[];occ={};window.__phase0Dealer=dealer;};
 Math.random=()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};
 window.__phase0WallSeed=(wind,round,honba)=>{const key=[wind,round,honba].join(':');const n=occ[key]||0;occ[key]=n+1;let h=block;for(const c of key+':'+n)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h||1;};
 window.__phase0CaptureWall=p=>{if(!Array.isArray(p)||p.length!==136)throw Error('invalid wall');walls.push(p.join(','));};
 window.__phase0ReadWalls=()=>{if(!MahjongLabDebug.state().finished)throw Error('wall audit before finish');return walls.slice();};
 });
  await page.goto('http://127.0.0.1:8788/index.html',{waitUntil:'load'});
  await page.locator('#mortalModelFile').setInputFiles('/tmp/lab/tests/mortal/model.onnx');
  await page.waitForFunction(()=>MahjongLabS42Debug().ready,null,{timeout:120000});
  const rows=[];
  // Rotate the focal ID 0 through every initial seat; repeat the first rotation.
  const ordered=[{dealer:(shard-1)%4,policy:shard<=4?'learned':'s42'}];
  for(const {dealer,policy} of ordered){
   await page.evaluate(({seed,policy,dealer})=>{__qaSetSeed(seed,dealer);MahjongLabArenaSelect(policy);},{seed,policy,dealer});
   await page.locator('input[name="cpuMode"][value="s42"]').check();
   await page.locator('input[name="length"][value="2"]').check();
   await page.locator('input[name="recordMode"][value="practice"]').check();
   await page.locator('#startBtn').click();
   await page.waitForFunction(()=>MahjongLabMortalCpuAudit()?.activeSeats===3,null,{timeout:10000});
   await page.evaluate(async policy=>{MahjongLabDebug.testDwell(0);await MahjongLabArenaStart(policy);},policy);
   let last='',lastAt=Date.now();
   for(let i=0;i<22000;i++){
    const s=await page.evaluate(()=>MahjongLabDebug.state());
    if(s.finished)break;
    const a=await page.evaluate(()=>MahjongLabMortalCpuAudit());
    if(a.fallbacks||!a.sharedWorker||a.activeSeats!==3)throw Error('CPU arena failure '+JSON.stringify(a));
    const key=[s.round,s.phase,s.turn,s.decisions,a.decisions,a.model].join(':');
    if(key!==last){last=key;lastAt=Date.now();}
    if(Date.now()-lastAt>35000)throw Error('arena stall '+JSON.stringify({s,a}));
    if(await page.locator('#resultOverlay:not(.hidden)').count()){
     if(await page.locator('#continueBtn').isEnabled())await page.locator('#continueBtn').click({force:true});
    }else if(s.pending){
     const v=await page.evaluate(()=>MahjongLabArenaNext());
     if(v?.request){const result=await infer(v.request);await page.evaluate(a=>MahjongLabArenaReply(a),result);}
    }
    await page.waitForTimeout(30);
   }
   await page.waitForFunction(()=>MahjongLabDebug.state().finished,null,{timeout:5000});
   await page.waitForFunction(()=>MahjongLabS42Debug().pending===0,null,{timeout:120000});
   const row=await page.evaluate(()=>MahjongLabArenaResult());
   if(policy==='basic'&&(!row.standardAudit||row.standardAudit.invalid||row.standardAudit.actions!==row.decisions))throw Error('standard CPU audit failed');
   if(errors.length||!row.decisions||row.cpuAudit.fallbacks||row.cpuAudit.model+row.cpuAudit.forced!==row.cpuAudit.decisions)throw Error('invalid arena result '+JSON.stringify({errors,row}));
   const outcome=await page.evaluate(()=>({game:window.__phase0Result(),walls:window.__phase0ReadWalls()}));
   if(outcome.game.qijia!==dealer||outcome.game.rank[0]!==row.rank||outcome.walls.length!==row.hands)throw Error('duplicate seat/wall audit');
   const digest=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
   const data=await page.evaluate(()=>MahjongLabDevelopmentExport());
   if(data.allDecisions!==row.decisions||data.forced!==row.forced||data.public.some((v,i)=>v.id!==data.reference[i].id))throw Error('development coverage audit');
   fs.mkdirSync('/tmp/development',{recursive:true});
   for(const k of ['public','reference','oracle'])fs.writeFileSync('/tmp/development/'+k+'.json',JSON.stringify(data[k]));
   fs.writeFileSync('/tmp/development/paipu.json',JSON.stringify(outcome.game));
   rows.push({pair:shard,seed,dealer,...row,allRanks:outcome.game.rank,allScores:outcome.game.score,wallHashes:outcome.walls.map(digest),logHash:digest(outcome.game.log),publicDecisions:data.public.length,teacherTurns:data.oracle.length,teacherScope:'visible-no-ura all eligible accept; development only'});
   console.log('ARENA_MATCH='+JSON.stringify(rows.at(-1)));
   await page.locator('#homeBtn').click();
  }
  fs.writeFileSync('/tmp/development/manifest.json',JSON.stringify({version:'p1-r1-dev-pilot-v1',split:'development-only',seed,shard,rows,codeSha:process.env.GITHUB_SHA},null,2));
 }finally{await browser.close();subprocess.kill();}
})().catch(e=>{console.error(e);subprocess.kill();process.exit(1)});
