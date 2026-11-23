// P2a-v4.4 new prospective verifier: expose action-specific public shape
// differences that remain real even when shanten/ukeire/dora totals tie.
// Constructed only from the immutable source. Not a Mortal or EV oracle.
// Historical v4.3 failures must never be retroactively re-graded by this file.
import {createHash} from 'node:crypto';
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const fail=x=>{throw Error('v44-public-shape: '+x);};
const E=(i,id)=>i.evidence.find(x=>x.id===id)?.value;
const tRE=/^(?:[mps][0-9]|z[1-7])$/;
const normList=value=>{
 if(!Array.isArray(value))return null;
 const result=value.map(x=>{
  if(!x||typeof x!=='object'||!tRE.test(x.tile)||
     !Number.isInteger(x.remainingUpperBound)||x.remainingUpperBound<0||
     x.remainingUpperBound>4)fail('untrusted improving source row');
  return {tile:x.tile,remainingUpperBound:x.remainingUpperBound};
 }).sort((x,y)=>x.tile.localeCompare(y.tile));
 if(new Set(result.map(x=>x.tile)).size!==result.length)fail('duplicate improving source tiles');
 return result;
};
export function getV44PublicActionShape(input,choice){
 if(!input||!Array.isArray(input.actions)||!Array.isArray(input.evidence)||
    !choice||typeof choice.key!=='string')fail('invalid public candidate');
 const action=input.actions.find(x=>x.key===choice.key);
 const calc=E(input,'calc-'+choice.key);
 if(!action||!calc)fail('candidate not present in immutable public source');
 let value=calc,discardTile=null;
 if(Array.isArray(calc.afterCallDiscards)){
  if(typeof choice.afterCallDiscard!=='string')fail('concrete after-call discard required');
  const rows=calc.afterCallDiscards.filter(x=>x.discard===choice.afterCallDiscard);
  if(rows.length!==1||!tRE.test(choice.afterCallDiscard))fail('illegal after-call discard');
  value=rows[0];discardTile=choice.afterCallDiscard;
 }else{
  if(choice.afterCallDiscard!==null)fail('spurious after-call discard');
  if(action.group<=37){
   const m=action.detail?.match(/[mps][0-9]|z[1-7]/);
   if(!m)fail('discard tile unavailable');
   discardTile=m[0];
  }
 }
 const standardShanten=Number.isInteger(value.forms?.standard)?
  value.forms.standard:null;
 return {key:choice.key,standardShanten,
  improving:normList(value.improving),discardTile,
  shanten:Number.isInteger(value.shanten)?value.shanten:null,
  ukeireUpperBound:Number.isInteger(value.ukeireUpperBound)?value.ukeireUpperBound:null,
  retainedDoraHan:Number.isInteger(value.retainedDoraHan)?value.retainedDoraHan:null};
}
export function createV44SourceShapeContrast(envelope,recommendation,alternative){
 if(!envelope||envelope.request?.stage!=='independent-v3-dev'||
  digest(envelope.request)!==envelope.requestHash||
  digest(envelope.request.input)!==envelope.request.sourcePublicInputHash)
  fail('source packet not immutable');
 const input=envelope.request.input;
 const left=getV44PublicActionShape(input,recommendation);
 const right=getV44PublicActionShape(input,alternative);
 const witness=[];
 if(left.standardShanten!==null&&right.standardShanten!==null&&
   left.standardShanten!==right.standardShanten){
  witness.push({type:'standardShanten',recommended:left.standardShanten,
   alternative:right.standardShanten,sourceFactIds:[
    'candidate:'+left.key+':standardShanten',
    'candidate:'+right.key+':standardShanten']});
 }
 if(left.improving!==null&&right.improving!==null&&
    JSON.stringify(left.improving)!==JSON.stringify(right.improving)){
  witness.push({type:'improvingComposition',recommended:left.improving,
   alternative:right.improving,sourceFactIds:[
    'candidate:'+left.key+':improvingSummary',
    'candidate:'+right.key+':improvingSummary']});
 }
 // Tile identity is a concrete public difference (risk and suji depend on the
 // actual discarded tile), but count it ONLY if a deeper standard-shape or
 // improving-composition difference is not already available. A model still
 // must cite both tile IDs and explain an opponent-dependent consequence.
 if(!witness.length&&left.discardTile!==null&&right.discardTile!==null&&
    left.discardTile!==right.discardTile)
  witness.push({type:'concreteDiscardTile',recommended:left.discardTile,
   alternative:right.discardTile,sourceFactIds:[
    'candidate:'+left.key+':discardTile',
    'candidate:'+right.key+':discardTile']});
 return Object.freeze({version:'p2a-v44-source-shape-comparison-1',
  sourceBound:true,candidateKeys:[left.key,right.key],
  witnesses:witness,verifiedAdditionalDifferences:witness.length,
  requiresModelCiteBothFactsWhenLegacyDifferencesZero:true,
  qualityDisclaimer:'These are public source distinctions only; NOT tactical EV or S42 agreement'});
}
