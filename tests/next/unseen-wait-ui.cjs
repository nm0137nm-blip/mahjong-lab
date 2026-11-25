// Disposable CI only: use a synthetic aggregate pack to exercise native WebCrypto and the real app.
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium,webkit}=require('/tmp/probe/node_modules/playwright');
if(process.env.GITHUB_ACTIONS!=='true')throw Error('CI only');
const rule={"配給原点":25000,"順位点":["20.0","10.0","-10.0","-20.0"],"連風牌は2符":false,"赤牌":{"m":1,"p":1,"s":1},"クイタンあり":true,"喰い替え許可レベル":0,"場数":2,"途中流局あり":true,"流し満貫あり":true,"ノーテン宣言あり":false,"ノーテン罰あり":true,"最大同時和了数":2,"連荘方式":2,"トビ終了あり":true,"オーラス止めあり":true,"延長戦方式":2,"一発あり":true,"裏ドラあり":true,"カンドラあり":true,"カン裏あり":true,"カンドラ後乗せ":true,"ツモ番なしリーチあり":false,"リーチ後暗槓許可レベル":2,"役満の複合あり":true,"ダブル役満あり":false,"数え役満あり":true,"役満パオあり":true,"切り上げ満貫あり":false,"オーラス単独トップ止め":false,"Tenhou研究ルール":true};
const cell=role=>({role,shape:null,dealer:null,band:null,n:200,matches:100,hands:200,metrics:Object.fromEntries(['win','deal','tsumo'].map(k=>[k,{value:50,ci:[47,53],denominator:200,numerator:100,support:k!=='tsumo'}]))});
const pack={schema:'mahjong-lab-research-pack-v1',ruleProfile:'tenhou-ranked-4p-red-hanchan-v1',rule,v3:{meta:{matches:970},bootstrap:2000,cells:['first','chase'].map(cell)},v4:{meta:{matches:970},bootstrap:2000,schema:'l1-v4-visible-reference-ron-v1',cells:[]}};
const bytes=Buffer.from(JSON.stringify(pack)),hash=crypto.createHash('sha256').update(bytes).digest('hex');
const panel='src/research/research-panel.mjs',old=fs.readFileSync(panel,'utf8'),expected='412c8f711270d1fb74620440e7fcdb503b9f39814816432b6f2b8c897b312d44';
const cells=[];
for(const role of ['first','chase']){
 const total=role==='first'?6147:1564;
 for(const [i,u] of ['0–2','3–4','5–6','7+'].entries()){
  const n=Math.floor(total/4)+(i<total%4?1:0);
  const add=(shape,band,n)=>{if(n)cells.push({role,unseenBand:u,shape,band,n,hands:n,matches:Math.min(n,400),metrics:Object.fromEntries(['win','deal','tsumo'].map(k=>[k,{value:100*Math.floor(n/2)/n,numerator:Math.floor(n/2),denominator:n,ci95:[47,53],supported:k!=='tsumo'}]))})};
  add(null,null,n);
  const nShape=role==='chase'&&i===0?2:3,nBand=role==='chase'&&i===0?2:3;
  for(let j=0;j<nShape;j++)add(['ryanmen_only','mixed','no_ryanmen'][j],null,Math.floor(n/nShape)+(j<n%nShape?1:0));
  for(let j=0;j<nBand;j++)add(null,['early','mid','late'][j],Math.floor(n/nBand)+(j<n%nBand?1:0));
 }
}
const unseenPack={schema:'l1-v6-visible-unseen-waits-v1',meta:{matches:970,rows:7711},bootstrap:2000,cells};
assert.equal(cells.length,54);
const unseenBytes=Buffer.from(JSON.stringify(unseenPack)),unseenHash=crypto.createHash('sha256').update(unseenBytes).digest('hex'),unseenExpected='bea9c1ff502851c7a18168619bd24ee7333efc0826d1ccdbeb5a2e9d7e433e9c';
assert.equal(old.split(expected).length,2);assert.equal(old.split(unseenExpected).length,2);fs.writeFileSync(panel,old.replace(expected,hash).replace(unseenExpected,unseenHash));
const index='index.html',src=fs.readFileSync(index,'utf8'),anchor='  window.MahjongLabDebug =';
assert.equal(src.split(anchor).length,2);
fs.writeFileSync(index,src.replace(anchor,`  window.__researchQA=()=>({legal:pending?.type==='turn'?captureCoachChoices(pending).riichiDiscards:[],best:pending?.type==='turn'?candidateInfo.slice().sort((a,b)=>a.shanten-b.shanten||b.ukeire-a.ukeire)[0]?.p:null,rule:game?._rule});
  window.__researchFast=()=>{if(game){game.dwell=0;game.wait=0;}};
  window.__unseenQA=p=>{const h=human.shoupai.clone();h.dapai(p);const waits=M.Util.tingpai(h)||[],visible=visibleCounts();return waits.reduce((sum,t)=>sum+4-visible[t],0);};
`+anchor));
const url='http://127.0.0.1:8788/index.html';
const button=p=>p.getByRole('button',{name:'研究統計（立直）',exact:true});
async function start(p,mode='practice',length='2',support='coach'){
 await p.locator('input[name="supportMode"][value="'+support+'"]').check();
 await p.locator('input[name="length"][value="'+length+'"]').check();
 await p.locator('input[name="recordMode"][value="'+mode+'"]').check();
 await p.locator('#startBtn').click();await p.evaluate(()=>__researchFast());
 await p.locator('#callMode').selectOption('auto');
}
async function ownTurn(p,requireRiichi){
 for(let i=0;i<900;i++){
  const s=await p.evaluate(()=>MahjongLabDebug.state());
  if(s.finished)throw Error('match ended before test candidate');
  if(await p.locator('#resultOverlay:not(.hidden)').count()){
   if(await p.locator('#continueBtn').isEnabled())await p.locator('#continueBtn').click();
  }else if(s.pending==='turn'){
   const q=await p.evaluate(()=>__researchQA());
   if(!requireRiichi||q.legal.length)return;
   if(q.best)await p.evaluate(x=>MahjongLabDebug.choose(x),q.best);else await p.evaluate(()=>MahjongLabDebug.testStep());
  }else if(s.pending==='reaction')await p.evaluate(()=>MahjongLabDebug.answer({}));
  await p.waitForTimeout(25);
 }
 throw Error('natural decision not reached');
}
async function exit(p){await p.locator('#exitBtn').click();await p.locator('#startScreen').waitFor({state:'visible'});}
async function assertBlind(p){
 assert.equal(await p.locator('#coachPanel').isVisible(),false);
 assert.equal(await p.locator('#coachFlash').isVisible(),false);
 assert.equal(await p.locator('#coachBody').textContent(),'');
 assert.equal(await p.locator('#coachFlashMain').textContent(),'');
 assert.doesNotMatch(await p.locator('#handInfo').textContent(),/向聴|テンパイ|和了形/);
 await p.locator('#coachDetailBtn').dispatchEvent('click');
 assert.equal(await p.locator('#coachOverlay').isVisible(),false);
}
async function blindComplete(p){
 let rounds=0;
 for(let i=0;i<5000;i++){
  const s=await p.evaluate(()=>MahjongLabDebug.state());
  if(s.finished){await p.locator('#endOverlay').waitFor({state:'visible'});assert.ok(rounds>0);return;}
  if(await p.locator('#resultOverlay:not(.hidden)').count()){
   assert.equal(await p.locator('#resultDecisionReview').isVisible(),false);
   assert.equal(await p.locator('#resultDecisionReview').textContent(),'');
   if(await p.locator('#continueBtn').isEnabled()){await p.locator('#continueBtn').click();rounds++;}
  }else if(s.pending==='turn'){
   assert.equal(await button(p).count(),0);
   await assertBlind(p);
   await p.evaluate(()=>MahjongLabDebug.testStep());
  }else if(s.pending==='reaction')await p.evaluate(()=>MahjongLabDebug.answer({}));
  await p.waitForTimeout(15);
 }
 throw Error('blind match not complete');
}
async function loadUnseen(p,live){
 const section=p.locator('#unseenWaitSection');
 await p.locator('#unseenPackInput').waitFor({state:'visible'});
 if(live){
  const v=await p.locator('#researchCandidate').inputValue(),expected=await p.evaluate(v=>__unseenQA(v),v);
  assert.match(await section.innerText(),new RegExp('未見 '+expected+'枚'));
  await p.locator('#unseenPackInput').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{}')});
  await p.waitForFunction(()=>document.querySelector('#unseenWaitSection').textContent.includes('ハッシュが一致しません'));
 }
 await p.locator('#unseenPackInput').setInputFiles({name:'synthetic-unseen.json',mimeType:'application/json',buffer:unseenBytes});
 await p.locator('#unseenResult').waitFor({state:'visible'});
 assert.match(await p.locator('#unseenResult').innerText(),/95% CI/);assert.match(await p.locator('#unseenResult').innerText(),/被ツモ率：標本不足/);
 await p.locator('#unseenAxis').selectOption('shape');await p.locator('#unseenAxis').selectOption('band');await p.locator('#unseenAxis').selectOption('none');
 assert.match(await section.innerText(),/山残り枚数ではない/);
}
async function run(engine,name){
 const b=await engine.launch({headless:true});try{
 const ctx=await b.newContext({viewport:{width:393,height:852},serviceWorkers:'block'});const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(String(e)));p.on('dialog',d=>d.accept());
 await p.addInitScript(()=>{let x=21264888;Math.random=()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296}});
 await p.goto(url);await p.waitForFunction(()=>!!window.MahjongLabDebug);
 assert.equal(await p.evaluate(()=>isSecureContext&&!!crypto.subtle),true);
 await start(p);await ownTurn(p,true);await button(p).waitFor({state:'visible',timeout:10000});
 const before=await p.evaluate(()=>MahjongLabDebug.state());await button(p).click();
 assert.equal(await p.locator('#researchOverlay').isVisible(),true);assert.equal(await p.locator('#gameScreen').evaluate(e=>e.inert),true);
 await p.locator('#researchPackInput').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{}')});
 await p.waitForFunction(()=>document.querySelector('#researchBody').textContent.includes('ハッシュが一致しません'));
 await p.locator('#researchPackInput').setInputFiles({name:'synthetic-ci-only.json',mimeType:'application/json',buffer:bytes});
 await p.locator('#researchCandidate').waitFor({state:'visible',timeout:10000});
 assert.match(await p.locator('#researchResult').innerText(),/集計はありません/);
 for(const k of ['shape','dealer','band','scoreBand'])await p.locator('#researchBody input[value="'+k+'"]').check();
 const text=await p.locator('#researchResult').innerText();assert.match(text,/95% CI/);assert.match(text,/被ツモ率：標本不足/);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await p.waitForTimeout(200);assert.deepEqual(await p.evaluate(()=>MahjongLabDebug.state()),before);
 await p.locator('#researchClose').click();assert.equal(await p.locator('#researchOverlay').isVisible(),false);assert.equal(await p.locator('#gameScreen').evaluate(e=>e.inert),false);
 await button(p).click();await p.locator('#researchCandidate').waitFor();await p.evaluate(()=>MahjongLabDebug.testStep());await p.locator('#researchOverlay').waitFor({state:'hidden'});
 assert.equal(await p.locator('#gameScreen').evaluate(e=>e.inert),false);
 await exit(p);await start(p,'measure');await ownTurn(p,false);assert.equal(await button(p).count(),0);assert.equal(await p.locator('#researchOverlay').isVisible(),false);
 await exit(p);await start(p,'practice','1');await ownTurn(p,false);assert.equal(await button(p).count(),0);assert.equal(await p.locator('#researchOverlay').isVisible(),false);
 await exit(p);await p.reload();await p.waitForFunction(()=>!!window.MahjongLabDebug);
 await start(p,'practice','2','self');await ownTurn(p,true);await button(p).waitFor({state:'visible'});
 await assertBlind(p);await button(p).click();
 await p.locator('#researchPackInput').setInputFiles({name:'synthetic-ci-only.json',mimeType:'application/json',buffer:bytes});
 await p.locator('#researchCandidate').waitFor({state:'visible'});
 await p.locator('#researchClose').click();await assertBlind(p);
 await p.evaluate(()=>MahjongLabDebug.testStep());
 await ownTurn(p,false);await assertBlind(p);
 await exit(p);await p.reload();await p.waitForFunction(()=>!!window.MahjongLabDebug);
 await start(p,'practice','2','assessment');await ownTurn(p,true);
 assert.equal(await button(p).count(),0);await assertBlind(p);
 const idx=(await p.evaluate(()=>MahjongLabDebug.state())).decisions;
 const chosen=(await p.evaluate(()=>__researchQA())).legal[0];
 await p.evaluate(x=>MahjongLabDebug.choose(x),chosen);
 await blindComplete(p);
 assert.equal(await p.locator('#endLastReview').isVisible(),true);
 assert.equal(await p.locator('#allReviewBtn').isVisible(),true);
 await p.locator('#allReviewBtn').click();
 const jump=p.getByLabel('振り返る判断を選択');
 await jump.selectOption(String(idx));
 const research=p.getByRole('button',{name:'この判断の研究統計',exact:true});
 await research.waitFor({state:'visible'});await research.click();
 assert.equal(await p.locator('#researchOverlay').isVisible(),true);
 assert.equal(await p.locator('#s42ReviewOverlay').evaluate(e=>e.inert),true);
 assert.equal(await p.locator('#endOverlay').evaluate(e=>e.inert),true);
 await p.locator('#researchPackInput').setInputFiles({name:'synthetic-ci-only.json',mimeType:'application/json',buffer:bytes});
 await p.locator('#researchCandidate').waitFor({state:'visible'});
 assert.equal(await p.locator('#researchCandidate').inputValue(),chosen);
 await loadUnseen(p,false);
 assert.match(await p.locator('#researchBody').innerText(),/判断当時の公開情報/);
 for(const k of ['shape','dealer','band','scoreBand'])await p.locator('#researchBody input[value="'+k+'"]').check();
 assert.match(await p.locator('#researchResult').innerText(),/95% CI/);
 await loadUnseen(p,true);
 await p.keyboard.press('Escape');
 assert.equal(await p.locator('#researchOverlay').isVisible(),false);
 assert.equal(await p.locator('#s42ReviewOverlay').evaluate(e=>e.inert),false);
 await research.click();await p.locator('#researchCandidate').waitFor();
 await jump.dispatchEvent('change');await p.locator('#researchOverlay').waitFor({state:'hidden'});
 assert.equal(await p.locator('#endOverlay').evaluate(e=>e.inert),false);
 await p.locator('#s42ReviewClose').click();
 await p.locator('#homeBtn').click();await p.locator('#startScreen').waitFor({state:'visible'});
 await p.evaluate(()=>{
  const common={ruleProfile:'tenhou-target-4p-red-v1',room:'tokujou',dan:6,mode:2,rank:1,score:40000,hands:8};
  localStorage.setItem('mahjonglab-measured-tenhou-v1',JSON.stringify([common,{...common,supportMode:'coach'},{...common,supportMode:'self'},{...common,supportMode:'assessment'},{...common,supportMode:'assessment'}]));
 });
 await p.locator('#statsHalf').click();
 for(const [mode,n] of [['coach','2'],['self','1'],['assessment','2']]){
  await p.locator('#statsSupport').selectOption(mode);
  assert.equal(await p.locator('#homeStats .stat-val').first().textContent(),n);
 }
 assert.deepEqual(errors,[]);console.log('UNSEEN_WAIT_UI_PASS '+name+' coachRegression=1 selfResearch=1 selfCoachHidden=1 assessmentHidden=1 roundReviewHidden=1 endReview=1 historySeparated=1');
 }finally{await b.close();}
}
(async()=>{try{for(const [n,e] of [['Chromium',chromium],['WebKit',webkit]])await run(e,n)}finally{fs.writeFileSync(index,src);fs.writeFileSync(panel,old)}})().catch(e=>{console.error(e.message);process.exitCode=1});
