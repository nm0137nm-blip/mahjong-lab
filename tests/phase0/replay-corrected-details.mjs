import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const root=process.argv[2],files=fs.readdirSync(root,{recursive:true}).filter(p=>/live-\d+\.json$/.test(p)).sort();
if(files.length!==2)throw Error('expected both old traces');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage();
 await page.goto('http://127.0.0.1:8788/index.html',{waitUntil:'load'});
 await page.evaluate(async()=>{
  const {default:init}=await import('/assets/mortal/encoder.js');
  const wasm=await init('/assets/mortal/encoder_bg.wasm');
  const worker=new Worker('/src/mortal/mortal-worker.mjs',{type:'module'});
  const model=await(await fetch('/tests/mortal/model.onnx')).arrayBuffer();
  await new Promise((resolve,reject)=>{const fn=({data})=>{if(data.id!=='repair-init')return;worker.removeEventListener('message',fn);data.type==='ready'?resolve():reject(Error(data.reason));};worker.addEventListener('message',fn);worker.postMessage({type:'init',model,id:'repair-init'},[model]);});
  window.repairRuntime={wasm,worker,workerReady:true,broken:false};
 });
 fs.mkdirSync('/tmp/repaired-old',{recursive:true});
 let n=0;
 for(const f of files){
  const cases=JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
  for(const t of cases){
   if(!t.decisions.length)continue;
   const corrected=await page.evaluate(async t=>{
    const {SeatEvaluator,resolveNativeAction}=await import('/src/mortal/mortal-cpu.mjs');
    const ev=new SeatEvaluator(window.repairRuntime),w=ev.client.wasm;
    ev.state=w.new_state(t.seat);ev.bridge.seat=t.seat;ev.ready=true;
    const wanted=new Map(t.decisions.map(d=>[d.eventIndex,d])),out=[];
    try{
     for(let i=0;i<t.events.length;i++){
      const b=new TextEncoder().encode(JSON.stringify(t.events[i])),p=w.alloc_bytes(b.length);
      try{new Uint8Array(w.memory.buffer,p,b.length).set(b);const rc=w.apply_event(ev.state,p,b.length);if(rc<0)throw Error('old event rejected');ev.ready=rc===1;}finally{w.free_bytes(p,b.length);}
      const d=wanted.get(i);if(!d)continue;
      if(!ev.ready)throw Error('old decision not actionable');
      const legal=d.q.map(v=>Number(v!==null)),q=d.q.map(v=>v===null?-Infinity:v);
      const choice=await resolveNativeAction(new Map(d.options),{best:d.best,q,legal},ev);
      out.push({...d,choice});
     }
     return {...t,decisions:out};
    }finally{ev.close();}
   },t);fs.writeFileSync('/tmp/repaired-old/case-'+String(n++).padStart(4,'0')+'.json',JSON.stringify([corrected]));
  }
 }
 console.log(JSON.stringify({status:'replayed_old_states',seatHands:n}));
}finally{await browser.close();}
