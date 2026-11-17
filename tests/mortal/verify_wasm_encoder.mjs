// Browser encoder parity test against authentic upstream libriichi Python encoder.
// Synthetic East-1 hand only. No personal data, no game records.
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const [jsPath,wasmPath,fixturePath]=process.argv.slice(2);
const wasm=readFileSync(wasmPath);
const js=await import(pathToFileURL(jsPath).href);
const e=await js.default(wasm);
for(const k of ['memory','new_state','alloc_bytes','free_bytes','apply_event','encode_state','drop_state']){
  if(!(k in e))throw Error('Missing WASM export: '+k);
}
const state=e.new_state(0);
if(!state)throw Error('Could not allocate encoder');
const input=new TextEncoder();
function event(data){
  const raw=input.encode(JSON.stringify(data));
  const p=e.alloc_bytes(raw.length);
  if(!p)throw Error('Allocation failure');
  new Uint8Array(e.memory.buffer,p,raw.length).set(raw);
  const r=e.apply_event(state,p,raw.length);
  e.free_bytes(p,raw.length);
  if(r<0)throw Error('Encoder event rejected: '+JSON.stringify(data)+' code='+r);
  return r;
}
event({type:'start_game',names:['Synthetic A','Synthetic B','Synthetic C','Synthetic D']});
event({type:'start_kyoku',bakaze:'E',dora_marker:'7s',kyoku:1,honba:0,kyotaku:0,oya:0,scores:[25000,25000,25000,25000],
tehais:[['1m','2m','3m','4m','5m','6m','7m','8m','9m','1p','2p','3p','E'],Array(13).fill('?'),Array(13).fill('?'),Array(13).fill('?')]});
const can=event({type:'tsumo',actor:0,pai:'5s'});
if(can!==1)throw Error('Human should have action after own tsumo');
const obs=e.alloc_bytes(1012*34*4),mask=e.alloc_bytes(46);
if(!obs||!mask)throw Error('Output allocation failed');
const rc=e.encode_state(state,obs,mask);
if(rc!==0)throw Error('Encode failed '+rc);
const raw=Buffer.concat([Buffer.from(new Uint8Array(e.memory.buffer,obs,1012*34*4)),Buffer.from(new Uint8Array(e.memory.buffer,mask,46))]);
const sha=createHash('sha256').update(raw).digest('hex');
const expected=inflateSync(Buffer.from(readFileSync(fixturePath,'utf8').trim(),'base64'));
if(!raw.equals(expected)){
 const want=createHash('sha256').update(expected).digest('hex');
 throw Error('WASM vs reference Python libriichi mismatch: '+sha+' != '+want);
}
console.log(JSON.stringify({status:'PASS_REFERENCE_ENCODER_PARITY',sha256:sha,bytes:raw.length,legal:[...new Uint8Array(e.memory.buffer,mask,46)].map((v,i)=>v?i:-1).filter(i=>i>=0),wasm_bytes:wasm.length},null,2));
e.free_bytes(obs,1012*34*4);e.free_bytes(mask,46);e.drop_state(state);
