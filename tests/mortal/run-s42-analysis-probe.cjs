const {chromium}=require('/tmp/probe/node_modules/playwright-core');
(async()=>{
  const exe=require('fs').existsSync('/usr/bin/google-chrome')?'/usr/bin/google-chrome':'/usr/bin/chromium';
  const browser=await chromium.launch({headless:true,executablePath:exe,args:['--no-sandbox','--disable-dev-shm-usage']});
  try{
    const page=await browser.newPage({viewport:{width:393,height:852},deviceScaleFactor:2});
    const errors=[],offsite=[];
    page.on('pageerror',e=>errors.push(String(e)));
    page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:8788/'))offsite.push(r.url().slice(0,200));});
    await page.goto('http://127.0.0.1:8788/index.html',{waitUntil:'load'});
    await page.locator('#mortalModelFile').setInputFiles('/tmp/lab/tests/mortal/model.onnx');
    await page.waitForFunction(()=>MahjongLabS42Debug?.().ready,{timeout:115000});
    await page.locator('#startBtn').click();
    await page.evaluate(()=>MahjongLabDebug.testDwell(0));
    let firstReview=null,plays=0,results=0,ended=false,exampleChecked=false;
    for(let i=0;i<1400;i++){
      const a=await page.evaluate(()=>MahjongLabDebug.state());
      if(a.finished||await page.locator('#endOverlay:not(.hidden)').count()){ended=true;break;}
      if(await page.locator('#resultOverlay:not(.hidden)').count()){
        if(await page.locator('#continueBtn').isEnabled()){await page.locator('#continueBtn').click({force:true});results++;}
      }else if(a.pending==='turn'||a.pending==='reaction'){
        await page.evaluate(()=>MahjongLabDebug.testStep(false));plays++;
        if(!exampleChecked && plays>2){
          await page.waitForTimeout(300);
          const x=await page.evaluate(()=>MahjongLabDebug.inspect().lastFeedback);
          if(x?.s42Review?.index!=null){
            if(x.mortalOpinion?.qLegal?.length!==46)throw Error('S42 action-values missing');
            if(!x.candidates?.length||!x.scene?.rivers||x.scene.rivers.length!==4)throw Error('Missing public-only replay snapshot');
            if(x.scene.hand.length>14)throw Error('Unreasonable own-hand data');
            await page.evaluate(()=>document.querySelector('#coachDetailBtn').click());
            const body=page.locator('#coachModalBody');
            const details=await body.innerText();
            if(!details.includes('あなたの選択')||!details.includes('直接有効牌'))throw Error('Efficiency comparison missing');
            if(details.includes('現行CPU')||details.includes('CPU内部'))throw Error('Legacy CPU reference still shown');
            const qbutton=body.getByRole('button',{name:'S42の定量評価'});
            await qbutton.evaluate(el=>el.click());
            const shown=await body.innerText();
            if(!shown.includes('S42の定量判断')||!shown.includes('Q値')||!shown.includes('因数分解はできません'))throw Error('Q explanation missing');
            await page.evaluate(()=>document.querySelector('#closeCoachBtn').click());
            firstReview={score:x.s42Review,model:x.mortalOpinion?.label,candidates:x.candidates.length,scene:x.scene.rivers.length};
            exampleChecked=true;
          }
        }
      }else await page.waitForTimeout(90);
    }
    if(!ended)throw Error('Full East match failed to complete');
    if(!exampleChecked)throw Error('S42 detail comparison not exercised');
    const review=await page.evaluate(()=>({
      summary:document.querySelector('#s42EndSummary')?.textContent||'',
      reviewVisible:!document.querySelector('#s42ReviewBtn')?.hidden,
      badge:document.querySelector('#endTitle')?.textContent||''
    }));
    if(!review.summary.includes('判断指数')||!review.summary.includes('一致率'))throw Error('Summary metrics absent');
    const count=await page.evaluate(()=>MahjongLabDebug.inspect().lastFeedback?.s42Review?.index);
    let replay=null;
    if(review.reviewVisible){
      await page.locator('#s42ReviewBtn').click();
      const html=await page.locator('#s42ReviewBody').innerText();
      if(!html.includes('S42の合法手Q値')||!html.includes('打牌時点の自分の手牌'))throw Error('Replay data missing');
      replay={viewText:html.slice(0,220),tileCount:await page.locator('#s42ReviewBody img').count()};
      await page.locator('#s42ReviewClose').click();
    }
    console.log('PHASE_2_5_FULL_TEST='+JSON.stringify({ended,exampleChecked,firstReview,plays,results,review,replay,lastScore:count,errors,offsite}));
    if(errors.length||offsite.length)throw Error('Browser or network errors: '+JSON.stringify({errors,offsite}));
  }finally{await browser.close();}
})().catch(e=>{console.error(String(e.stack||e));process.exit(1)});
