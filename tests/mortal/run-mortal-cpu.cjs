const {chromium,webkit}=require('/tmp/probe/node_modules/playwright');
const fs=require('node:fs');
const browserType=process.env.CPU_BROWSER==='webkit'?webkit:chromium;
(async()=>{
 const browser=await browserType.launch({headless:true,...(browserType===chromium?{args:['--no-sandbox','--disable-dev-shm-usage']}: {})});
 try {
  const page=await browser.newPage({viewport:{width:393,height:852}});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(()=>{let x=26001119;Math.random=()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};});
  await page.goto('http://127.0.0.1:8788/index.html',{waitUntil:'load'});
  await page.locator('input[name="cpuMode"][value="s42"]').check();
  await page.locator('#startBtn').click();
  if(await page.evaluate(()=>MahjongLabDebug.state().started))throw Error('S42 started without model');
  await page.locator('#mortalModelFile').setInputFiles('/tmp/lab/tests/mortal/model.onnx');
  await page.waitForFunction(()=>MahjongLabS42Debug().ready,{timeout:120000});
  await page.locator('input[name="length"][value="2"]').check();
  await page.locator('input[name="recordMode"][value="measure"]').check();
  await page.locator('#startBtn').click();
  if(await page.evaluate(()=>MahjongLabDebug.state().started))throw Error('experiment polluted measurement mode');
  await page.locator('input[name="recordMode"][value="practice"]').check();
  await page.locator('#startBtn').click();
  await page.waitForFunction(()=>MahjongLabMortalCpuAudit()?.activeSeats===3,{timeout:10000});
  await page.evaluate(()=>MahjongLabDebug.testDwell(0));
  let lastProgress=Date.now(),lastKey='',lastCount=0,steps=0;
  for(let i=0;i<20000;i++){
   const s=await page.evaluate(()=>MahjongLabDebug.state());
   if(s.finished)break;
   const a=await page.evaluate(()=>MahjongLabMortalCpuAudit());
   if(!a.sharedWorker||a.activeSeats!==3)throw Error('CPU session sharing invariant');
   const key=[s.round,s.phase,s.turn,s.decisions,a.decisions,a.model,a.fallbacks].join(':');
   if(key!==lastKey){lastKey=key;lastProgress=Date.now();}
   if(Date.now()-lastProgress>35000)throw Error('progress stalled '+JSON.stringify({s,a}));
   if(a.model-lastCount>=50){lastCount=a.model;console.log('CPU_PROGRESS='+JSON.stringify(a));}
   if(await page.locator('#resultOverlay:not(.hidden)').count()){
    if(await page.locator('#continueBtn').isEnabled())await page.locator('#continueBtn').click({force:true});
   }else if(s.pending==='turn'||s.pending==='reaction'){
    await page.evaluate(()=>MahjongLabDebug.testStep(true));steps++;
   }
   await page.waitForTimeout(45);
  }
  await page.waitForFunction(()=>MahjongLabDebug.state().finished,{timeout:5000});
  await page.waitForFunction(()=>MahjongLabS42Debug().pending===0,{timeout:120000});
  const audit=await page.evaluate(()=>MahjongLabMortalCpuAudit());
  const human=await page.evaluate(()=>MahjongLabS42Debug());
  console.log('CPU_FINAL='+JSON.stringify({audit,human,steps,errors,browser:process.env.CPU_BROWSER}));
  if(errors.length||human.broken||audit.model<60||audit.model+audit.forced+audit.fallbacks!==audit.decisions||audit.fallbacks)throw Error('CPU QA failed: '+JSON.stringify({audit,errors,human}));
  await page.locator('#homeBtn').click();
  if(await page.evaluate(()=>MahjongLabMortalCpuAudit().activeSeats)!==0)throw Error('CPU state not released on exit');
  await page.locator('input[name="cpuMode"][value="basic"]').check();
  await page.locator('#startBtn').click();
  await page.waitForFunction(()=>MahjongLabDebug.state().started&&!MahjongLabDebug.state().finished,{timeout:10000});
  if(await page.evaluate(()=>MahjongLabMortalCpuAudit())!==null)throw Error('basic mode regression');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
