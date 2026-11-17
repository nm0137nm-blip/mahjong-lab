const {chromium}=require('/tmp/probe/node_modules/playwright-core');
(async()=>{
  const path=require('fs').existsSync('/usr/bin/google-chrome')?'/usr/bin/google-chrome':'/usr/bin/chromium';
  const browser=await chromium.launch({headless:true,executablePath:path,args:['--no-sandbox','--disable-dev-shm-usage']});
  try{
    const page=await browser.newPage();
    const errs=[];
    page.on('pageerror',e=>errs.push(String(e).slice(0,500)));
    await page.goto('http://127.0.0.1:8788/tests/mortal/browser-probe.html',{waitUntil:'load'});
    await page.waitForFunction(()=>window.probeResult?.status==='PASS_REAL_S42_BROWSER_INFERENCE'||window.probeResult?.status==='FAIL',{timeout:150000});
    const result=await page.evaluate(()=>window.probeResult);
    console.log(JSON.stringify({result,console_errors:errs},null,2));
    if(result.status!=='PASS_REAL_S42_BROWSER_INFERENCE')throw Error('Browser inference failed');
    if(errs.length)throw Error('Page errors: '+errs.join(' // '));
  }finally{await browser.close();}
})().catch(e=>{console.error(String(e));process.exit(1)});
