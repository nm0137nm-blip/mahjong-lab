// Independent MJAI reference fixtures. All hands and events are synthetic.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {MortalMjaiBridge} from '../../src/mortal/mjai-bridge.mjs';
import init from '../../assets/mortal/encoder.js';
const e=await init(readFileSync(new URL('../../assets/mortal/encoder_bg.wasm',import.meta.url)));
const scenes=[];
const hand='m135679p024s468z1';
const tiles=['1m','3m','5m','6m','7m','9m','5pr','2p','4p','4s','6s','8s','E'];
const make=(name,wind,round,seat,score,hand,tiles,actions)=>{
 const oya=round,abs=(seat+oya)%4;
 const packets=[{qipai:{zhuangfeng:wind,jushu:round,changbang:0,lizhibang:0,defen:score,baopai:'s9',shoupai:Array.from({length:4},(_,i)=>i===seat?hand:'')}}];
 const scores=Array(4);for(let i=0;i<4;i++)scores[(i+oya)%4]=score[i];
 const expected=[{type:'start_game',names:['Player 0','Player 1','Player 2','Player 3']},{type:'start_kyoku',bakaze:wind?'S':'E',dora_marker:'9s',kyoku:round+1,honba:0,kyotaku:0,oya,scores,tehais:Array.from({length:4},(_,i)=>i===abs?tiles:Array(13).fill('?'))}];
 for(const [packet,event] of actions){packets.push(packet);expected.push(...event);}
 const bridge=new MortalMjaiBridge();const actual=packets.flatMap(p=>bridge.receive(p).events);
 assert.deepEqual(actual,expected,name+' event conversion');
 assert.equal(bridge.seat,abs);
 const h=e.new_state(abs), decisions=[];
 try{
  for(let i=0;i<actual.length;i++){
   const bytes=new TextEncoder().encode(JSON.stringify(actual[i])),ptr=e.alloc_bytes(bytes.length);
   new Uint8Array(e.memory.buffer,ptr,bytes.length).set(bytes);
   const rc=e.apply_event(h,ptr,bytes.length);e.free_bytes(ptr,bytes.length);
   assert.ok(rc>=0,name+' event '+i+' rejected: '+rc);
   if(rc!==1)continue;
   const obs=e.alloc_bytes(1012*34*4),mask=e.alloc_bytes(46);
   assert.equal(e.encode_state(h,obs,mask),0);
   const raw=Buffer.concat([Buffer.from(new Uint8Array(e.memory.buffer,obs,1012*34*4)),Buffer.from(new Uint8Array(e.memory.buffer,mask,46))]);
   e.free_bytes(obs,1012*34*4);e.free_bytes(mask,46);
   decisions.push({eventIndex:i,raw:raw.toString('base64')});
  }
 }finally{e.drop_state(h);}
 assert.ok(decisions.length,name+' no decisions');
 scenes.push({name,seat:abs,events:expected,decisions});
};
const draw=(l,a,p,t)=>[{zimo:{l,p}},[{type:'tsumo',actor:a,pai:t}]];
const discard=(l,a,p,t,tsumogiri=false)=>[{dapai:{l,p}},[{type:'dahai',actor:a,pai:t,tsumogiri}]];
for(let wind=0;wind<2;wind++)for(let round=0;round<4;round++)for(let seat=0;seat<4;seat++)for(const score of [[25000,25000,25000,25000],[31000,21000,31000,17000],[42000,12000,26000,20000]]){
 const abs=l=>(l+round)%4, actions=[];
 // Prior actors' public draws/discards, then observer's actual draw.
 for(let l=0;l<seat;l++){actions.push(draw(l,abs(l),'','?'),discard(l,abs(l),['z2_','z3_','z4_'][l],['S','W','N'][l],true));}
 actions.push(draw(seat,abs(seat),'p7','7p'));
 make('round-'+wind+'-'+round+'-seat-'+seat+'-scores-'+score.join('-'),wind,round,seat,score,hand,tiles,actions);
}
// Genuine legal ankan, daiminkan and pon/chi opportunities.
make('ankan',0,0,0,[25000,25000,25000,25000],'m1111p234s234z123',['1m','1m','1m','1m','2p','3p','4p','2s','3s','4s','E','S','W'],[draw(0,0,'p7','7p')]);
make('daiminkan',0,0,1,[25000,25000,25000,25000],'m111p2345s234z123',['1m','1m','1m','2p','3p','4p','5p','2s','3s','4s','E','S','W'],[draw(0,0,'','?'),discard(0,0,'m1_','1m',true)]);
make('chi-red-five',0,0,1,[25000,25000,25000,25000],'m406p2345s234z123',['4m','5mr','6m','2p','3p','4p','5p','2s','3s','4s','E','S','W'],[draw(0,0,'','?'),discard(0,0,'m3_','3m',true)]);
make('riichi-tenpai',0,0,0,[25000,25000,25000,25000],'m123456789p123z1',['1m','2m','3m','4m','5m','6m','7m','8m','9m','1p','2p','3p','E'],[draw(0,0,'s5','5s')]);
writeFileSync(process.argv[2]||'/tmp/s42-scenes.json',JSON.stringify(scenes));
console.log('FIXED_MJAI_EVENTS_PASS scenes='+scenes.length+' decisions='+scenes.reduce((n,s)=>n+s.decisions.length,0));
