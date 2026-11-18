import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import {writeFileSync,unlinkSync} from 'node:fs';

const root='http://127.0.0.1:8765/';
const browserName=process.env.BROWSER||'webkit';
const browser=await ({chromium,webkit})[browserName].launch({headless:true});
const legacy=process.env.LEGACY_CACHE_TEST==='1';
const context=await browser.newContext({
  viewport:{width:390,height:844},
  isMobile:true,hasTouch:true,deviceScaleFactor:2,
  serviceWorkers:legacy?'allow':'block'
});
const page=await context.newPage();
const errors=[];
page.on('pageerror',err=>{errors.push(String(err));console.error('[pageerror]',err.message);});
page.on('console',msg=>{if(msg.type()==='error'||msg.type()==='warning')console.log('[console]',msg.type(),msg.text().slice(0,400));});
try{
  if(legacy){
    // Simulate an installed previous release's cache-first module worker,
    // with an obsolete analytics module missing RECOMMENDATION_TEXT.
    writeFileSync('legacy-cache-ci.html','<!doctype html><title>Cache upgrade fixture</title>');
    writeFileSync('legacy-cache-ci.js',`self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{if(e.request.url.includes('/src/mortal/'))e.respondWith(caches.open('mahjong-lab-iphone-legacy-ci').then(async c=>(await c.match(e.request))||fetch(e.request)));});`);
    await page.goto(root+'legacy-cache-ci.html');
    await page.evaluate(async()=>{
      const c=await caches.open('mahjong-lab-iphone-legacy-ci');
      await c.put(new Request(location.origin+'/src/mortal/s42-analytics.mjs'),new Response('export const obsolete = true;',{headers:{'Content-Type':'text/javascript'}}));
      await navigator.serviceWorker.register('/legacy-cache-ci.js',{scope:'/'});
      await navigator.serviceWorker.ready;
    });
    await page.waitForFunction(()=>navigator.serviceWorker.controller?.scriptURL.includes('legacy-cache-ci.js'));
    const stale=await page.evaluate(async()=>await (await fetch('/src/mortal/s42-analytics.mjs')).text());
    assert.equal(stale,'export const obsolete = true;');
    console.log('[pass] actual legacy service worker serves obsolete analytics for unversioned URL');
  }
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
    for(const kind of ['ankan','daiminkan']){
      const id=await page.evaluate(k=>window.MahjongLabDebug.testKanFixture(k),kind);
      assert.ok(Number.isInteger(id),'legal '+kind+' must create S42 decision');
      await page.waitForFunction(id=>window.MahjongLabDebug.testKanObservation()?.id===id,id,{timeout:30000});
      const observation=await page.evaluate(()=>window.MahjongLabDebug.testKanObservation());
      assert.ok(Number.isFinite(observation.qLegal[42]),kind+' Q must be real and legal');
      assert.ok(observation.qLegal.some((q,i)=>i!==42&&Number.isFinite(q)),kind+' alternative Q exists');
      console.log('[S42] actual '+kind+' compare Q=',observation.qLegal[42]);
    }
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

  // A real completed human choice, not a synthetic DOM-only fixture.
  assert.equal(info.lastFeedback.scene.snapshotVersion,2);
  assert.ok(info.lastFeedback.scene.drawn);
  assert.equal(info.lastFeedback.scene.rivers.length,4);
  assert.ok(info.lastFeedback.legalChoices.discards.length);
  const detail=page.locator('#coachDetailBtn');
  await detail.click({timeout:30000});
  await page.getByRole('button',{name:'AI解説',exact:true}).click();
  const prompt=page.locator('#phoenixPrompt');
  assert.ok(await prompt.isVisible());
  const firstPrompt=await prompt.inputValue();
  assert.match(firstPrompt,/鳳凰卓/);
  const publicScene=JSON.parse(firstPrompt.split('【判断時点の記録】\n')[1]);
  assert.equal(publicScene.ツモ牌,info.lastFeedback.scene.drawn);
  assert.equal(publicScene.手牌_選択前.length,info.lastFeedback.scene.hand.length);
  assert.equal(await page.locator('#phoenixCoachMode').inputValue(),'v4');
  assert.ok(publicScene.コーチ計算情報?.実ドラ?.length);
  assert.ok(publicScene.コーチ計算情報?.候補別牌姿?.length);
  assert.ok(publicScene.コーチ計算情報?.判断時点の公開時系列?.length);
  assert.match(firstPrompt,/相対的な手の価値/);
  await page.locator('#phoenixCoachMode').selectOption('legacy');
  assert.equal(JSON.parse((await prompt.inputValue()).split('【判断時点の記録】\n')[1]).コーチ計算情報,undefined);
  await page.locator('#phoenixCoachMode').selectOption('v4');
  assert.match(await prompt.inputValue(),/相対的な手の価値/);
  console.log('[pass] actual relative-value coaching data and legacy switch');
  await page.locator('#phoenixQuestion').fill('この字牌の切り順は？');
  assert.match(await prompt.inputValue(),/この字牌の切り順は？/);
  // Clipboard can be denied in WebKit; either confirmed copy or explicit
  // selectable-text fallback must be provided, never claim a false success.
  await page.getByRole('button',{name:'解説依頼をコピー',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#phoenixCopyStatus')?.textContent?.includes('コピー'));
  assert.match(await page.locator('#phoenixCopyStatus').innerText(),/コピーしました|自動コピーできませんでした/);
  assert.equal(await page.getByRole('link',{name:'ChatGPTを開く'}).getAttribute('href'),'https://chatgpt.com/');
  const shortcut=page.getByRole('link',{name:'ショートカットでAI解説を生成'});
  assert.equal(await shortcut.getAttribute('href'),'shortcuts://run-shortcut?name='+encodeURIComponent('麻雀LAB AI解説')+'&input=clipboard');
  assert.ok(!(await shortcut.getAttribute('href')).includes('text='));
  await page.locator('#phoenixQuestion').fill('保存と変更時の照合');
  assert.equal(await shortcut.getAttribute('aria-disabled'),'true');
  await page.locator('#phoenixAnswer').fill('テスト専用の架空解説');
  await page.getByRole('button',{name:'この解説を端末に保存'}).click();
  assert.match(await page.locator('#phoenixSaveStatus').innerText(),/端末内に保存/);
  await page.locator('#phoenixQuestion').fill('別の質問');
  assert.equal(await page.locator('#phoenixAnswer').inputValue(),'');
  await page.locator('#phoenixQuestion').fill('保存と変更時の照合');
  assert.equal(await page.locator('#phoenixAnswer').inputValue(),'テスト専用の架空解説');
  page.once('dialog',d=>d.accept());
  await page.getByRole('button',{name:'この保存済み解説を削除'}).click();
  assert.equal(await page.locator('#phoenixAnswer').inputValue(),'');
  await page.locator('#closeCoachBtn').click();
  console.log('[pass] Shortcut launch URL contains no prompt, local cache exact matching, save/delete; native launch is not simulated');
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
    await page.waitForFunction(()=>document.querySelector('#coachFlashMain')?.textContent.includes('Q値：あなた'));
    const inline=await page.locator('#coachFlashMain').innerText();
    assert.ok(inline.includes(review.chosenQ.toFixed(3)));assert.ok(inline.includes(review.bestQ.toFixed(3)));assert.match(inline,/推奨度/);
    assert.ok(await details.isVisible(),'details button must remain visible');
    {
      await details.click();
      assert.ok(await page.locator('#coachOverlay').isVisible());
      assert.equal(await page.getByRole('button',{name:'S42の定量評価'}).getAttribute('aria-selected'),'true');
      await page.getByRole('button',{name:'S42の定量評価'}).last().click();
      assert.match(await page.locator('#coachModalBody').innerText(),/推奨度/);
      assert.match(await page.locator('#coachModalBody').innerText(),/Rating寄与（2乗前）/);
      await page.getByRole('button',{name:'AI解説',exact:true}).click();
      const text=await page.locator('#phoenixPrompt').inputValue();
      const data=JSON.parse(text.split('【判断時点の記録】\n')[1]);
      assert.equal(data.S42.選択Q,review.chosenQ);
      assert.equal(data.S42.合法Q.length,review.legal);
      console.log('[pass] Phoenix prompt includes real S42 full Q array');
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
  assert.doesNotMatch(await page.locator('#gameToast').textContent(),/画面表示エラー/);
  if(errors.length)throw Error('Browser errors: '+errors.join('; '));
  console.log('[pass]',browserName,'mobile gameplay and'+(process.env.S42_MODEL_TEST==='1'?' actual S42 inference':' discard replay'));
}catch(e){
  console.error('[diagnostic]',await page.evaluate(()=>({debug:window.MahjongLabS42Debug?.(),status:document.querySelector('#mortalStatus')?.textContent,game:window.MahjongLabDebug?.state?.()})).catch(()=>null));
  throw e;
}finally{await browser.close();if(legacy){for(const f of ['legacy-cache-ci.html','legacy-cache-ci.js'])try{unlinkSync(f);}catch{}}}
