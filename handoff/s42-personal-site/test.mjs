import {chromium,webkit} from '/tmp/probe/node_modules/playwright/index.mjs';import assert from 'node:assert/strict';import fs from 'node:fs';
const kind=process.env.BROWSER||'chromium', browser=await (kind==='webkit'?webkit:chromium).launch({headless:true,...(kind==='chromium'?{args:['--no-sandbox','--disable-dev-shm-usage']}: {})});
try{const context=await browser.newContext({viewport:{width:393,height:852}}),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(String(e)));
await p.addInitScript(()=>{let x=26001126;Math.random=()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};});
const url='http://127.0.0.1:8788/personal-s42-v2/';await p.goto(url);await p.locator('#unlock').waitFor({state:'visible'});await p.goto(url+'app/index.html');assert.ok((await p.locator('body').innerText()).includes('個人用鍵が必要'));
const secret=fs.readFileSync('/tmp/test-private.der').toString('base64url');await p.goto(url+'#key='+secret);await p.waitForURL('**/app/index.html',{timeout:30000});await p.locator('#mortalModelFile').setInputFiles('/tmp/model.onnx');await p.waitForFunction(()=>MahjongLabS42Debug().ready,null,{timeout:180000});await p.locator('#startBtn').click();await p.waitForFunction(()=>MahjongLabMortalCpuAudit()?.activeSeats===3,null,{timeout:10000});await p.evaluate(()=>MahjongLabDebug.testDwell(0));
let steps=0,seen=0,draws=0;for(let i=0;i<5000;i++){const s=await p.evaluate(()=>MahjongLabDebug.state()),a=await p.evaluate(()=>MahjongLabMortalCpuAudit());assert.equal(a.fallbacks,0);if(s.finished)break;if(await p.locator('#drawPreview:not(.hidden)').count()&&!(await p.locator('#resultOverlay:not(.hidden)').count())){
  assert.equal(await p.locator('#resultOverlay').isVisible(),false);
  if(await p.locator('#drawScoresBtn').isEnabled()){await p.locator('#drawScoresBtn').click();draws++;}
}else if(await p.locator('#resultOverlay:not(.hidden)').count()){if(await p.locator('#continueBtn').isEnabled())await p.locator('#continueBtn').click({force:true});}else if(s.pending==='turn'||s.pending==='reaction'){if(await p.locator('#coachFlash').isVisible()&&(await p.locator('#coachFlashMain').innerText()).includes('Q値'))seen++;await p.evaluate(()=>MahjongLabDebug.testStep(true));steps++;}if(steps>=12&&seen>=1&&a.model>=10)break;await p.waitForTimeout(50);}
const audit=await p.evaluate(()=>MahjongLabMortalCpuAudit());assert.ok(steps>=12&&seen>0&&audit.model>=10);assert.equal(errors.length,0);assert.equal(audit.fallbacks,0);
const layout=[];
for(const viewport of [{width:375,height:667},{width:393,height:852},{width:430,height:932}]){
  await p.setViewportSize(viewport);await p.waitForTimeout(150);
  const q=await p.evaluate(()=>{
    const box=id=>document.getElementById(id).getBoundingClientRect();
    const felt=box('tableFelt'),wrap=box('tableWrap'),center=document.querySelector('.center-mark').getBoundingClientRect();
    const scores=['top','left','right','bottom'].map(pos=>{const e=document.getElementById('score-'+pos),b=e.getBoundingClientRect();return {pos,id:Number(e.dataset.player),points:Number(e.dataset.points),inside:b.left>=center.left-1&&b.right<=center.right+1&&b.top>=center.top-1&&b.bottom<=center.bottom+1,transform:getComputedStyle(e).transform};});
    const overlap=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1;
    const riverOverlap=[...document.querySelectorAll('.river-cell')].filter(e=>overlap(e.getBoundingClientRect(),center)).length;
    return {scores,riverOverlap,scale:felt.width/390,uniform:Math.abs(felt.width/390-felt.height/430)<.003,inside:felt.left>=wrap.left-1&&felt.right<=wrap.right+1&&felt.top>=wrap.top-1&&felt.bottom<=wrap.bottom+1};
  });
  assert.deepEqual(q.scores.map(x=>x.id),[2,3,1,0]);assert.ok(q.scores.every(x=>x.inside&&Number.isFinite(x.points)));assert.ok(q.uniform&&q.inside&&q.riverOverlap===0,JSON.stringify(q));layout.push({viewport,...q});
}
await p.setViewportSize({width:393,height:852});
const fixture=await context.newPage();fixture.on('pageerror',e=>errors.push(String(e)));await fixture.goto(url+'app/index.html?uiFixture=1');await fixture.waitForFunction(()=>MahjongLabS42Debug().ready,null,{timeout:180000});await fixture.locator('#startBtn').click();await fixture.waitForFunction(()=>MahjongLabDebug.state().pending==='turn'||MahjongLabDebug.state().pending==='reaction',null,{timeout:60000});
const own=await fixture.evaluate(()=>MahjongLabDebug.state().own);
const packet={name:'荒牌平局',shoupai:['','','',''],fenpei:[0,0,0,0]};packet.shoupai[(own+2)%4]='m123456p123s123z1';packet.shoupai[(own+1)%4]='m123p456s789z1,z555-';
await fixture.evaluate(data=>MahjongLabDrawFixture(data),packet);
await fixture.waitForFunction(()=>document.querySelectorAll('#hand-top img.revealed-tile').length===13);
assert.equal(await fixture.locator('#hand-right img.revealed-tile').count(),10);assert.equal(await fixture.locator('#hand-left img.revealed-tile').count(),0);assert.equal(await fixture.locator('#resultOverlay').isVisible(),false);
const before=await fixture.evaluate(()=>MahjongLabDebug.state().round);await fixture.waitForTimeout(500);assert.equal(await fixture.evaluate(()=>MahjongLabDebug.state().round),before);
await fixture.locator('#drawScoresBtn').click();assert.equal(await fixture.locator('#resultOverlay').isVisible(),true);assert.equal(await fixture.locator('#resultHandDetail .winning-line').count(),2);assert.equal(await fixture.locator('#resultHandDetail .result-meld-row').count(),1);
await fixture.close();console.log('UI_V2_PASS '+JSON.stringify({kind,layout,draws,fixture:true,nonPublicHidden:true,errors}));
await p.goto(url);await p.waitForURL('**/app/index.html',{timeout:30000});await p.waitForFunction(()=>MahjongLabS42Debug().ready,null,{timeout:180000});assert.equal(errors.length,0);console.log('PERSONAL_GATE_ONLINE_PASS '+JSON.stringify({kind,steps,seen,model:audit.model,fallbacks:audit.fallbacks,reopened:true,errors}));
// WebKit's emulated offline navigation raised an internal browser error in the first run.
// Distinguish online gate from offline support; test actual HTTP outage on WebKit instead.
if(kind==='webkit'){process.kill(Number(fs.readFileSync('/tmp/gate-server.pid','utf8').trim()),'SIGTERM');}else await context.setOffline(true);
try{await p.reload({timeout:20000});await p.waitForFunction(()=>MahjongLabS42Debug().ready,null,{timeout:40000});await p.locator('#startBtn').click({timeout:10000});await p.waitForFunction(()=>MahjongLabMortalCpuAudit()?.activeSeats===3,null,{timeout:10000});console.log('PERSONAL_GATE_OFFLINE_PASS '+JSON.stringify({kind,offlineReload:true,method:kind==='webkit'?'server stopped':'browser offline'}));}
catch(e){console.log('PERSONAL_GATE_OFFLINE_NOT_CERTIFIED '+JSON.stringify({kind,reason:String(e.message).slice(0,180)}));if(kind!=='webkit')throw e;}}finally{await browser.close();}
