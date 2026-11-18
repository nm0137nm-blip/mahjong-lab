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
      console.log('[S42] verified local model import on mobile WebKit');
      await page.locator('#mortalModelFile').setInputFiles(process.env.S42_LOCAL_MODEL);
    }else{
      console.log('[S42] direct browser download (requires provider CORS)');
      await page.locator('#mortalDownloadBtn').click({timeout:30000});
    }
    await page.waitForFunction(()=>{
      const status=document.querySelector('#mortalStatus')?.textContent||'';
      return window.MahjongLabS42Debug()?.ready===true||/読込失敗|取得失敗|起動に失敗|推論エラー/.test(status);
    },null,{timeout:180000});
    const ready=await page.evaluate(()=>window.MahjongLabS42Debug());
    const status=await page.locator('#mortalStatus').innerText();
    console.log('[S42] model readiness',ready,'UI:',status);
    assert.equal(ready?.ready,true,'S42 verified model must actually load: '+status);
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
    assert.ok(Number.isFinite(review.ratingContribution)&&review.ratingContribution>=0&&review.ratingContribution<=1,
      'real Mortal reviewer relative-Q rating contribution is available');
    assert.ok(Number.isFinite(review?.recommendation)&&review.recommendation>=0&&review.recommendation<=1,
      'Mortal softmax recommendation is available from real model');
    console.log('[S42] first chosen action Q=',review.chosenQ,'rank=',review.rank,
      'recommendation=',review.recommendation);
    const details=page.locator('#coachDetailBtn');
    if(await details.isVisible()){
      await details.click();
      await page.getByRole('button',{name:'S42の定量評価'}).last().click();
      assert.match(await page.locator('#coachModalBody').innerText(),/推奨度/);
      assert.match(await page.locator('#coachModalBody').innerText(),/Rating寄与（2乗前）/);
      await page.locator('#closeCoachBtn').click();
    }
    if(process.env.S42_LOCAL_MODEL){
      const stored=await page.evaluate(()=>window.MahjongLabS42Debug());
      assert.equal(stored?.persisted,true,'verified model must be saved for offline restore');
      // Reload is crucial: the model must survive Safari's page lifecycle.
      await page.reload({waitUntil:'domcontentloaded',timeout:30000});
      await page.waitForFunction(()=>{
        const status=document.querySelector('#mortalStatus')?.textContent||'';
        return window.MahjongLabS42Debug?.()?.ready===true||/保存モデルの再読込失敗|S42推論エラー|ワーカーの起動に失敗|局面変換器の起動に失敗/.test(status);
      },null,{timeout:90000});
      const restored=await page.evaluate(()=>window.MahjongLabS42Debug?.());
      assert.equal(restored?.ready,true,'saved model restores after reload: '+JSON.stringify(restored));
      console.log('[S42] restored from IndexedDB after reload');
    }
  }
  if(errors.length)throw Error('Browser errors: '+errors.join('; '));
  console.log('[pass]',browserName,'mobile gameplay and'+(process.env.S42_MODEL_TEST==='1'?' actual S42 inference':' discard replay'));
}catch(e){
  console.error('[diagnostic]',await page.evaluate(()=>({debug:window.MahjongLabS42Debug?.(),status:document.querySelector('#mortalStatus')?.textContent,game:window.MahjongLabDebug?.state?.()})).catch(()=>null));
  throw e;
}finally{await browser.close();}
