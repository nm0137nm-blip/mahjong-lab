import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {verifyV4CurrentDealerSeat,attachVerifiedDealerV4}
  from '../../src/coach/v14-dealer-provenance-v4.mjs';
const data=process.env.V14_FOLLOWUP_PUBLIC?
 JSON.parse(fs.readFileSync(process.env.V14_FOLLOWUP_PUBLIC,'utf8')):[];
const get=(i,k)=>i.evidence.find(x=>x.id===k)?.value;
test('36 original source round labels and engine-relative tie-break order corroborate current East seat0 as dealer',()=>{
 if(!data.length)return;
 let nonzero=0,south=0;
 for(const p of data){
  const b=get(p.request.input,'board');
  const result=verifyV4CurrentDealerSeat(b);
  assert.equal(result.dealerSeat,0);
  assert.deepEqual(result.tieBreakOrder,b.initialOrder);
  assert.equal(attachVerifiedDealerV4(b).dealerSeat,0);
  assert.equal(result.relativeSeatMeaning,'current-kyoku wind seat; not absolute player ID');
  if(b.honba||b.kyotaku)nonzero++;
  if(b.round.startsWith('南'))south++;
 }
 assert.equal(data.length,36);
 assert(nonzero>10&&south>0);
});
test('public round and starting-player order mismatch does not create an invented dealer',()=>{
 if(!data.length)return;
 const b=structuredClone(get(data[0].request.input,'board'));
 b.initialOrder=[0,1,2,3];
 assert.throws(()=>verifyV4CurrentDealerSeat(b),/round and engine-relative initialOrder disagree/);
});
test('incomplete or malformed source round does not supply dealer provenance',()=>{
 if(!data.length)return;
 const b=structuredClone(get(data[0].request.input,'board'));
 b.round='北5局';
 assert.throws(()=>verifyV4CurrentDealerSeat(b),/unsupported round label/);
 const c=structuredClone(get(data[0].request.input,'board'));
 c.activeSeat=99;
 assert.throws(()=>verifyV4CurrentDealerSeat(c),/invalid public board/);
});
