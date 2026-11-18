const {chromium}=require('/tmp/probe/node_modules/playwright-core');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  try{
    const page=await browser.newPage({viewport:{width:393,height:852},deviceScaleFactor:2});
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    await page.goto('http://127.0.0.1:8788/index.html',{waitUntil:'domcontentloaded'});
    await page.locator('#mortalModelFile').setInputFiles('/tmp/lab/tests/mortal/model.onnx');
    await page.waitForFunction(()=>MahjongLabS42Debug?.().ready===true,{timeout:100000});
    await page.locator('input[name="recordMode"][value="measure"]').check();
    await page.locator('#startBtn').click();
    await page.locator('#speedSelect').selectOption('300');
    // Reduce only the local browser's artificial animation delays for this synthetic CI match.
    // It does not alter the game engine source, scoring logic or debugUsed flag.
    await page.evaluate(()=>{
      const native=window.setTimeout.bind(window);
      window.setTimeout=(fn,ms,...args)=>native(fn,typeof ms==='number' && ms>120?120:ms,...args);
    });
    let decisions=0,results=0,ended=false;
    for(let i=0;i<1900;i++){
      const state=await page.evaluate(()=>MahjongLabDebug.state());
      if(state.finished||await page.locator('#endOverlay:not(.hidden)').count()){ended=true;break;}
      if(await page.locator('#resultOverlay:not(.hidden)').count()){
        const btn=page.locator('#continueBtn');
        if(await btn.isEnabled()){await btn.click({force:true});results++;}
      }else if(state.pending==='turn'){
        const picked=await page.evaluate(()=>{
          const el=document.querySelector('#myHand .tile-btn:not([disabled])');
          if(!el)return false;el.click();return true;
        });
        if(picked)decisions++;
      }else if(state.pending==='reaction'){
        await page.evaluate(()=>MahjongLabDebug.answer({}));
      }else await page.waitForTimeout(45);
      if(i%150===0)console.log('MEASURE_PROGRESS='+JSON.stringify({i,decisions,results,state}));
    }
    if(!ended){
      const state=await page.evaluate(()=>({status:MahjongLabDebug.state(),s42:MahjongLabS42Debug(),pending:MahjongLabDebug.inspect().lastFeedback?.mortalDecision,overlay:document.querySelector('#resultOverlay')?.className}));
      throw Error('Measuring match did not finish: '+JSON.stringify({decisions,results,state}));
    }
    // Game renders the finish screen before its asynchronous completion callback persists stats.
    await page.waitForFunction(()=>{try{return JSON.parse(localStorage.getItem('mahjonglab-measured-v2')||'[]').length===1}catch{return false}},{timeout:15000});
    // Allow the engine's post-summary callback to arrive; record count must remain one.
    await page.waitForTimeout(850);
    const finished=await page.evaluate(()=>({
      stats:document.querySelector('#s42EndSummary')?.textContent,
      record:JSON.parse(localStorage.getItem('mahjonglab-measured-v2')||'[]'),
      recent:JSON.parse(localStorage.getItem('mahjonglab-s42-reviews-last-v1')||'[]').length,
      s42:MahjongLabS42Debug()
    }));
    const history=finished.record;
    if(history.length!==1)throw Error('Expected precisely one measured match; got '+history.length);
    const summary=history[0];
    if(summary.s42?.count<5||summary.s42.rating==null)throw Error('S42 measured stats not persisted '+JSON.stringify(summary.s42));
    if(summary.rank<1||summary.rank>4||summary.hands<1)throw Error('Old measured stats corrupted: '+JSON.stringify({rank:summary.rank,hands:summary.hands}));
    await page.locator('#homeBtn').click();
    const top=await page.locator('#homeS42Stats').innerText();
    if(!top.includes('Mortal Rating（公式方式）')||!top.includes(summary.s42.rating.toFixed(1)+'/100'))throw Error('Home S42 aggregate not visible');
    if(errors.length)throw Error('Browser errors '+JSON.stringify(errors));
    console.log('S42_REAL_MEASURED_MATCH_PASS='+JSON.stringify({decisions,results,summaryS42:summary.s42,rank:summary.rank,hands:summary.hands,reviews:finished.recent,top:top.slice(0,200),errors}));
  }finally{await browser.close();}
})().catch(e=>{console.error(String(e.stack||e));process.exit(1)});
