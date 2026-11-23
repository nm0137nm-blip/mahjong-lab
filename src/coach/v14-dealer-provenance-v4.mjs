// P2a-v4 public dealer-seat provenance. The MajiangCore Game seat index
// is the CURRENT wind-position, with 0=East=dealer. This is NOT the
// immutable player ID. The start-player tie-break order rotates with jushu,
// which is independently reconstructed from the public round and checked.
// This proof asserts source semantics; a complete full-game physical replay
// and adversarial independent engine verification are still separate gates.
const fail=x=>{throw Error('v4-dealer-provenance: '+x);};
const roundIndex=name=>{
 const m=/^[東南西北]([1-4])局$/.exec(name);
 if(!m)fail('unsupported round label');
 return Number(m[1])-1;
};
export const V4_DEALER_PROVENANCE='p2a-v4-current-wind-seat-verified-1';
export function verifyV4CurrentDealerSeat(board){
 if(!board||!Number.isInteger(board.ownSeat)||board.ownSeat<0||
    board.ownSeat>3||!Number.isInteger(board.activeSeat)||
    board.activeSeat<0||board.activeSeat>3||
    !Array.isArray(board.initialOrder)||board.initialOrder.length!==4)
  fail('invalid public board');
 const idx=roundIndex(board.round);
 // Engine replay used in v14-engine-rollout-probe:
 // const playerIds = [(jushu+i)%4 for i in 0..3]
 // scene.initialOrder = [playerIds.indexOf(i) for i in 0..3]
 const playerIds=Array.from({length:4},(_,i)=>(idx+i)%4);
 const order=Array.from({length:4},(_,i)=>playerIds.indexOf(i));
 if(JSON.stringify(order)!==JSON.stringify(board.initialOrder))
  fail('round and engine-relative initialOrder disagree');
 const dealerSeat=0;
 return {version:V4_DEALER_PROVENANCE,
  dealerSeat,source:'MajiangCore_current_wind_relative_seat_index_East_0',
  round:board.round,kyokuIndex:idx,
  tieBreakOrder:order,relativeSeatMeaning:'current-kyoku wind seat; not absolute player ID',
  guarantee:'dealer seat from public seat coordinate corroborated by engine tie break',
  caveat:'does not independently replay all private wall and physical game actions'};
}
export function attachVerifiedDealerV4(board){
 const v=verifyV4CurrentDealerSeat(board);
 return {...structuredClone(board),dealerSeat:v.dealerSeat,dealerProvenance:v};
}
