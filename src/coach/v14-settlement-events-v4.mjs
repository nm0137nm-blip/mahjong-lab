// P2a-v4: deterministic, opponent-scoped one-event-one-ID hypothetical settlements.
// NO model choices, no probability assumptions, no hidden information.
// postRiichi means the *own seat* declares now, paying one 1000-point stick
// before the hypothetical ron. kyotaku already on the table is awarded only
// on a winning event; it is not paid again by the losing seat.
// This is a DEVELOPMENT contract, not a formal scoring-engine certification.
const fail=x=>{throw Error('v4-settlement: '+x);};
const whole=x=>Number.isSafeInteger(x);
const nonnegative=x=>whole(x)&&x>=0;
const seat=x=>whole(x)&&x>=0&&x<=3;
const allowedKinds=new Set(['hypotheticalOwnRon','hypotheticalOwnDealIn']);
export const V4_SETTLEMENT_VERSION='p2a-v4-separated-ron-settlement-1';

function verifiedBoard(board) {
 if(!board||typeof board!=='object'||!seat(board.ownSeat)||
    !nonnegative(board.honba)||!nonnegative(board.kyotaku)||
    !Array.isArray(board.scores)||board.scores.length!==4||
    !Array.isArray(board.initialOrder)||board.initialOrder.length!==4||
    new Set(board.initialOrder).size!==4||
    !board.initialOrder.every(seat)||
    new Set(board.scores.map(x=>x.seat)).size!==4||
    !board.scores.every(x=>seat(x.seat)&&nonnegative(x.points))||
    board.pendingReach===true)
  fail('invalid public board or pending reach state; cannot infer settlement');
 const points=Array(4);for(const record of board.scores)points[record.seat]=record.points;
 return {points,order:board.initialOrder,ownSeat:board.ownSeat,
  honba:board.honba,kyotaku:board.kyotaku};
}
function ranks(points,order) {
 const standing=[0,1,2,3].sort((a,b)=>points[b]-points[a]||
   order.indexOf(a)-order.indexOf(b));
 const positions=[];
 standing.forEach((s,i)=>{positions[s]=i+1;});
 return positions;
}
function sum(xs){return xs.reduce((a,b)=>a+b,0);}
export function buildV4RonSettlement(board,options){
 const b=verifiedBoard(board),o=options||{};
 if(!allowedKinds.has(o.kind)||!seat(o.opponentSeat)||
    o.opponentSeat===b.ownSeat||!seat(o.dealerSeat)||
    !whole(o.paymentBase)||o.paymentBase<=0||
    ![true,false].includes(o.postRiichi))
  fail('requires explicit kind, opponent seat, dealer seat, base and postRiichi');
 if(o.postRiichi&&b.points[b.ownSeat]<1000)fail('insufficient points for declaration stick');
 const win=o.kind==='hypotheticalOwnRon',winnerSeat=win?b.ownSeat:o.opponentSeat;
 const payerSeat=win?o.opponentSeat:b.ownSeat;
 const amount=o.paymentBase+b.honba*300,pot=b.kyotaku+(o.postRiichi?1:0);
 const p=[...b.points];
 if(o.postRiichi)p[b.ownSeat]-=1000;
 p[payerSeat]-=amount;
 p[winnerSeat]+=amount+pot*1000;
 const originalTotal=sum(b.points)+b.kyotaku*1000;
 if(sum(p)!==originalTotal)fail('points and kyotaku must be conserved');
 const beforeRanks=ranks(b.points,b.order),afterRanks=ranks(p,b.order);
 const id=[
  'v4',win?'ownron':'owndealin','opp'+o.opponentSeat,
  'dealer'+o.dealerSeat,'base'+o.paymentBase,
  'h'+b.honba,'k'+b.kyotaku,'reach'+Number(o.postRiichi)
 ].join('-');
 return {
  version:V4_SETTLEMENT_VERSION,id,kind:o.kind,opponentSeat:o.opponentSeat,
  ownSeat:b.ownSeat, winnerSeat,payerSeat,dealerSeat:o.dealerSeat,
  winnerIsDealer:winnerSeat===o.dealerSeat,paymentBase:o.paymentBase,
  honbaExtra:b.honba*300,totalRonPayment:amount,
  kyotakuBefore:b.kyotaku,ownRiichiDeclared:o.postRiichi,
  riichiDeposit:o.postRiichi?1000:0,kyotakuAwarded:pot*1000,
  initialPoints:[...b.points],initialRanks:beforeRanks,
  pointsAfter:p,ranksAfter:afterRanks,
  ownPointsAfter:p[b.ownSeat],opponentPointsAfter:p[o.opponentSeat],
  ownRankAfter:afterRanks[b.ownSeat],opponentRankAfter:afterRanks[o.opponentSeat],
  rankChanged:beforeRanks[b.ownSeat]!==afterRanks[b.ownSeat],
  probability:'not_calibrated',
  scope:'counterfactual_settlement_only'
 };
}
export function buildV4LegacyCompatibleCatalog(board,oldRankScenarios,{dealerSeat}){
 if(dealerSeat!==0)fail('public projection uses current-wind-relative dealer seat0');
 const b=verifiedBoard(board);
 if(!oldRankScenarios||oldRankScenarios.status!=='hypothetical_settlements_only'||
    !Array.isArray(oldRankScenarios.ron)||!oldRankScenarios.ron.length)
  fail('invalid legacy reference');
 // Legacy rows can include honba and existing kyotaku; verify each strictly.
 const all=[],ids=new Set();
 for(const row of oldRankScenarios.ron){
  if(!seat(row.other)||row.other===b.ownSeat)fail('invalid legacy opponent');
  for(const [kind,baseKey,pointsKey,ranksKey] of [
   ['hypotheticalOwnRon','winBase','winPoints','winRanks'],
   ['hypotheticalOwnDealIn','lossBase','lossPoints','lossRanks']
  ]){
   const e=buildV4RonSettlement(board,{kind,opponentSeat:row.other,
    dealerSeat,paymentBase:row[baseKey],postRiichi:false});
   if(JSON.stringify(e.pointsAfter)!==JSON.stringify(row[pointsKey])||
      JSON.stringify(e.ranksAfter)!==JSON.stringify(row[ranksKey]))
    fail('legacy public settlement disagrees: '+row.other+' '+kind+' '+row[baseKey]);
   if(ids.has(e.id))fail('duplicate typed scenario ID');
   ids.add(e.id);all.push(e);
  }
 }
 return {version:V4_SETTLEMENT_VERSION,
  status:'verified_individual_public_events_not_expected_values',events:all,
  originalLegacyRows:oldRankScenarios.ron.length,
  localLegacyRowsRecomputed:all.length,legacyAllMatched:true};
}
export function formatV4Settlement(event){
 if(!event||event.version!==V4_SETTLEMENT_VERSION||
    !allowedKinds.has(event.kind))fail('not a v4 typed event');
 const own=event.ownSeat,opponent=event.opponentSeat;
 const label=event.kind==='hypotheticalOwnDealIn'?
  '自分が席'+opponent+'に放銃':'自分が席'+opponent+'からロン和了';
 const fmt=n=>n.toLocaleString('ja-JP');
 return label+'。'+(event.ownRiichiDeclared?'立直宣言後、':'')+
  '放銃側が'+fmt(event.totalRonPayment)+'点を支払い'+
  '、供託'+fmt(event.kyotakuAwarded)+'点は和了者へ。'+
  '清算後：自分'+fmt(event.pointsAfter[own])+'点（'+
  event.ranksAfter[own]+'位）、席'+opponent+
  ' '+fmt(event.pointsAfter[opponent])+'点（'+
  event.ranksAfter[opponent]+'位）。'+
  '仮定した和了/放銃時の結果であり、発生確率ではない。';
}
