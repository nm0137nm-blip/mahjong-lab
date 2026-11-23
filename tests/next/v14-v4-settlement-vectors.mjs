import fs from 'node:fs';
import {buildV4RonSettlement} from '../../src/coach/v14-settlement-events-v4.mjs';
const dest=process.argv[2];
if(!dest)throw Error('destination path required');
const vector=[];
const scores=[{seat:2,points:25000},{seat:0,points:30000},
 {seat:3,points:18000},{seat:1,points:27000}];
for(let ownSeat=0;ownSeat<4;ownSeat++){
 for(let dealerSeat=0;dealerSeat<4;dealerSeat++){
  for(let opponentSeat=0;opponentSeat<4;opponentSeat++){
   if(opponentSeat===ownSeat)continue;
   for(const honba of [0,1,3]){
    for(const kyotaku of [0,2]){
     for(const postRiichi of [false,true]){
      for(const kind of ['hypotheticalOwnRon','hypotheticalOwnDealIn']){
       for(const paymentBase of [1000,3900,5800,7700]){
        const board={ownSeat,initialOrder:[3,1,2,0],honba,kyotaku,pendingReach:false,scores};
        const options={dealerSeat,opponentSeat,kind,postRiichi,paymentBase};
        const result=buildV4RonSettlement(board,options);
        vector.push({board,options,result});
       }
      }
     }
    }
   }
  }
 }
}
fs.writeFileSync(dest,JSON.stringify({version:'p2a-v4-independent-arithmetic-vectors-1',vector},null,0)+'\n');
console.log(JSON.stringify({vectors:vector.length,actualModelCalls:0,paidAPICalls:0}));
