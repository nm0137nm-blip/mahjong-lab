// Actual pinned S42 encoder and ONNX worker. Fictional packet fixtures, no raw records.
const assert=require('node:assert/strict');const {chromium}=require('/tmp/probe/node_modules/playwright');
if(process.env.GITHUB_ACTIONS!=='true')throw Error('CI only');
(async()=>{const b=await chromium.launch({headless:true});try{
 const p=await b.newPage({serviceWorkers:'block'});await p.goto('http://127.0.0.1:8788/index.html');
 const report=await p.evaluate(async()=>{
  const {MortalClient}=await import('/src/mortal/mortal-client.mjs');
  const {SeatEvaluator}=await import('/src/mortal/mortal-cpu.mjs');
  const check=(v,m)=>{if(!v)throw Error(m)};
  const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const client=new MortalClient();await client.loadEncoder();
  const response=await fetch('/tests/mortal/model.onnx');check(response.ok,'model unavailable');
  await client.importModel(await response.arrayBuffer());
  for(let i=0;i<1200&&!client.workerReady;i++)await new Promise(r=>setTimeout(r,100));
  check(client.workerReady&&!client.broken,'model startup');
  const messages=[],worker=client.worker;
  // Capture the actual typed arrays passed to the production worker, not a substitute encoder.
  const wrapped={addEventListener:(...a)=>worker.addEventListener(...a),removeEventListener:(...a)=>worker.removeEventListener(...a),postMessage:(m,t)=>{messages.push({obs:Array.from(m.obs),mask:Array.from(m.mask)});worker.postMessage(m,t)}};
  const scoped={wasm:client.wasm,worker:wrapped,workerReady:true,broken:false};
  const qipai=(wind,round,seat,hand)=>({qipai:{zhuangfeng:wind,jushu:round,changbang:0,lizhibang:0,defen:[25000,25000,25000,25000],baopai:'s9',shoupai:Array.from({length:4},(_,i)=>i===seat?hand:'')}});
  const draw=(l,p)=>({zimo:{l,p}}),discard=(l,p)=>({dapai:{l,p}});
  const fixtures=[];
  const hand='m135679p024s468z1';
  for(let wind=0;wind<3;wind++)for(let round=0;round<4;round++)for(let seat=0;seat<4;seat++){
    const events=[qipai(wind,round,seat,hand)];
    for(let l=0;l<seat;l++)events.push(draw(l,''),discard(l,['z2_','z3_','z4_'][l]));
    events.push(draw(seat,'p7'));fixtures.push(events);
  }
  fixtures.push([qipai(0,0,0,'m1111p234s234z123'),draw(0,'p7')]);
  fixtures.push([qipai(0,0,1,'m111p2345s234z123'),draw(0,''),discard(0,'m1_')]);
  fixtures.push([qipai(0,0,1,'m406p2345s234z123'),draw(0,''),discard(0,'m3_')]);
  fixtures.push([qipai(0,0,0,'m123456789p123z1'),draw(0,'s5')]);
  const forbidden=['wall','hiddenOracle','opponentHands','privateState','futureDraws'];
  let poisonedReads=0,packets=0,decisions=0,reach=0,kan=0,rejectedHands=0,rejectedDraws=0;
  function poison(packet){
   const copy=structuredClone(packet);const trap=()=>{poisonedReads++;throw Error('private field accessed')};
   const key=Object.keys(copy)[0];
   for(const o of [copy,copy[key]])for(const name of forbidden)Object.defineProperty(o,name,{get:trap});
   return copy;
  }
  function resultsMatch(a,b){
    check(eq(a.legal,b.legal)&&a.best===b.best,'legal/best changed');
    for(let i=0;i<a.q.length;i++)if(a.legal[i])check(Number.isFinite(a.q[i])&&Object.is(a.q[i],b.q[i]),'legal Q changed');
  }
  async function compare(a,b,kind){
   messages.length=0;const x=kind?await a.evaluateDetail(kind):await a.evaluate();const y=kind?await b.evaluateDetail(kind):await b.evaluate();
   check(messages.length===2&&eq(messages[0],messages[1]),'actual worker input differs');
   resultsMatch(x,y);return x;
  }
  for(const f of fixtures){
   const a=new SeatEvaluator(scoped),b=new SeatEvaluator(scoped);
   const leak=new SeatEvaluator(scoped);
   try{
    const full=structuredClone(f[0]);full.qipai.shoupai=Array(4).fill('m123456789p123z1');leak.feed(full);check(leak.broken&&!leak.ready,'full hands not rejected');rejectedHands++;
    for(const packet of f){
      a.feed(packet);b.feed(poison(packet));packets++;
      check(!a.broken&&!b.broken&&a.ready===b.ready,'encoder readiness mismatch');
      if(!a.ready)continue;
      const r=await compare(a,b,null);decisions++;
      if(r.legal[37]){await compare(a,b,'reach');reach++;}
      if(r.legal[42]){await compare(a,b,'kan');kan++;}
    }
    const foreign=new SeatEvaluator(scoped);try{
      foreign.feed(f[0]);const seat=f[0].qipai.shoupai.findIndex(x=>x);
      foreign.feed(draw((seat+1)%4,'m1'));check(foreign.broken&&!foreign.ready,'private draw not rejected');rejectedDraws++;
    }finally{foreign.close()}
   }finally{a.close();b.close();leak.close();}
  }
  client.worker.terminate();check(poisonedReads===0&&decisions>0&&reach>0&&kan>0,'missing poison coverage');
  return {fixtures:fixtures.length,packets,decisions,reachDetails:reach,kanDetails:kan,rejectedHands,rejectedDraws,poisonedReads,scope:'isolated real encoder/ONNX worker; not a sandbox proof of every game code path'};
 });
 assert.equal(report.poisonedReads,0);console.log('L2_REAL_POLICY_POISON_PASS='+JSON.stringify(report));
 }finally{await b.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
