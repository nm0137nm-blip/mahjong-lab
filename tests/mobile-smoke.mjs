import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';

const root='http://127.0.0.1:8765/';
const browserName=process.env.BROWSER||'webkit';
const browser=await ({chromium,webkit})[browserName].launch({headless:true});
const context=await browser.newContext({
  viewport:{width:390,height:844},
  isMobile:true,hasTouch:true,deviceScaleFactor:2,
  serviceWorkers:'block'
});
const page=await context.newPage();
const errors=[];
page.on('pageerror',err=>{errors.push(String(err));console.error('[pageerror]',err.message);});
page.on('console',msg=>{if(msg.type()==='error'||msg.type()==='warning')console.log('[console]',msg.type(),msg.text().slice(0,400));});
try{
  await page.goto(root,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>!!window.MahjongLabDebug,null,{timeout:30000});
  const first=await page.evaluate(()=>window.MahjongLabDebug.visibleRiver(['m6_-','p5+','s8_','z1*'],true));
  assert.equal(first.length,4);
  assert.equal(first[0].calledAway,true);
  assert.equal(first[0].p.includes('_'),true);
  assert.equal(first[2].calledAway,false);

  if(process.env.S42_MODEL_TEST==='1'){
    if(process.env.S42_LOCAL_MODEL){
      await page.locator('#mortalModelFile').setInputFiles(process.env.S42_LOCAL_MODEL);
    }else{
      const diagnostic=await page.evaluate(async()=>{
        try{
          const r=await fetch('https://huggingface.co/xzhe121/Mortal-S42-onnx/resolve/main/model.onnx?download=true',{method:'HEAD',mode:'cors'});
          return {ok:r.ok,status:r.status,type:r.type,url:r.url,contentLength:r.headers.get('content-length')};
        }catch(e){return {error:String(e),name:e?.name||'unknown',message:e?.message||''};}
      });
      console.log('[S42] CORS diagnostic',JSON.stringify(diagnostic));
      await page.locator('#mortalDownloadBtn').click({timeout:30000});
    }
    await page.waitForFunction(()=>window.MahjongLabS42Debug()?.ready===true,null,{timeout:180000});
    console.log('[S42] ready',await page.evaluate(()=>window.MahjongLabS42Debug()));
  }
  await page.locator('#startBtn').click();
  await page.waitForFunction(()=>window.MahjongLabDebug.state().pending==='turn',null,{timeout:45000});
  const enabled=page.locator('#myHand button:enabled');
  assert.ok(await enabled.count()>0,'legal player discard is available');
  await enabled.first().click();
  await page.waitForFunction(()=>window.MahjongLabDebug.inspect()?.lastFeedback!==null,null,{timeout:30000});
  const info=await page.evaluate(()=>window.MahjongLabDebug.inspect());
  assert.ok(info.lastFeedback.discard,'a player decision is logged');
  assert.equal(await page.locator('#resultOverlay').isVisible(),false);

  if(process.env.S42_MODEL_TEST==='1'){
    await page.waitForFunction(()=>{
      const f=window.MahjongLabDebug.inspect()?.lastFeedback;
      return Boolean(f?.s42Review);
    },null,{timeout:180000});
    const review=await page.evaluate(()=>window.MahjongLabDebug.inspect().lastFeedback.s42Review);
    assert.ok(Number.isFinite(review?.chosenQ));
    assert.ok(review.legal>=2);
    console.log('[S42] first chosen action Q=',review.chosenQ,'rank=',review.rank);
  }
  if(errors.length)throw Error('Browser errors: '+errors.join('; '));
  console.log('[pass]',browserName,'mobile gameplay and'+(process.env.S42_MODEL_TEST==='1'?' actual S42 inference':' discard replay'));
}catch(e){
  console.error('[diagnostic]',await page.evaluate(()=>({debug:window.MahjongLabS42Debug?.(),status:document.querySelector('#mortalStatus')?.textContent,game:window.MahjongLabDebug?.state?.()})).catch(()=>null));
  throw e;
}finally{await browser.close();}
