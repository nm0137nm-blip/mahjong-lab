// Public code-generated v4 comparison facts: generated, not authored by the
// independent LLM; false comparisons never become a strategy claim.
import {createV3PublicContrastFixture,verifyV3PublicContrast} from './v14-evidence-proof-v3.mjs';
const source=(i,id)=>i.evidence.find(x=>x.id===id)?.value;
const comparable=(a,b)=>a===b?'same':'different';
const hash=x=>JSON.stringify(x);
function materialize(input,c){
 const action=input.actions.find(a=>a.key===c.key),calc=source(input,'calc-'+c.key);
 if(!action||!calc)throw Error('v4-proof: unknown action');
 const value=Array.isArray(calc.afterCallDiscards)?
  calc.afterCallDiscards.find(x=>x.discard===c.afterCallDiscard):calc;
 return {action,value};
}
function byChoice(value,tile,kind){
 const x=value?.conditionalNormalWins?.find(x=>x.tile===tile);
 if(!x)return {status:'not_supplied'};
 const v=x[kind];
 return v?{status:'conditionally_scored',basePoints:v.basePoints,yaku:[...v.yaku]}:
  {status:'no_scored_win_under_assumptions'};
}
const safe=(x,seat)=>x?.safety?.find(v=>v.seat===seat)?.ownRiverGenbutsu;
const diff=(a,b)=>a<b?'lower':a>b?'higher':'same';
export function createV4DeterministicSourceComparison(envelope,rec,alt){
 const input=envelope.request.input,a=materialize(input,rec),b=materialize(input,alt);
 const proof=createV3PublicContrastFixture(envelope,rec,alt);
 const facts=proof.comparisons,seat=input.evidence.find(x=>x.id==='board')?.value.ownSeat;
 const push=row=>{if(facts.length<15)facts.push(row);};
 if(typeof a.value?.ownRiverFuriten==='boolean'&&typeof b.value?.ownRiverFuriten==='boolean')
  push({type:'furiten',recommended:a.value.ownRiverFuriten,
   alternative:b.value.ownRiverFuriten,relation:comparable(a.value.ownRiverFuriten,b.value.ownRiverFuriten)});
 for(const s of [0,1,2,3].filter(i=>i!==seat)){
  const left=safe(a.value,s),right=safe(b.value,s);
  if(typeof left==='boolean'&&typeof right==='boolean')
   push({type:'seatGenbutsu',seat:s,recommended:left,alternative:right,relation:comparable(left,right)});
 }
 const tiles=new Set([...(a.value?.conditionalNormalWins||[]).map(x=>x.tile),
  ...(b.value?.conditionalNormalWins||[]).map(x=>x.tile)]);
 const modeA=a.action.group===37?'hypotheticalRiichiRon':'ron';
 const modeB=b.action.group===37?'hypotheticalRiichiRon':'ron';
 for(const tile of tiles){
  if(facts.length>=15)break;
  const x=byChoice(a.value,tile,modeA),y=byChoice(b.value,tile,modeB);
  push({type:'conditionalRonByChoice',tile,recommendedMode:modeA,alternativeMode:modeB,
   recommended:x,alternative:y,relation:comparable(hash(x),hash(y))});
 }
 const result=verifyV3PublicContrast(envelope,proof);
 return {proof,publicDifferences:result.meaningfullyDistinctPublicFacts,
  proofStatus:result.meaningfullyDistinctPublicFacts>=1?'meaningful_differences_proven':'no_public_differentiator_available',
  tacticalRecommendationQuality:'NOT_TESTED'};
}
