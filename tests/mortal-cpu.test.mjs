import test from 'node:test';
import assert from 'node:assert/strict';
import {turnOptions,reactionOptions,resolveAction,assertPrivatePacket,SeatEvaluator} from '../src/mortal/mortal-cpu.mjs';
import {MortalMjaiBridge} from '../src/mortal/mjai-bridge.mjs';
function result(options,best,values={}){
 const q=Array(46).fill(-99),legal=Array(46).fill(0);
 for(const i of options.keys()){q[i]=values[i]??(i===best?10:0);legal[i]=1;}
 return {q,legal,best};
}
test('ordinary and red discards map to distinct actions',()=>{
 const o=turnOptions(['m5','m0_','z7'],[],[],false,false);
 assert.deepEqual(resolveAction(o,result(o,34)).payload,{dapai:'m0_'});
});
test('riichi uses only legal declaration candidates, not best illegal declaration',()=>{
 const o=turnOptions(['m5','p9','z7'],['p9','z7'],[],false,false);
 assert.deepEqual(resolveAction(o,result(o,37,{4:9,17:5,33:3})).payload,{dapai:'p9*'});
});
test('chi position, pon, kan and win map to exact legal core payloads',()=>{
 const o=reactionOptions(['p3-45','p23-4','p123-','p333=','p3333-'],true);
 for(const [i,p] of [[38,'p3-45'],[39,'p23-4'],[40,'p123-'],[41,'p333='],[42,'p3333-']])
  assert.deepEqual(resolveAction(o,result(o,i)).payload,{fulou:p});
 assert.deepEqual(resolveAction(o,result(o,43)).payload,{hule:'-'});
 assert.deepEqual(resolveAction(o,result(o,45)).payload,{});
});
test('mask mismatch fails closed rather than issuing unverified action',()=>{
 const o=turnOptions(['m1','m2'],[],[],false,false);
 const r=result(o,0);r.legal[45]=1;
 assert.throws(()=>resolveAction(o,r),/mask_mismatch/);
});
const hand='m123456p123s123z1';
test('qipai/draw visibility guards and separate POV',()=>{
 const b=new MortalMjaiBridge();
 const q={qipai:{zhuangfeng:0,jushu:0,baopai:'s1',changbang:0,lizhibang:0,defen:[25000,25000,25000,25000],shoupai:[hand,'','','']}};
 assert.doesNotThrow(()=>assertPrivatePacket(q,b));b.receive(q);
 assert.throws(()=>assertPrivatePacket({qipai:{shoupai:[hand,hand,'','']}},b),/private/);
 assert.throws(()=>assertPrivatePacket({zimo:{l:1,p:'p1'}},b),/private/);
 assert.doesNotThrow(()=>assertPrivatePacket({zimo:{l:1,p:''}},b));
 const b2=new MortalMjaiBridge();b2.receive({qipai:{...q.qipai,shoupai:['',hand,'','']}});
 assert.equal(b.seat,0);assert.equal(b2.seat,1);
});
test('actor zero reach accepted before next draw',()=>{
 const b=new MortalMjaiBridge();
 b.receive({qipai:{zhuangfeng:0,jushu:0,baopai:'s1',changbang:0,lizhibang:0,defen:[25000,25000,25000,25000],shoupai:['',hand,'','']}});
 b.receive({dapai:{l:0,p:'z1*'}});
 assert.deepEqual(b.receive({zimo:{l:1,p:'m9'}}).events[0],{type:'reach_accepted',actor:0});
});
