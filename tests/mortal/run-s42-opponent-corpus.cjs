// DEVELOPMENT ONLY: run in disposable CI checkout. Never publish patched HTML.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {chromium}=require('/tmp/probe/node_modules/playwright');
function capture(game,M,own,pending,tileList,human){
 const model=game.model;
 const norm=t=>t.slice(0,2).replace('0','5');
 const sortTiles=h=>tileList(h).map(t=>t.slice(0,2)).sort().join(',');
 if(sortTiles(model.shoupai[own])!==sortTiles(human.shoupai))throw Error('own hand alignment');
 const candidates=[...new Set((pending.options||[]).map(t=>t.slice(0,2)))].sort();
 const opponents=[];
 for(let seat=0;seat<4;seat++){
  if(seat===own)continue;
  const h=model.shoupai[seat];
  if(!h||!h._fulou||tileList(h).length+3*h._fulou.length!==13||h._zimo)throw Error('opponent not in stable 13-tile state: '+seat);
  const shanten=M.Util.xiangting(h);
  if(!Number.isInteger(shanten)||shanten<0)throw Error('invalid shanten');
  const structuralWaits=shanten===0?[...new Set((M.Util.tingpai(h)||[]).map(norm))].sort():[];
  if(shanten===0&&!structuralWaits.length)throw Error('empty tenpai waits');
  const river=new Set((model.he[seat]?._pai||[]).map(norm));
  const riverFuriten=structuralWaits.some(t=>river.has(t));
  const canRon=game._neng_rong?.[seat];
  if(![true,false,0,1].includes(canRon))throw Error('missing ron eligibility');
  const legalRon={};
  for(const t of candidates){
   const p=t+'_+=-'[(4+own-seat)%4];
   legalRon[t]=shanten===0&&!riverFuriten&&!!canRon&&!!M.Game.allow_hule(game._rule,h,p,model.zhuangfeng,seat,!!h.lizhi||model.shan.paishu===0,!!canRon);
   if(legalRon[t]&&!structuralWaits.includes(norm(t)))throw Error('ron without structural wait');
  }
  opponents.push({seat,shanten,tenpai:shanten===0,structuralWaits,riverFuriten,canRon:!!canRon,legalRon});
 }
 return {version:'belief-teacher-v1',phase:'turn',ownSeat:own,opponents};
}

