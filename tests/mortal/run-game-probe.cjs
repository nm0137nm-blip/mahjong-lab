const {chromium}=require('/tmp/probe/node_modules/playwright-core');
(async()=>{
 const exe=require('fs').existsSync('/usr/bin/google-chrome')?'/usr/bin/google-chrome':'/usr/bin/chromium';
 const browser=await chromium.launch({headless:true,executablePath:exe,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
 const page=await browser.newPage({viewport:{width:393,height:852},deviceScaleFactor:2});
 const errors=[], network=[];
 page.on('pageerror',e=>errors.push(String(e).slice(0,500)));
 page.on('requestfailed',req=>network.push([req.url(),req.failure()?.errorText]));
 await page.goto('http://127.0.0.1:8788/index.html',{waitUntil:'domcontentloaded'});
 await page.locator('#mortalModelFile').setInputFiles('/tmp/lab/tests/mortal/model.onnx');
 await page.waitForFunction(()=>window.MahjongLabS42Debug?.().ready===true,{timeout:105000});
 const loaded=await page.evaluate(()=>MahjongLabS42Debug());
 await page.locator('#startBtn').click();
 await page.evaluate(()=>MahjongLabDebug.testDwell(0));
 let maxDecision=0,finished=false,broke=false,after=0,calls=0,iterations=0;
 for(let i=0;i<270;i++){
   iterations=i+1;
   const state=await page.evaluate(()=>MahjongLabDebug.state());
   const info=await page.evaluate(()=>MahjongLabS42Debug());
   maxDecision=Math.max(maxDecision,info.decision);
   if(info.broken||info.status.includes('解析停止')){broke=true;break;}
   if(info.afterDiscard)after++;
   if(state.finished||await page.locator('#endOverlay:not(.hidden)').count()){finished=true;break;}
   if(await page.locator('#resultOverlay:not(.hidden)').count()){
      await page.locator('#continueBtn').click({force:true});
   }else if(state.pending==='turn'||state.pending==='reaction'){
      await page.evaluate(()=>MahjongLabDebug.testStep(false));calls++;
      if(calls>=18)break;
   }else await page.waitForTimeout(170);
 }
 const final=await page.evaluate(()=>({game:MahjongLabDebug.state(),s42:MahjongLabS42Debug(),flash:document.querySelector('#coachFlashMain')?.textContent,gameVisible:!document.querySelector('#gameScreen').classList.contains('hidden')}));
 console.log(JSON.stringify({loaded,final,iterations,calls,maxDecision,after,broke,finished,errors,network:network.slice(0,10)},null,2));
 if(errors.length||broke||!maxDecision||!after||!final.gameVisible)throw Error('S42 full game integration failed');
 }finally{await browser.close();}
})().catch(e=>{console.error(String(e.stack||e));process.exit(1)});
