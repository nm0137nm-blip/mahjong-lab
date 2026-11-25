const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium,webkit}=require('/tmp/probe/node_modules/playwright');
if(process.env.GITHUB_ACTIONS!=='true')throw Error('CI only');
const cells=[];
for(let rank=1;rank<=4;rank++)for(const [dimension,level,counts] of [['all','all',[178,178,177,177]],['dealer','parent',[50,50,50,50]],['dealer','child',[128,128,127,127]],['gap','0–3900',[50,50,50,50]],['gap','4000–8000',[50,50,50,50]],['gap','8100+',[78,78,77,77]]]){
 const n=counts.reduce((a,b)=>a+b,0);
 cells.push({start_rank:rank,dimension,level,n,matches:n,hands:n,metrics:counts.map((count,i)=>({final_rank:i+1,count,pct:Math.round(count/n*1e7)/1e5,ci95:[20,30],supported:i!==3}))});
}
const data={schema:'l1-v5-south4-initial-rank-v1',matches:970,reached_s4:710,not_reached:260,observations:2840,bootstrap:2000,cells};
const bytes=Buffer.from(JSON.stringify(data)),hash=crypto.createHash('sha256').update(bytes).digest('hex');
const panel='src/research/alllast-panel.mjs',old=fs.readFileSync(panel,'utf8'),expected='0e3f0dd2ed26d571a6a74154658a22bad71cae574a228e494913273a59be91f5';
const index='index.html',src=fs.readFileSync(index,'utf8'),anchor='  window.MahjongLabDebug =';
assert.equal(old.split(expected).length,2);assert.equal(src.split(anchor).length,2);
fs.writeFileSync(panel,old.replace(expected,hash));
fs.writeFileSync(index,src.replace(anchor,'  window.__allLastQA=()=>({snapshot:allLastStart,first:allLastFirstHand,best:candidateInfo.slice().sort((a,b)=>a.shanten-b.shanten||b.ukeire-a.ukeire)[0]?.p});\n  window.__researchFast=()=>{if(game){game.dwell=0;game.wait=0;}};\n'+anchor));
const live=p=>p.getByRole('button',{name:'研究統計（南4開始）',exact:true});
const end=p=>p.locator('#allLastEndBtn');
async function run(engine,name){
 const browser=await engine.launch({headless:true});
 try{
  const p=await browser.newPage({viewport:{width:393,height:852},serviceWorkers:'block'}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
  await p.addInitScript(()=>{let x=21264888;Math.random=()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296}});
  await p.goto('http://127.0.0.1:8788/index.html');await p.waitForFunction(()=>!!window.MahjongLabDebug);
  const {classifyAllLastStart,makeAllLastQuery}=await import('../../src/research/alllast-query.mjs');
  const sample={wind:1,hand:3,firstStart:true,scores:[25000,25000,25000,25000],initialDealer:1,dealer:0,ownId:0,sticks:0};
  assert.equal(classifyAllLastStart(sample).rank,4);
  assert.throws(()=>classifyAllLastStart({...sample,firstStart:false}));
  assert.throws(()=>classifyAllLastStart({...sample,hiddenHand:[]}));
  assert.throws(()=>classifyAllLastStart({...sample,scores:[1,2,3,4]}));
  const q=makeAllLastQuery(data);assert.equal(q(sample,'gap','assessment','during').status,'disabled_during_assessment');
  assert.equal(q(sample,'gap','assessment','after').metrics[3].status,'insufficient_support');
  const bad=structuredClone(data);bad.cells[0].metrics[0].count++;assert.throws(()=>makeAllLastQuery(bad));
  for(const support of ['self','assessment']){
   let reached=false;
   for(let attempt=0;attempt<4&&!reached;attempt++){
    await p.locator('input[name=length][value="2"]').check();await p.locator('input[name=supportMode][value="'+support+'"]').check();await p.locator('#startBtn').click();await p.evaluate(()=>__researchFast());await p.locator('#callMode').selectOption('auto');
    let tested=false;let frozen=null;
    for(let i=0;i<8000;i++){
     const state=await p.evaluate(()=>MahjongLabDebug.state());const qa=await p.evaluate(()=>__allLastQA());
     if(qa.snapshot){if(!frozen)frozen=qa.snapshot;else assert.deepEqual(qa.snapshot,frozen);}
     if(state.finished){
      await p.locator('#endOverlay').waitFor({state:'visible'});
      if(frozen){
       const paipu=await p.evaluate(()=>MahjongLabDebug.testPaipu());
       const q=paipu.log.map(h=>h[0].qipai).find(x=>x.zhuangfeng===1&&x.jushu===3);assert.ok(q);
       const d=(paipu.qijia+3)%4;
       assert.deepEqual(frozen,{wind:1,hand:3,firstStart:true,scores:[0,1,2,3].map(id=>q.defen[(id-d+4)%4]),initialDealer:paipu.qijia,dealer:d,ownId:0,sticks:q.lizhibang});
       assert.equal(await end(p).isVisible(),true);await end(p).click();
       if(await p.locator('#allLastPackInput').count())await p.locator('#allLastPackInput').setInputFiles({name:'synthetic.json',mimeType:'application/json',buffer:bytes});
       await p.locator('#allLastResult').waitFor();assert.match(await p.locator('#allLastResult').innerText(),/標本不足/);await p.locator('#allLastClose').click();
       assert.equal(await p.locator('#endOverlay').evaluate(e=>e.inert),false);
       reached=true;
      }else assert.equal(await end(p).isVisible(),false);
      await p.locator('#homeBtn').click();break;
     }
     if(await p.locator('#resultOverlay:not(.hidden)').count()){
      if(await p.locator('#continueBtn').isEnabled())await p.locator('#continueBtn').click();
     }else if(state.pending==='turn'){
      if(support==='assessment'||!qa.first)assert.equal(await live(p).count(),0);
      else if(!tested){
       await live(p).waitFor({state:'visible'});const before=await p.evaluate(()=>MahjongLabDebug.state());await live(p).click();
       if(await p.locator('#allLastPackInput').count()){
        await p.locator('#allLastPackInput').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{}')});
        await p.waitForFunction(()=>document.querySelector('#allLastBody').textContent.includes('ハッシュが一致しません'));
        await p.locator('#allLastPackInput').setInputFiles({name:'synthetic.json',mimeType:'application/json',buffer:bytes});
       }
       await p.locator('#allLastResult').waitFor();assert.match(await p.locator('#allLastResult').innerText(),/標本不足/);
       await p.locator('#allLastDimension').selectOption('all');assert.match(await p.locator('#allLastResult').innerText(),/710半荘/);
       assert.equal(await p.locator('#gameScreen').evaluate(e=>e.inert),true);assert.deepEqual(await p.evaluate(()=>MahjongLabDebug.state()),before);
       assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
       await p.keyboard.press('Escape');assert.equal(await p.locator('#gameScreen').evaluate(e=>e.inert),false);tested=true;
      }
      if(qa.best)await p.evaluate(x=>MahjongLabDebug.choose(x),qa.best);else await p.evaluate(()=>MahjongLabDebug.testStep());
     }else if(state.pending==='reaction')await p.evaluate(()=>MahjongLabDebug.answer({}));
     await p.waitForTimeout(15);
    }
    if(reached&&support==='self')assert.ok(tested,'no first S4 live turn');
   }
   assert.ok(reached,'no natural S4 match for '+support);
  }
  assert.deepEqual(errors,[]);console.log('ALLLAST_RESEARCH_PASS '+name+' naturalStart=1 rawLogPublicAudit=1 assessmentHidden=1 completedMatch=1 nativeCrypto=1 syntheticPack=1');
 }finally{await browser.close();}
}
(async()=>{try{for(const [n,e] of [['Chromium',chromium],['WebKit',webkit]])await run(e,n)}finally{fs.writeFileSync(index,src);fs.writeFileSync(panel,old)}})().catch(e=>{console.error(e.message);process.exitCode=1});
