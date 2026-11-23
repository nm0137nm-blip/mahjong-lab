import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildV4RonSettlement,buildV4LegacyCompatibleCatalog,formatV4Settlement}
 from '../../src/coach/v14-settlement-events-v4.mjs';

const sources=process.env.V14_FOLLOWUP_PUBLIC?
 JSON.parse(fs.readFileSync(process.env.V14_FOLLOWUP_PUBLIC,'utf8')):[];
const get=(i,id)=>i.evidence.find(x=>x.id===id)?.value;
function pilot(){
 const v=sources.find(x=>x.request.input.id==='pilot-48');
 if(!v)return null;
 return {board:get(v.request.input,'board'),legacy:get(v.request.input,'rank-scenarios')};
}
test('pilot-48 legacy 15 rows split into 30 audited and differently typed event IDs',()=>{
 const p=pilot();if(!p)return;
 const c=buildV4LegacyCompatibleCatalog(p.board,p.legacy,{dealerSeat:0});
 assert.equal(c.legacyAllMatched,true);
 assert.equal(c.originalLegacyRows,15);
 assert.equal(c.localLegacyRowsRecomputed,30);
 assert.equal(new Set(c.events.map(x=>x.id)).size,30);
 assert(c.events.every(x=>x.kyotakuAwarded===0&&x.riichiDeposit===0));
 const loss=c.events.find(x=>x.kind==='hypotheticalOwnDealIn'&&x.opponentSeat===0&&x.paymentBase===5800);
 const win=c.events.find(x=>x.kind==='hypotheticalOwnRon'&&x.opponentSeat===0&&x.paymentBase===3900);
 assert.deepEqual(loss.pointsAfter,[27200,25200,27000,20600]);
 assert.deepEqual(loss.ranksAfter,[1,3,2,4]);
 assert.equal(loss.ownRankAfter,2);
 assert.equal(win.ownPointsAfter,36700);
 assert.equal(win.opponentPointsAfter,17500);
 assert(!loss.id.includes('3900'));
 assert.match(formatV4Settlement(loss),/5,800点/);
 assert.match(formatV4Settlement(loss),/27,000点/);
 assert.match(formatV4Settlement(loss),/27,200点/);
});
test('pilot-48 3900 own-deal-in is not 5800 and never overturns first place',()=>{
 const p=pilot();if(!p)return;
 const a=buildV4RonSettlement(p.board,{kind:'hypotheticalOwnDealIn',
  dealerSeat:0,opponentSeat:0,paymentBase:3900,postRiichi:false});
 assert.equal(a.ownPointsAfter,28900);
 assert.equal(a.opponentPointsAfter,25300);
 assert.equal(a.ownRankAfter,1);
 assert.equal(a.rankChanged,false);
});
test('dynamic own seat2 opponent0 and other own seat0 opponent2 are supported',()=>{
 const b={ownSeat:0,initialOrder:[1,2,3,0],honba:0,kyotaku:0,
  scores:[{seat:2,points:21000},{seat:3,points:25000},{seat:1,points:20000},{seat:0,points:34000}]};
 const e=buildV4RonSettlement(b,{kind:'hypotheticalOwnDealIn',
  opponentSeat:2,dealerSeat:2,paymentBase:5800,postRiichi:false});
 assert.equal(e.ownPointsAfter,28200);
 assert.equal(e.opponentPointsAfter,26800);
 assert.deepEqual(e.pointsAfter,[28200,20000,26800,25000]);
 assert.match(formatV4Settlement(e),/席2に放銃/);
});
test('honba, existing kyotaku and newly declared riichi counted exactly once',()=>{
 const b={ownSeat:2,initialOrder:[0,1,2,3],honba:2,kyotaku:3,
  scores:[{seat:0,points:20000},{seat:1,points:22000},{seat:2,points:40000},{seat:3,points:18000}]};
 const o=buildV4RonSettlement(b,{kind:'hypotheticalOwnDealIn',
  opponentSeat:0,dealerSeat:0,paymentBase:5800,postRiichi:true});
 assert.equal(o.totalRonPayment,6400);
 assert.equal(o.honbaExtra,600);
 assert.equal(o.riichiDeposit,1000);
 assert.equal(o.kyotakuAwarded,4000);
 assert.equal(o.ownPointsAfter,32600);
 assert.equal(o.opponentPointsAfter,30400);
 assert.equal(o.pointsAfter.reduce((a,b)=>a+b,0),103000);
 const w=buildV4RonSettlement(b,{kind:'hypotheticalOwnRon',
  opponentSeat:0,dealerSeat:0,paymentBase:5200,postRiichi:true});
 assert.equal(w.ownPointsAfter,48800);
 assert.equal(w.opponentPointsAfter,14200);
 assert.equal(w.kyotakuAwarded,4000);
});
test('legacy zero-honba/kyotaku claims cannot validate nonzero hypothetical scenarios',()=>{
 const p=pilot();if(!p)return;
 assert.throws(()=>buildV4LegacyCompatibleCatalog({...p.board,honba:1},p.legacy,{dealerSeat:0}),/legacy public settlement disagrees/);
 const changed=structuredClone(p.legacy);
 changed.ron[2].lossBase=3900;
 assert.throws(()=>buildV4LegacyCompatibleCatalog(p.board,changed,{dealerSeat:0}),/legacy public settlement disagrees/);
});
test('explicitly reject unknown dealer, invalid seats, negative payment, pending reach ambiguity',()=>{
 const p=pilot();if(!p)return;
 const base={kind:'hypotheticalOwnRon',opponentSeat:0,paymentBase:3900,postRiichi:false};
 assert.throws(()=>buildV4RonSettlement(p.board,base),/explicit kind/);
 assert.throws(()=>buildV4RonSettlement(p.board,{...base,dealerSeat:0,opponentSeat:2}),/explicit kind/);
 assert.throws(()=>buildV4RonSettlement(p.board,{...base,dealerSeat:0,paymentBase:-3900}),/explicit kind/);
 assert.throws(()=>buildV4RonSettlement({...p.board,pendingReach:true},{...base,dealerSeat:0}),/pending reach/);
});

test('all 36 original public rank grids split win/deal-in with 1080 row-by-row checked events',()=>{
 if(!sources.length)return;
 let events=0,withHonba=0,withSticks=0;
 for(const source of sources){
  const b=get(source.request.input,'board'),legacy=get(source.request.input,'rank-scenarios');
  const p=buildV4LegacyCompatibleCatalog(b,legacy,{dealerSeat:0});
  assert.equal(p.legacyAllMatched,true);
  assert.equal(p.originalLegacyRows,15);
  assert.equal(p.localLegacyRowsRecomputed,30);
  events+=p.events.length;
  if(b.honba)withHonba++;
  if(b.kyotaku)withSticks++;
  assert(p.events.every(e=>e.dealerSeat===0));
 }
 assert.equal(events,1080);
 assert(withHonba>0&&withSticks>0);
});
test('public legacy grid cannot be reclassified with an incompatible assumed dealer',()=>{
 const p=pilot();if(!p)return;
 assert.throws(()=>buildV4LegacyCompatibleCatalog(p.board,p.legacy,{dealerSeat:2}),/public projection uses current-wind-relative dealer seat0/);
});
