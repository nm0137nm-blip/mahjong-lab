const {chromium,webkit}=require('/tmp/probe/node_modules/playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const kind=process.env.BROWSER||'chromium';
 const b=await (kind==='webkit'?webkit:chromium).launch({headless:true,...(kind==='chromium'?{args:['--no-sandbox','--disable-dev-shm-usage']}: {})});
 try{
 const p=await b.newPage({viewport:{width:393,height:852}});
 const errors=[];p.on('pageerror',e=>errors.push(String(e)));
 await p.addInitScript(()=>{let x=26001126;Math.random=()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};});
 await p.goto('http://127.0.0.1:8788/index.html',{waitUntil:'load'});
 await p.locator('#startBtn').click();
 assert.equal(await p.evaluate(()=>MahjongLabDebug.state().started),false);
 assert.equal(await p.locator('input[name="recordMode"][value="measure"]').isDisabled(),true);
 await p.locator('#mortalModelFile').setInputFiles('/tmp/lab/tests/mortal/model.onnx');
 await p.waitForFunction(()=>MahjongLabS42Debug().ready,null,{timeout:180000});
 await p.locator('input[name="length"][value="'+(process.env.LENGTH||'1')+'"]').check();
 await p.locator('#startBtn').click();
 await p.waitForFunction(()=>MahjongLabMortalCpuAudit()?.activeSeats===3,null,{timeout:10000});
 await p.evaluate(()=>MahjongLabDebug.testDwell(0));
 let lastProgress=Date.now(),lastKey='',steps=0,reviews=0,shown=0,discardReviews=0;
 for(let i=0;i<25000;i++){
   const s=await p.evaluate(()=>MahjongLabDebug.state()), a=await p.evaluate(()=>MahjongLabMortalCpuAudit());
   assert.equal(a.fallbacks,0,'S42 fallback');assert.equal(a.activeSeats,3);assert.equal(a.sharedWorker,true);
   if(s.finished)break;
   const key=[s.round,s.phase,s.turn,s.decisions,a.decisions,a.model].join(':');
   if(key!==lastKey){lastKey=key;lastProgress=Date.now();}
   if(Date.now()-lastProgress>45000)throw Error('progress stalled '+JSON.stringify({s,a}));
   if(await p.locator('#resultOverlay:not(.hidden)').count()){
     if(await p.locator('#continueBtn').isEnabled())await p.locator('#continueBtn').click({force:true});
   }else if(s.pending==='turn'||s.pending==='reaction'){
     const info=await p.evaluate(()=>MahjongLabDebug.inspect().lastFeedback);
     if(info?.s42Review){
       reviews++;if(info.type==='discard')discardReviews++;
       const visible=await p.locator('#coachFlash').isVisible();
       if(visible&&await p.locator('#coachFlashMain').innerText().then(t=>t.includes('S42')&&t.includes('Q値')))shown++;
     }
     await p.evaluate(()=>MahjongLabDebug.testStep(true));steps++;
   }
   await p.waitForTimeout(40);
 }
 await p.waitForFunction(()=>MahjongLabDebug.state().finished,null,{timeout:10000});
 await p.waitForFunction(()=>MahjongLabS42Debug().pending===0,null,{timeout:120000});
 const audit=await p.evaluate(()=>MahjongLabMortalCpuAudit()), human=await p.evaluate(()=>MahjongLabS42Debug());
 console.log('PERSONAL_PREVIEW='+JSON.stringify({kind,length:process.env.LENGTH,audit,human,steps,reviews,discardReviews,shown,errors}));
 assert.equal(errors.length,0);assert.equal(human.broken,false);
 assert.ok(audit.model>30);assert.equal(audit.fallbacks,0);assert.equal(audit.model+audit.forced,audit.decisions);assert.ok(shown>0);
 assert.ok(await p.locator('#s42EndSummary').innerText().then(t=>t.includes('Mortal Rating')));
 await p.locator('#homeBtn').click();assert.equal((await p.evaluate(()=>MahjongLabMortalCpuAudit())).activeSeats,0);
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exit(1);});
