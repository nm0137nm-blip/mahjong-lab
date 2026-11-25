const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium,webkit}=require('/tmp/probe/node_modules/playwright');
async function run(engine,name){
 const b=await engine.launch({headless:true});
 try{
  const p=await b.newPage({viewport:{width:393,height:852},acceptDownloads:true});const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:8788/calculation-training.html');await p.locator('#startBase').click();
  const first=await p.locator('#prompt').innerText();
  assert.equal(await p.locator('#progress').innerText(),'1 / 12');
  for(let i=0;i<12;i++){
   assert.equal(await p.locator('#result').isVisible(),false);
   assert.equal(await p.locator('#reviews').textContent(),'');
   await p.locator('#answer').fill('0');await p.locator('#confidence').selectOption('3');await p.locator('#reason').fill('fixture');
   await p.locator('#submit').click();
  }
  await p.locator('#result').waitFor({state:'visible'});assert.equal(await p.locator('#reviews article').count(),12);
  const download=p.waitForEvent('download');await p.locator('#export').click();const d=await download;const data=JSON.parse(fs.readFileSync(await d.path(),'utf8'));
  assert.equal(data.schema,'mahjong-lab-calculation-training-v1');assert.equal(data.group,'baseline');assert.equal(data.answered,12);assert.ok(data.responses.every(r=>r.confidence===3&&r.reason==='fixture'&&r.elapsedMs>=0));
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await p.locator('#again').click();await p.locator('#startTransfer').click();assert.notEqual(await p.locator('#prompt').innerText(),first);
  assert.equal(await p.locator('#result').isVisible(),false);assert.deepEqual(errors,[]);
  console.log('TRAINING_BROWSER_PASS '+name+' endOnlyReview=1 export=1 alternatePrompts=1');
 }finally{await b.close();}
}
(async()=>{await run(chromium,'Chromium');await run(webkit,'WebKit')})().catch(e=>{console.error(e.message);process.exitCode=1});
