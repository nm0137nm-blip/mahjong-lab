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
const patch="  let arenaPolicy=null,arenaTicket=null,arenaCount=0,arenaForced=0,arenaBlind=null;\n  const arenaOptions=c=>c.phase==='turn'?cpuModule.turnOptions(c.discards,c.riichiDiscards,c.kan,c.tsumo,c.nine):cpuModule.reactionOptions([...c.chi,...c.pon,...c.kan],c.ron);\n  window.MahjongLabArenaStart=async policy=>{\n    if(!game||gameEnded||!cpuAudit||!['s42','learned'].includes(policy))throw Error('arena start');\n    arenaBlind=(await import('./src/coach/s42-benchmark.mjs')).makePublicCase;\n    arenaPolicy=policy;arenaTicket=null;arenaCount=0;arenaForced=0;debugUsed=true;\n  };\n  function arenaExecute(choice,forced){\n    const p=choice.payload,index=decisionLog.length+1;\n    if(p.dapai){riichiMode=p.dapai.endsWith('*');chooseDiscard(p.dapai.replace(/\\*$/,''));}\n    else answer(p);\n    if(decisionLog.length!==index)throw Error('decision progression mismatch');\n    arenaCount++;arenaForced+=Number(forced);\n  }\n  window.MahjongLabArenaNext=()=>{\n    if(!game||gameEnded||!pending)return null;\n    if(arenaTicket)throw Error('duplicate request');\n    const c=captureCoachChoices(pending),opts=arenaOptions(c);\n    if(!opts.size)throw Error('empty legal choices');\n    if(opts.size===1&&[...opts.values()][0].length===1){\n      arenaExecute({payload:[...opts.values()][0][0]},true);return {acted:true};\n    }\n    if(arenaPolicy==='s42'){\n      const active=mortalClient.activeDecision(c.phase),op=mortalClient.current;\n      if(!active||op?.id!==active)return null;\n      arenaExecute(cpuModule.resolveAction(opts,{best:op.best,q:op.qLegal,legal:op.qLegal.map(x=>Number(Number.isFinite(x)))}),false);\n      return {acted:true};\n    }\n    if(arenaPolicy!=='learned')throw Error('arena policy not configured');\n    // No Q, opinion, selected action, truth label or opponent private card in this request.\n    const id='arena-'+(arenaCount+1);\n    const request=arenaBlind({scene:captureS42Scene(),legalChoices:c,candidates:c.phase==='turn'?candidateInfo:[]},M,id);\n    if(JSON.stringify([...opts.keys()].sort((a,b)=>a-b))!==JSON.stringify(request.actions.map(a=>a.action)))throw Error('public legal mask mismatch');\n    arenaTicket={id,pending,opts};\n    return {request};\n  };\n  window.MahjongLabArenaReply=result=>{\n    if(arenaPolicy!=='learned'||!arenaTicket||arenaTicket.pending!==pending||result.id!==arenaTicket.id)throw Error('stale policy response');\n    const opts=arenaTicket.opts;\n    const legal=Array(46).fill(0),q=Array(46).fill(null);\n    for(const [a,v] of result.scores||[]){\n      if(!opts.has(a)||legal[a]||!Number.isFinite(v))throw Error('bad model score');\n      legal[a]=1;q[a]=v;\n    }\n    if(!opts.has(result.action)||q[result.action]!==Math.max(...q.filter(Number.isFinite)))throw Error('invalid model choice');\n    const choice=cpuModule.resolveAction(opts,{best:result.action,q,legal});\n    arenaTicket=null;arenaExecute(choice,false);\n  };\n  window.MahjongLabArenaResult=()=>{\n    if(!gameEnded||!debugUsed||arenaTicket||cpuAudit.fallbacks||arenaCount!==decisionLog.length)throw Error('incomplete arena');\n    const stats=summarizeMatch(game._paipu);\n    return {policy:arenaPolicy,rank:stats.rank,score:stats.score,hands:stats.hands,wins:stats.wins,dealIns:stats.dealIns,riichiHands:stats.riichiHands,openHands:stats.openHands,winPoints:stats.winPoints,decisions:arenaCount,forced:arenaForced,cpuAudit:MahjongLabMortalCpuAudit()};\n  };\n";
replaceOnce(anchor,patch+anchor);
replaceOnce('    action_zimo(zimo) {\n      if (zimo.l !== this._menfeng)', '    action_zimo(zimo,gangzimo) {\n      if (zimo.l !== this._menfeng)');
replaceOnce('win: this.allow_hule(this.shoupai), nine:', 'win: this.allow_hule(this.shoupai,null,!!gangzimo), nine:');
fs.writeFileSync(htmlPath,html);
const coachPath=path.join(root,'src/coach/phoenix-coach.mjs');
const coach=fs.readFileSync(coachPath,'utf8');
if(coach.split('if(selected.includes(x))result.二連続向聴改善=twoDraw(M,h,c);').length!==2)throw Error('coach patch anchor');
fs.writeFileSync(coachPath,coach.replace('if(selected.includes(x))result.二連続向聴改善=twoDraw(M,h,c);',''));
const shard=Number(process.env.ARENA_PAIR);
if(!Number.isInteger(shard)||shard<1||shard>105)throw Error('invalid arena split');
const seed=crypto.createHash('sha256').update('coach-arena-v1:'+shard).digest().readUInt32LE(0)||1;
const subprocess=spawn('python',['-u',path.join(__dirname,'policy_rpc.py')],{stdio:['pipe','pipe','inherit'],env:{...process.env,OMP_NUM_THREADS:'1',OPENBLAS_NUM_THREADS:'1'}});
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
  await page.addInitScript(()=>{let x=1;window.__qaSetSeed=n=>{x=n>>>0;};Math.random=()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};});
  await page.goto('http://127.0.0.1:8788/index.html',{waitUntil:'load'});
  await page.locator('#mortalModelFile').setInputFiles('/tmp/lab/tests/mortal/model.onnx');
  await page.waitForFunction(()=>MahjongLabS42Debug().ready,{timeout:120000});
  const rows=[];
  for(const policy of (shard%2?['learned','s42']:['s42','learned'])){
   await page.evaluate(seed=>__qaSetSeed(seed),seed);
   await page.locator('input[name="cpuMode"][value="s42"]').check();
   await page.locator('input[name="length"][value="2"]').check();
   await page.locator('input[name="recordMode"][value="practice"]').check();
   await page.locator('#startBtn').click();
   await page.waitForFunction(()=>MahjongLabMortalCpuAudit()?.activeSeats===3,{timeout:10000});
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
     if(v?.request){const answer=await infer(v.request);await page.evaluate(a=>MahjongLabArenaReply(a),answer);}
    }
    await page.waitForTimeout(30);
   }
   await page.waitForFunction(()=>MahjongLabDebug.state().finished,{timeout:5000});
   await page.waitForFunction(()=>MahjongLabS42Debug().pending===0,{timeout:120000});
   const row=await page.evaluate(()=>MahjongLabArenaResult());
   if(errors.length||!row.decisions||row.cpuAudit.fallbacks||row.cpuAudit.model+row.cpuAudit.forced!==row.cpuAudit.decisions)throw Error('invalid arena result '+JSON.stringify({errors,row}));
   rows.push({pair:shard,seed,...row});
   console.log('ARENA_MATCH='+JSON.stringify(rows.at(-1)));
   await page.locator('#homeBtn').click();
  }
  fs.mkdirSync('/tmp/arena-results',{recursive:true});
  fs.writeFileSync('/tmp/arena-results/paired.json',JSON.stringify({pair:shard,seed,split:shard<=5?'smoke':'prospective',weights:JSON.parse(fs.readFileSync('/tmp/arena-model/freeze.json','utf8')),rows},null,2));
 }finally{await browser.close();subprocess.kill();}
})().catch(e=>{console.error(e);subprocess.kill();process.exit(1)});
