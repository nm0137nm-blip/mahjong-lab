const {chromium}=require('/tmp/probe/node_modules/playwright-core');
const fs=require('node:fs');
const count=Number(process.env.COACH_MATCH_COUNT||2),seed=Number(process.env.COACH_SEED||2581118),cohort=process.env.COACH_COHORT||'pilot';
const contrastEnabled=process.env.COACH_CONTRAST!=='0';
const perMatchSeed=process.env.COACH_PER_MATCH_SEED==='1';
if(!Number.isInteger(count)||count<2||count>12||!Number.isInteger(seed)||seed<1||seed>4294967295||!/^[a-zA-Z0-9_-]{1,30}$/.test(cohort))throw Error('invalid bounded cohort configuration');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:fs.existsSync('/usr/bin/google-chrome')?'/usr/bin/google-chrome':'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:393,height:852}});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(seed=>{let x=seed>>>0;window.__qaSetSeed=n=>{x=n>>>0;};Math.random=()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};},seed);
  await page.goto('http://127.0.0.1:8788/index.html',{waitUntil:'load'});
  await page.locator('#mortalModelFile').setInputFiles('/tmp/lab/tests/mortal/model.onnx');
  await page.waitForFunction(()=>MahjongLabS42Debug().ready,{timeout:105000});
  const all={blind:[],keys:[],matches:[]};let instruction;
  const contrasts={items:[],keys:[],pairs:[
    {id:'dora',a:'dora-A',b:'dora-B',action1:0,action2:18},
    {id:'rank',a:'rank-A',b:'rank-B',action1:37,action2:32}
  ]};
  for(const id of (contrastEnabled?['dora-A','dora-B','rank-A','rank-B']:[])){
   const decision=await page.evaluate(id=>MahjongLabCoachContrastStart(id),id);
   if(!decision)throw Error('fixture has no S42 decision '+id);
   await page.waitForFunction(()=>MahjongLabS42Debug().pending===0,{timeout:30000});
   const pair=await page.evaluate(()=>MahjongLabCoachContrastRead());
   if(!pair.blind||!pair.key)throw Error('fixture excluded '+id+' '+pair.excluded);
   contrasts.items.push(pair.blind);contrasts.keys.push(pair.key);
  }
  for(let g=0;g<count;g++){
   const useMortal=g%2===0;const prefix=cohort+'-'+(useMortal?'s42':'efficiency')+'-'+String(g+1).padStart(2,'0');
   const matchSeed=perMatchSeed?(seed+g)>>>0:null;
   if(perMatchSeed)await page.evaluate(n=>window.__qaSetSeed(n),matchSeed);
   await page.locator('input[name="length"][value="2"]').check();
   await page.locator('#startBtn').click();await page.evaluate(()=>MahjongLabDebug.testDwell(0));
   let fallbacks=0,steps=0,attempts=0;
   for(let i=0;i<4500;i++){
    const s=await page.evaluate(()=>MahjongLabDebug.state());
    const m=await page.evaluate(()=>MahjongLabS42Debug());
    if(m.broken)throw Error('S42 failed: '+m.status);
    if(s.finished)break;
    if(await page.locator('#resultOverlay:not(.hidden)').count()){
     const btn=page.locator('#continueBtn');if(await btn.isEnabled())await btn.click({force:true});else await page.waitForTimeout(60);
    }else if(s.pending==='turn'||s.pending==='reaction'){
     const acted=await page.evaluate(([use,allow])=>MahjongLabCoachAuditStep(use,allow),[useMortal,attempts>=30]);
     if(acted){steps++;if(attempts>=30)fallbacks++;attempts=0;}else{attempts++;await page.waitForTimeout(100);}
    }else{attempts=0;await page.waitForTimeout(60);}
   }
   if(!(await page.evaluate(()=>MahjongLabDebug.state())).finished)throw Error('incomplete match '+prefix);
   await page.waitForFunction(()=>MahjongLabS42Debug().pending===0,{timeout:60000});
   const data=await page.evaluate(p=>MahjongLabCoachAudit(p),prefix);
   all.blind.push(...data.blind);all.keys.push(...data.keys);instruction=data.blindInstruction;
   all.matches.push({prefix,matchSeed,policy:useMortal?'S42-led':'efficiency-led',steps,fallbacks,total:data.total,included:data.blind.length,excluded:data.excluded});
   console.log('BENCH_MATCH='+JSON.stringify(all.matches.at(-1)));
   await page.locator('#homeBtn').click();
  }
  if(errors.length)throw Error(JSON.stringify(errors));
  const counts={turn:all.blind.filter(x=>x.phase==='turn').length,reaction:all.blind.filter(x=>x.phase==='reaction').length};
  if(counts.turn<20||counts.reaction<5)throw Error('insufficient real model-labeled cases '+JSON.stringify(counts));
  const model=all.keys[0].model_sha256;
  fs.mkdirSync('/tmp/coach-bench',{recursive:true});
  fs.writeFileSync('/tmp/coach-bench/blind.json',JSON.stringify({instruction,items:all.blind},null,2));
  fs.writeFileSync('/tmp/coach-bench/reference.json',JSON.stringify(all.keys,null,2));
  fs.writeFileSync('/tmp/coach-bench/manifest.json',JSON.stringify({model,counts,matches:all.matches,seed,cohort,matchCount:count,perMatchSeed,codeSha:process.env.COACH_CODE_SHA||null,source:'Mahjong LAB QA self-generated matches (not Tenhou)',limitations:'Decisions are correlated within matches, not representative of Phoenix table; S42-led action grouping and fallback have limits.'},null,2));
  fs.writeFileSync('/tmp/coach-bench/contrast-blind.json',JSON.stringify({instruction:'2つの局面を比較する。AからBへの変更で action1 と action2 のS42の相対優位（Q(action1)-Q(action2)）が増える・減る・変わらないを予想する。JSON配列 id,direction(increase/decrease/unchanged),reason。Qは未提示。',items:contrasts.items,pairs:contrasts.pairs},null,2));
  fs.writeFileSync('/tmp/coach-bench/contrast-reference.json',JSON.stringify(contrasts.keys,null,2));
  console.log('BENCH_COUNTS='+JSON.stringify({...counts,contrast:contrasts.items.length}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
