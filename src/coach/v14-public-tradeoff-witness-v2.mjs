// P2a-v2: certifies a *particular factual sacrifice* of own-hand shape in
// exchange for genbutsu against exactly one named opponent. No danger odds,
// final choice, tactic superiority or causal seat importance are certified.
import {createHash} from 'node:crypto';
import {deriveGenbutsuContrast,verifyGenbutsuContrast} from './v14-seat-genbutsu-proof-v2.mjs';
const h=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const err=s=>{throw Error('tradeoff-witness-v2: '+s);};
const exact=(x,k)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join('|')===k.slice().sort().join('|');
const METRICS={shanten:{condition:(a,b)=>a>b,description:'safe option has more shanten (worse distance to ready)'},
 ukeireUpperBound:{condition:(a,b)=>a<b,description:'safe option has fewer upper-bound improving copies'},
 retainedDoraHan:{condition:(a,b)=>a<b,description:'safe option has fewer retained dora'}};
const get=(envelope,key)=>envelope.request.input.evidence.find(x=>x.id==='calc-'+key)?.value;
export function buildTradeoffWitness(envelope,genbutsuAction,otherAction,seat,metric){
 if(!Object.hasOwn(METRICS,metric))err('unsupported comparison metric');
 const p=deriveGenbutsuContrast(envelope,genbutsuAction,otherAction,seat);
 if(p.actionGenbutsu!==true||p.againstGenbutsu!==false)err('not a meaningful opponent-scoped genbutsu contrast');
 const a=get(envelope,genbutsuAction),b=get(envelope,otherAction);
 if(!a||!b||!Number.isInteger(a[metric])||!Number.isInteger(b[metric])||
    !METRICS[metric].condition(a[metric],b[metric]))err('safe option does not sacrifice this measured shape property');
 return {
  version:'p2a-v2-public-safety-shape-tradeoff-witness-1',
  requestHash:envelope.requestHash,
  seat,genbutsuAction,otherAction,metric,
  genbutsuValue:a[metric],otherValue:b[metric],
  evidence:{actionGenbutsuToSeat:true,otherActionGenbutsuToSeat:false},
  comparison:METRICS[metric].description,
  scope:'one named opponent, publicly visible genbutsu vs one shape metric; no inferred deal-in odds',
  certified:'candidate_specific_factual_tradeoff_only',
  tactics:'not_certified'
 };
}
export function verifyTradeoffWitness(envelope,witness){
 if(!exact(witness,['version','requestHash','seat','genbutsuAction','otherAction','metric','genbutsuValue','otherValue','evidence','comparison','scope','certified','tactics']))err('missing or excess fields');
 const expected=buildTradeoffWitness(envelope,witness.genbutsuAction,witness.otherAction,witness.seat,witness.metric);
 if(h(expected)!==h(witness))err('tradeoff fact mismatch');
 if(verifyGenbutsuContrast(envelope,deriveGenbutsuContrast(envelope,witness.genbutsuAction,witness.otherAction,witness.seat)).verified!=='public_discard_to_seat_match_only')err('river recheck failed');
 return {witnessVerified:true,seat:witness.seat,candidateTradeoff:'factually_documented',
  tactic:'not_certified',seatAsDecisionDriver:'not_certified',conditionalRisk:'unknown'};
}
export function scanTradeoffWitnesses(envelope){
 const i=envelope.request.input,b=i.evidence.find(e=>e.id==='board')?.value,actions=i.actions.filter(x=>x.group<=37);
 const result=[];
 for(let seat=0;seat<4;seat++){
  if(seat===b.ownSeat)continue;
  const safe=[],other=[];
  for(const a of actions){
   const v=get(envelope,a.key),p=v?.safety?.find(x=>x.seat===seat);
   if(p?.ownRiverGenbutsu===true)safe.push(a.key);
   else if(p?.ownRiverGenbutsu===false)other.push(a.key);
  }
  for(const a of safe)for(const c of other){
   const m=Object.keys(METRICS).find(k=>{
    const av=get(envelope,a)?.[k],bv=get(envelope,c)?.[k];
    return Number.isInteger(av)&&Number.isInteger(bv)&&METRICS[k].condition(av,bv);
   });
   if(m)result.push(buildTradeoffWitness(envelope,a,c,seat,m));
  }
 }
 return result;
}
