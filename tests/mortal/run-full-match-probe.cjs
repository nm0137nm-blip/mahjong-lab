const {chromium}=require('/tmp/probe/node_modules/playwright-core');
(async()=>{
 const exe=require('fs').existsSync('/usr/bin/google-chrome')?'/usr/bin/google-chrome':'/usr/bin/chromium';
 const browser=await chromium.launch({headless:true,executablePath:exe,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:375,height:812},deviceScaleFactor:2});
  const errors=[],otherOrigins=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('request',request=>{
    const u=new URL(request.url());
    if(!['http://127.0.0.1:8788','about:blank'].includes(u.origin))otherOrigins.push(u.origin);
  });
  await page.goto('http://127.0.0.1:8788/index.html',{waitUntil:'load'});
  await page.locator('#mortalModelFile').setInputFiles('/tmp/lab/tests/mortal/model.onnx');
  await page.waitForFunction(()=>MahjongLabS42Debug().ready,{timeout:105000});
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  async function play(length,limit=2400){
    if(length===2)await page.locator('input[name="length"][value="2"]').check();
    await page.locator('#startBtn').click();
    await page.evaluate(()=>MahjongLabDebug.testDwell(0));
    let plays=0,results=0,maxDecision=0,withAdvice=0,broken=false,finished=false;
    for(let i=0;i<limit;i++){
      const s=await page.evaluate(()=>MahjongLabDebug.state());
      const a=await page.evaluate(()=>MahjongLabS42Debug());
      maxDecision=Math.max(maxDecision,a.decision);
      if(a.afterDiscard)withAdvice++;
      if(a.broken||a.status.includes('解析停止')){broken=true;break;}
      if(s.finished||await page.locator('#endOverlay:not(.hidden)').count()){finished=true;break;}
      if(await page.locator('#resultOverlay:not(.hidden)').count()){
        const btn=page.locator('#continueBtn');
        if(await btn.isEnabled()){await btn.click({force:true});results++;}
      }else if(s.pending==='turn'||s.pending==='reaction'){
        await page.evaluate(()=>MahjongLabDebug.testStep(false));plays++;
      }else await page.waitForTimeout(90);
      if(i%50===0)console.log('PROGRESS_'+length+'='+JSON.stringify({i,plays,results,maxDecision}));
    }
    const end={length,plays,results,maxDecision,withAdvice,broken,finished,
      status:await page.evaluate(()=>MahjongLabS42Debug()),
      view:await page.evaluate(()=>MahjongLabDebug.state())};
    console.log('RESULT_'+length+'='+JSON.stringify(end));
    if(!finished||broken||!maxDecision||!withAdvice)throw Error('Incomplete match or S42 error');
    await page.locator('#homeBtn').click();
    return end;
  }
  const east=await play(1,1200);
  await page.context().setOffline(true);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>MahjongLabS42Debug?.().ready,{timeout:105000});
  const restored=await page.evaluate(()=>MahjongLabS42Debug());
  console.log('OFFLINE_RESTORE='+JSON.stringify(restored));
  if(!restored.ready)throw Error('Offline model not restored from IndexedDB');
  const half=await play(2,2400);
  console.log('SUMMARY='+JSON.stringify({east,half,errors,otherOrigins}));
  if(errors.length||otherOrigins.length)throw Error('Unexpected script errors or external traffic');
 }finally{await browser.close();}
})().catch(e=>{console.error(String(e.stack||e));process.exit(1)});