const root=path.resolve(__dirname,'../..');
if(root!=='/tmp/lab'||process.env.GITHUB_ACTIONS!=='true'||process.env.S42_SELFPLAY_QA!=='1')throw Error('disposable CI checkout only');
const htmlPath=path.join(root,'index.html');
let html=fs.readFileSync(htmlPath,'utf8');
function replaceOnce(a,b){if(html.split(a).length!==2)throw Error('invalid patch anchor '+a);html=html.replace(a,b);}
const anchor='  window.MahjongLabMortalCpuAudit=()=>';
const patch=`
  const qaCapture=${capture.toString()};
  let qaTruth=[],qaActions=[],qaProgression=null;
  window.MahjongLabQaStart=policy=>{
    if(!game||gameEnded||!cpuAudit||!['s42','efficiency'].includes(policy))throw Error('invalid QA start');
    debugUsed=true;qaTruth=[];qaActions=[];qaProgression=policy;
  };
  window.MahjongLabQaStep=()=>{
    if(!game||gameEnded||!pending)return false;
    if(pending.type!=='turn'&&pending.type!=='reaction')return false;
    const c=captureCoachChoices(pending);
    const opts=c.phase==='turn'?cpuModule.turnOptions(c.discards,c.riichiDiscards,c.kan,c.tsumo,c.nine):
       cpuModule.reactionOptions([...c.chi,...c.pon,...c.kan],c.ron);
    if(!opts.size)throw Error('empty human mask');
    const op=mortalClient.current,active=mortalClient.activeDecision(c.phase);
    const forced=opts.size===1&&[...opts.values()][0].length===1;
    if(!forced&&(!active||op?.id!==active))return false;
    let choice;
    if(forced)choice={action:[...opts.keys()][0],payload:[...opts.values()][0][0],grouped:false};
    else choice=cpuModule.resolveAction(opts,{best:op.best,q:op.qLegal,legal:op.qLegal.map(x=>Number(Number.isFinite(x)))});
    if(qaProgression==='efficiency'&&!forced){
      if(c.phase==='reaction')choice=c.ron?{action:43,payload:{hule:'-'}}:{action:45,payload:{}};
      else if(c.tsumo)choice={action:43,payload:{hule:'-'}};
      else{
        const p=candidateInfo.slice().filter(x=>c.discards.includes(x.p)).sort((a,b)=>a.shanten-b.shanten||b.ukeire-a.ukeire||a.p.localeCompare(b.p))[0]?.p;
        if(!p)throw Error('missing efficiency discard');
        choice={action:s42Analytics.actionForDiscard(p),payload:{dapai:p}};
      }
    }
    // The choice is fixed above. This oracle is used only to write separate labels after the match.
    const index=decisionLog.length+1;
    const truth=c.phase==='turn'?qaCapture(game,M,ownSeat(),pending,tileList,human):null;
    const p=choice.payload;
    if(p.dapai){riichiMode=p.dapai.endsWith('*');chooseDiscard(p.dapai.replace(/\\*$/,''));}
    else answer(p);
    if(decisionLog.length!==index)throw Error('decision alignment failed');
    if(truth)qaTruth.push({index,...truth});
    qaActions.push({index,action:choice.action,forced,grouped:!!choice.grouped});
    return true;
  };
  window.MahjongLabQaExport=async(prefix)=>{
    if(!gameEnded||!debugUsed||mortalClient.pending.size||cpuAudit.fallbacks)throw Error('QA match not clean');
    const {collect}=await import('./src/coach/s42-benchmark.mjs');
    const data=collect(decisionLog,M,prefix);
    const ids=new Set(data.blind.filter(x=>x.phase==='turn').map(x=>x.id));
    const teacher=qaTruth.map(row=>({id:prefix+'-'+String(row.index).padStart(3,'0'),...row})).filter(row=>ids.has(row.id));
    if(teacher.length!==ids.size||qaActions.length!==decisionLog.length)throw Error('missing teacher/action coverage');
    const map=new Map(qaActions.map(row=>[prefix+'-'+String(row.index).padStart(3,'0'),row]));
    if(qaProgression==='s42'&&data.keys.some(row=>map.get(row.id)?.action!==row.best))throw Error('S42 progression mismatch');
    const qmap=new Map(data.blind.map(row=>[row.id,row]));
    for(const row of teacher){
      const q=qmap.get(row.id);
      if(q.scene.ownSeat!==row.ownSeat||row.opponents.length!==3)throw Error('teacher POV mismatch');
      const tiles=[...new Set(q.actions.filter(a=>a.action<37).flatMap(a=>a.details.map(p=>p.slice(0,2))))].sort();
      for(const o of row.opponents)if(JSON.stringify(Object.keys(o.legalRon).sort())!==JSON.stringify(tiles))throw Error('teacher candidate mask mismatch');
    }
    return {...data,teacher,policy:qaProgression,steps:qaActions.length,audit:MahjongLabMortalCpuAudit(),score:game._paipu.defen.slice(),rank:game._paipu.rank.slice()};
  };
`;
replaceOnce(anchor,patch+anchor);
// Correct the human QA turn's rinshan-yaku eligibility to mirror the existing CPU rule.
replaceOnce('    action_zimo(zimo) {\n      if (zimo.l !== this._menfeng)', '    action_zimo(zimo,gangzimo) {\n      if (zimo.l !== this._menfeng)');
replaceOnce('win: this.allow_hule(this.shoupai), nine:', 'win: this.allow_hule(this.shoupai,null,!!gangzimo), nine:');
fs.writeFileSync(htmlPath,html);
const shard=Number(process.env.S42_SHARD||0);
const policy=process.env.S42_POLICY||'s42';
const split=process.env.S42_SPLIT;
if(!['train','development'].includes(split)||shard<1||shard>20||(shard<=16)!==(split==='train'))throw Error('fixed split registry mismatch');
const count=5;
if(!Number.isInteger(shard)||shard<0||shard>100||!['s42','efficiency'].includes(policy))throw Error('bad shard settings');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:393,height:852}});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(()=>{let x=1;window.__qaSetSeed=n=>{x=n>>>0;};Math.random=()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};});
  await page.goto('http://127.0.0.1:8788/index.html',{waitUntil:'load'});
  await page.locator('#mortalModelFile').setInputFiles('/tmp/lab/tests/mortal/model.onnx');
  await page.waitForFunction(()=>MahjongLabS42Debug().ready,{timeout:120000});
  const all={questions:[],reference:[],teacher:[],matches:[]};
  for(let g=0;g<count;g++){
   const seed=crypto.createHash('sha256').update('s42-opponents-v2:'+shard+':'+g).digest().readUInt32LE(0)||1;
   const prefix='s42op-v2-'+seed;
   await page.evaluate(seed=>__qaSetSeed(seed),seed);
   await page.locator('input[name="cpuMode"][value="s42"]').check();
   await page.locator('input[name="length"][value="2"]').check();
   await page.locator('input[name="recordMode"][value="practice"]').check();
   await page.locator('#startBtn').click();
   await page.waitForFunction(()=>MahjongLabMortalCpuAudit()?.activeSeats===3,{timeout:10000});
   await page.evaluate(policy=>{MahjongLabDebug.testDwell(0);MahjongLabQaStart(policy);},policy);
   let last='',lastAt=Date.now();
   for(let i=0;i<18000;i++){
    const s=await page.evaluate(()=>MahjongLabDebug.state());
    if(s.finished)break;
    const a=await page.evaluate(()=>MahjongLabMortalCpuAudit());
    if(a.fallbacks||!a.sharedWorker||a.activeSeats!==3)throw Error('CPU QA failure '+JSON.stringify(a));
    const key=[s.round,s.phase,s.turn,s.decisions,a.decisions,a.model].join(':');
    if(key!==last){last=key;lastAt=Date.now();}
    if(Date.now()-lastAt>35000)throw Error('stall '+JSON.stringify({s,a,model:await page.evaluate(()=>MahjongLabS42Debug())}));
    if(await page.locator('#resultOverlay:not(.hidden)').count()){
     if(await page.locator('#continueBtn').isEnabled())await page.locator('#continueBtn').click({force:true});
    }else if(s.pending)await page.evaluate(()=>MahjongLabQaStep());
    await page.waitForTimeout(30);
   }
   await page.waitForFunction(()=>MahjongLabDebug.state().finished,{timeout:5000});
   await page.waitForFunction(()=>MahjongLabS42Debug().pending===0,{timeout:120000});
   const data=await page.evaluate(prefix=>MahjongLabQaExport(prefix),prefix);
   if(errors.length||!data.blind.length||data.audit.fallbacks||data.audit.model+data.audit.forced!==data.audit.decisions)throw Error('incomplete QA data');
   all.questions.push(...data.blind);all.reference.push(...data.keys);all.teacher.push(...data.teacher);
   const m={prefix,seed,policy,turn:data.blind.filter(q=>q.phase==='turn').length,reaction:data.blind.filter(q=>q.phase==='reaction').length,excluded:data.excluded,steps:data.steps,audit:data.audit,score:data.score,rank:data.rank};
   all.matches.push(m);console.log('S42_SELFPLAY_MATCH='+JSON.stringify(m));
   await page.locator('#homeBtn').click();
  }
  if(new Set(all.questions.map(q=>q.id)).size!==all.questions.length||all.questions.length!==all.reference.length||all.matches.length!==count||new Set(all.matches.map(m=>m.seed)).size!==count||all.teacher.length!==all.questions.filter(q=>q.phase==='turn').length)throw Error('dataset alignment');
  if(all.questions.some((q,i)=>q.id!==all.reference[i].id))throw Error('misaligned Q labels');
  fs.mkdirSync('/tmp/s42-corpus',{recursive:true});
  fs.writeFileSync('/tmp/s42-corpus/questions.json',JSON.stringify({items:all.questions}));
  fs.writeFileSync('/tmp/s42-corpus/reference.json',JSON.stringify(all.reference));
  fs.writeFileSync('/tmp/s42-corpus/teacher.json',JSON.stringify(all.teacher));
  fs.writeFileSync('/tmp/s42-corpus/manifest.json',JSON.stringify({shard,policy,split,seedNamespace:'s42-opponents-v2',codeSha:process.env.S42_CODE_SHA,modelSha:'30381bf21389e2d25d3edf48fed11bf772336ef3daeee67d1bdae7fb9dd30cb4',matches:all.matches},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
