// P2a-v2: mechanically verifiable *seat-specific* genbutsu relationship.
// A non-genbutsu tile is NOT necessarily unsafe. No ron probability, tenpai,
// point EV, or globally safe tile is inferred.
import {createHash} from 'node:crypto';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const fail=x=>{throw Error('seat-proof-v2: '+x);};
const exact=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===k.slice().sort().join('|');
function derive(envelope,a,b,seat){
 if(!exact(envelope,['request','requestHash'])||
    !['independent','independent-v2-dev'].includes(envelope.request?.stage)||
    hash(envelope.request)!==envelope.requestHash)fail('bad frozen public input');
 if(!Number.isInteger(seat)||seat<0||seat>3)fail('illegal seat');
 const i=envelope.request.input,own=i.evidence.find(e=>e.id==='board')?.value.ownSeat;
 if(seat===own)fail('own seat is not a defender');
 const action=new Map(i.actions.map(x=>[x.key,x]));
 if(a===b||!action.has(a)||!action.has(b))fail('illegal or same candidates');
 const get=key=>{
  const act=action.get(key);
  if(act.group>=37)fail('only a concrete discard group with safety evidence');
  const c=i.evidence.find(e=>e.id==='calc-'+key)?.value;
  if(!c||!Array.isArray(c.safety))fail('candidate safety absent');
  const matches=c.safety.filter(x=>x.seat===seat);
  if(matches.length!==1||typeof matches[0].ownRiverGenbutsu!=='boolean')fail('target seat safety not known');
  return matches[0].ownRiverGenbutsu;
 };
 const left=get(a),right=get(b);
 return {version:'p2a-v2-genbutsu-certificate-1',requestHash:envelope.requestHash,
  seat,action:a,against:b,actionGenbutsu:left,againstGenbutsu:right,
  contrast:left!==right?'different_certainty':'equal_certainty',
  relation:left===right?'same':left?'action_proven_genbutsu_other_not_proven':'against_proven_genbutsu_action_not_proven',
  scope:'only certified no ron from THIS opponent by already discarded tile',
  warning:'not proof that a non-genbutsu tile is dangerous, and not proof of optimal tactical choice'};
}
export function deriveGenbutsuContrast(envelope,action,against,seat){
 return derive(envelope,action,against,seat);
}
export function verifyGenbutsuContrast(envelope,certificate){
 if(!exact(certificate,['version','requestHash','seat','action','against','actionGenbutsu','againstGenbutsu','contrast','relation','scope','warning']))fail('unknown certificate field or missing data');
 const expected=derive(envelope,certificate.action,certificate.against,certificate.seat);
 if(hash(certificate)!==hash(expected))fail('false genbutsu statement, wrong seat, or altered relation');
 return {verified:'public_discard_to_seat_match_only',seat:certificate.seat,
  meaningfulDistinctCertainty:expected.contrast==='different_certainty',
  opponentTacticalInfluence:'not_certified',
  dealInRate:'unknown',overallOptimality:'not_certified'};
}
export function scanGenbutsuContrastExamples(envelope){
 if(!exact(envelope,['request','requestHash'])||hash(envelope.request)!==envelope.requestHash)fail('tampered frozen input');
 const i=envelope.request.input,own=i.evidence.find(e=>e.id==='board')?.value.ownSeat;
 const actions=i.actions.filter(x=>x.group<37);
 const out=[];
 for(let seat=0;seat<4;seat++){
  if(seat===own)continue;
  const safe=[],unknown=[];
  for(const a of actions){
   const calc=i.evidence.find(e=>e.id==='calc-'+a.key)?.value;
   const item=calc?.safety?.find(x=>x.seat===seat);
   if(item?.ownRiverGenbutsu===true)safe.push(a.key);
   else if(item?.ownRiverGenbutsu===false)unknown.push(a.key);
  }
  if(safe.length&&unknown.length)out.push({
   seat,caseId:i.id,certifiableContrastPairs:safe.length*unknown.length,
   example:derive(envelope,safe[0],unknown[0],seat)});
 }
 return out;
}
