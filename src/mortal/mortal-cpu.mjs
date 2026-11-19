/* Experimental CPU controller. Each seat consumes ONLY its own core packets.
 * Shares the human review worker/session, not the human WASM state.
 * 46-action model: exact riichi/kan/red call detail is resolved legally, not by a second S42 head.
 */
import {MortalMjaiBridge} from './mjai-bridge.mjs?v=2601';
import {actionForDiscard,actionForCall} from './s42-analytics.mjs?v=2561';
let sequence=0;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const add=(map,i,value)=>{if(!Number.isInteger(i)||i<0||i>45)throw Error('unknown core action');if(!map.has(i))map.set(i,[]);map.get(i).push(value);};
export function turnOptions(discard,riichi,kan,win,nine){
 const m=new Map();
 for(const p of discard)add(m,actionForDiscard(p),{dapai:p});
 for(const p of riichi)add(m,37,{dapai:p+'*'});
 for(const k of kan)add(m,42,{gang:k});
 if(win)add(m,43,{hule:'-'});
 if(nine)add(m,44,{daopai:'-'});
 return m;
}
export function reactionOptions(calls,win){
 const m=new Map([[45,[{}]]]);
 for(const k of calls)add(m,actionForCall(k),{fulou:k});
 if(win)add(m,43,{hule:'-'});
 return m;
}
// Deterministic resolution of grouped details. Prefer retaining red on discard;
// use the available ordinary discard Q to resolve a riichi declaration tile.
// For grouped calls prefer red already in the meld (remaining value is unchanged).
export function resolveAction(options,result){
 const legal=[...options.keys()].sort((a,b)=>a-b);
 if(!Array.isArray(result.q)||result.q.length!==46||!Array.isArray(result.legal)||result.legal.length!==46)throw Error('invalid S42 result');
 const mask=result.legal.flatMap((v,i)=>v?[i]:[]);
 if(!same(legal,mask))throw Error('legal_mask_mismatch');
 const i=result.best;
 if(!options.has(i)||!Number.isFinite(result.q[i]))throw Error('illegal S42 recommendation');
 const details=options.get(i);
 let payload=details[0];
 if(i===37){
  const score=p=>{const k=actionForDiscard(p.dapai);return result.legal[k]&&Number.isFinite(result.q[k])?result.q[k]:-Infinity;};
  payload=details.slice().sort((a,b)=>score(b)-score(a)||Number(a.dapai[1]==='0')-Number(b.dapai[1]==='0')||a.dapai.localeCompare(b.dapai))[0];
 }
 return {action:i,payload,grouped:details.length>1};
}
export function assertPrivatePacket(msg,bridge){
 if(msg.qipai){
  const h=msg.qipai.shoupai;
  if(!Array.isArray(h)||h.length!==4||h.filter(x=>typeof x==='string'&&x.length>0).length!==1||h.some(x=>typeof x!=='string'))throw Error('private qipai contract');
 }
 const z=msg.zimo||msg.gangzimo;
 if(z&&bridge.round&&bridge.actor(z.l)!==bridge.seat&&z.p!=='')throw Error('private draw contract');
}
export class SeatEvaluator{
 constructor(client){this.client=client;this.bridge=new MortalMjaiBridge();this.state=0;this.broken=false;this.ready=false;this.jobs=new Set();}
 feed(msg){
  this.ready=false;
  if(this.broken||msg.jieju)return;
  const w=this.client.wasm;
  try{
   assertPrivatePacket(msg,this.bridge);
   const {events,reset,seat}=this.bridge.receive(msg);
   if(reset){
    if(this.state)w.drop_state(this.state);
    this.state=w.new_state(seat);
    if(!this.state)throw Error('CPU state allocation');
   }
   if(!this.state)return;
   for(const ev of events){
    const b=new TextEncoder().encode(JSON.stringify(ev)),p=w.alloc_bytes(b.length);
    if(!p)throw Error('CPU event allocation');
    try{
     new Uint8Array(w.memory.buffer,p,b.length).set(b);
     const n=w.apply_event(this.state,p,b.length);
     if(n<0)throw Error('CPU event '+ev.type+' '+n);
     this.ready=n===1;
    }finally{w.free_bytes(p,b.length);}
   }
  }catch(e){this.broken=true;this.ready=false;this.error=String(e.message||e);}
 }
 evaluate(){
  if(!this.ready||this.broken||!this.state||!this.client.workerReady||this.client.broken)throw Error(this.error||'CPU encoder unavailable');
  const w=this.client.wasm,worker=this.client.worker;
  let obs=0,mask=0,data,legal;
  try{
   obs=w.alloc_bytes(1012*34*4);mask=w.alloc_bytes(46);
   if(!obs||!mask||w.encode_state(this.state,obs,mask)!==0)throw Error('CPU encoding failed');
   data=new Float32Array(w.memory.buffer,obs,1012*34).slice();
   legal=new Uint8Array(w.memory.buffer,mask,46).slice();
  }finally{if(obs)w.free_bytes(obs,1012*34*4);if(mask)w.free_bytes(mask,46);}
  const id='cpu-'+(++sequence);
  return new Promise((resolve,reject)=>{
   let timer;
   const finish=(error,result)=>{
    clearTimeout(timer);worker.removeEventListener('message',receive);this.jobs.delete(cancel);
    if(error)reject(error);else resolve(result);
   };
   const cancel=()=>finish(Error('CPU cancelled'));
   const receive=({data})=>{if(data?.id!==id)return;if(data.type==='result')finish(null,data);else if(data.type==='error')finish(Error(data.reason));};
   this.jobs.add(cancel);worker.addEventListener('message',receive);
   timer=setTimeout(()=>finish(Error('CPU inference timeout')),20000);
   try{worker.postMessage({type:'eval',id,obs:data,mask:legal},[data.buffer,legal.buffer]);}
   catch(e){finish(e);}
  });
 }
 close(){this.broken=true;this.ready=false;for(const cancel of [...this.jobs])cancel();if(this.state){this.client.wasm.drop_state(this.state);this.state=0;}}
}
export function createMortalCpuClass(AI){
 return class MortalCpu extends AI {
  constructor(client,audit,onFallback){super();this.evalSeat=new SeatEvaluator(client);this.audit=audit;this.onFallback=onFallback;this.closed=false;}
  close(){this.closed=true;this.evalSeat.close();}
  action(msg,cb){if(this.closed)return;this.evalSeat.feed(msg);return super.action(msg,cb);}
  decide(options,fallback){
   const cb=this._callback;this.audit.decisions++;
   const reply=p=>{if(!this.closed)cb(p);};
   const fail=e=>{
    if(this.closed)return;
    this.audit.fallbacks++;const reason=String(e?.message||e);this.audit.reasons[reason]=(this.audit.reasons[reason]||0)+1;
    this.onFallback(reason);reply(fallback);
   };
   if(this.evalSeat.broken)return fail(Error(this.evalSeat.error||'CPU state broken'));
   if(options.size===1&&[...options.values()][0].length===1){this.audit.forced++;return reply([...options.values()][0][0]);}
   if(!options.size)return fail(Error('empty options'));
   try{this.evalSeat.evaluate().then(result=>{
    if(this.closed)return;
    let choice;try{choice=resolveAction(options,result);}catch(e){return fail(e);}
    this.audit.model++;this.audit.grouped+=Number(choice.grouped);this.audit.totalMs+=result.elapsed||0;
    this.audit.maxMs=Math.max(this.audit.maxMs,result.elapsed||0);
    this.audit.actions[choice.action]=(this.audit.actions[choice.action]||0)+1;
    reply(choice.payload);
   },fail);}catch(e){fail(e);}
  }
  turn({afterCall=false,rinshan=false}={}){
   const h=this.shoupai;
   const discards=this.get_dapai(h)||[];
   const riichi=afterCall?[]:this.allow_lizhi(h)||[];
   const kan=afterCall?[]:this.get_gang_mianzi(h)||[];
   const win=!afterCall&&this.allow_hule(h,null,rinshan);
   const nine=!afterCall&&this.allow_pingju(h);
   const opts=turnOptions(discards,riichi,kan,win,nine);
   // Compute a legal fallback before the core updates any state.
   const fallback=win?{hule:'-'}:discards.length?{dapai:discards[0]}:nine?{daopai:'-'}:{gang:kan[0]};
   this.decide(opts,fallback);
  }
  action_zimo(zimo,gangzimo){if(zimo.l!==this._menfeng)return this._callback({});this.turn({rinshan:!!gangzimo});}
  action_fulou(f){if(f.l!==this._menfeng||/^[mpsz]\d{4}/.test(f.m))return this._callback({});this.turn({afterCall:true});}
  action_dapai(d){
   if(d.l===this._menfeng)return super.action_dapai(d);
   const p=d.p.slice(0,2)+['','+','=','-'][(4+d.l-this._menfeng)%4];
   const h=this.shoupai,win=this.allow_hule(h,p);
   const calls=[...(this.get_chi_mianzi(h,p)||[]),...(this.get_peng_mianzi(h,p)||[]),...(this.get_gang_mianzi(h,p)||[])];
   if(!win&&!calls.length)return super.action_dapai(d);
   this.decide(reactionOptions(calls,win),win?{hule:'-'}:{});
  }
  action_gang(g){
   if(g.l===this._menfeng||/^[mpsz]\d{4}$/.test(g.m))return this._callback({});
   const p=g.m[0]+g.m.slice(-1)+['','+','=','-'][(4+g.l-this._menfeng)%4];
   if(!this.allow_hule(this.shoupai,p,true))return this._callback({});
   this.decide(reactionOptions([],true),{hule:'-'});
  }
 };
}
export function newCpuAudit(){return {decisions:0,model:0,forced:0,fallbacks:0,grouped:0,totalMs:0,maxMs:0,reasons:{},actions:{}};}
