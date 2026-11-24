// Prototype only. No v45 changes, no retroactive scoring.
// A false-at-present public predicate + typed tactical change is mechanically
// checkable; whether that hypothetical actually warrants the change is semantic.
const fields=Object.freeze({riichi:'boolean',meldCount:'count',exposedDoraHan:'count',
 exposedYakuhaiHan:'count',discardCount:'count',points:'integer',pointGapFromOwn:'integer'});
// Conservative logical domains for public counters; this is not physical replay.
// Riichi is boolean. A threshold outside the observable domain is not a trigger.
const countMax=Object.freeze({meldCount:4,exposedDoraHan:80,exposedYakuhaiHan:5,discardCount:70});
const fail=x=>{throw Error('v46-structured-condition: '+x)};
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&
 Object.keys(x).sort().join('|')===keys.slice().sort().join('|');
function compare(a,op,b){
 switch(op){case 'eq':return a===b;case 'lt':return a<b;case 'lte':return a<=b;
 case 'gt':return a>b;case 'gte':return a>=b;default:fail('operator');}
}
export function verifyStructuredCondition(input,seat,condition){
 if(!input||!Array.isArray(input.evidence)||!Array.isArray(input.actions))fail('source');
 const board=input.evidence.find(e=>e.id==='board')?.value;
 if(!Number.isInteger(seat)||seat<0||seat>3||!Number.isInteger(board?.ownSeat)||seat===board.ownSeat)fail('opponent seat');
 const source=input.evidence.filter(e=>e.id==='public-value-'+seat);
 if(source.length!==1||!source[0].value)fail('missing/duplicate source seat');
 if(!exact(condition,['predicates','effect','explanation'])||
    typeof condition.explanation!=='string'||!condition.explanation.trim()||
    condition.explanation.length>1800)fail('shape or explanation');
 const ps=condition.predicates;
 if(!Array.isArray(ps)||ps.length<1||ps.length>3)fail('predicate count');
 const seen=new Set();
 const witness=ps.map(p=>{
  if(!exact(p,['factId','op','value'])||typeof p.factId!=='string')fail('predicate shape');
  const prefix='opponent:seat'+seat+':';
  if(!p.factId.startsWith(prefix)||seen.has(p.factId))fail('wrong seat or duplicate fact');
  seen.add(p.factId);
  const field=p.factId.slice(prefix.length);
  if(!Object.hasOwn(fields,field)||!Object.hasOwn(source[0].value,field))fail('unknown source fact');
  const kind=fields[field],current=source[0].value[field];
  if(kind==='boolean'){
   if(typeof current!=='boolean'||typeof p.value!=='boolean'||p.op!=='eq')fail('boolean type/operator');
  }else{
   if(!Number.isSafeInteger(current)||!Number.isSafeInteger(p.value)||
    !['eq','lt','lte','gt','gte'].includes(p.op))fail('integer type/operator');
   if(kind==='count'){
    const max=countMax[field];
    if(current<0||current>max||p.value<0||p.value>max||
       ![0,max,p.value].some(v=>compare(v,p.op,p.value)))
     fail('unreachable count predicate');
   }
  }
  return {factId:p.factId,current,op:p.op,hypothetical:p.value,alreadyTrue:compare(current,p.op,p.value)};
 });
 // Conjunction must not already hold in the frozen observation.
 if(witness.every(x=>x.alreadyTrue))fail('condition already holds');
 const e=condition.effect,roles=['recommendation','alternative'];
 if(e?.mode==='switch'){
  if(!exact(e,['mode','from','to'])||e.from!=='recommendation'||e.to!=='alternative')fail('invalid switch');
 }else if(e?.mode==='reweight'){
  if(!exact(e,['mode','target','direction'])||!roles.includes(e.target)||!['increase','decrease'].includes(e.direction))fail('invalid reweight');
 }else fail('unknown effect mode');
 return {seat,witness,effect:structuredClone(e),explicitSwitch:e.mode==='switch',
  semanticCertification:false,version:'p2a-v46-typed-public-condition-1'};
}
