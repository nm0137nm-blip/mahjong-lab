// P2a-v2 research: mechanically verify a concrete A-vs-B calculation and
// seat-specific observable claims. This is NOT a proof of tactical correctness.
// Never classify generic natural language as an expert explanation from this gate.
import {createHash} from 'node:crypto';

export const PROOF_VERSION = 'v14-conditional-evidence-proof-v2';
const error = m => {throw new Error('v2-proof: '+m);};
const sha = x => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const sameKeys=(x,keys)=>!!x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join('|')===keys.slice().sort().join('|');
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const sentence=x=>typeof x==='string'&&x.trim().length>=8&&x.length<=2000;
const NUMERIC=['shanten','ukeireUpperBound','retainedDoraHan'];
const SEAT_FIELDS=['riichi','meldCount','exposedDoraHan','exposedYakuhaiHan','discardCount','points','pointGapFromOwn'];
const resolve=(i,id)=>i.evidence.find(e=>e.id===id)?.value;
const relation=(a,b)=>a<b?'lower':a>b?'higher':'same';
function option(input,key,afterDiscard){
 if(!input.actions.some(a=>a.key===key))error('illegal candidate '+key);
 const value=resolve(input,'calc-'+key);
 if(!value||typeof value!=='object')error('missing calculated candidate '+key);
 if(Array.isArray(value.afterCallDiscards)){
  if(typeof afterDiscard!=='string'||!afterDiscard)error('after-call discard required');
  const rows=value.afterCallDiscards.filter(r=>r.discard===afterDiscard);
  if(rows.length!==1)error('ambiguous or unavailable after-call discard');
  return rows[0];
 }
 if(afterDiscard!==null)error('unexpected after-call discard');
 return value;
}
function expectedMetric(input,key,afterDiscard,metric){
 const val=option(input,key,afterDiscard)[metric];
 if(!finite(val))error('metric unavailable or conditional');
 return val;
}
export function verifyConditionalProof(envelope,proof){
 if(!sameKeys(envelope,['request','requestHash'])||
    !['independent','independent-v2-dev'].includes(envelope.request?.stage)||
    sha(envelope.request)!==envelope.requestHash)error('tampered frozen input');
 const i=envelope.request.input;
 if(!sameKeys(proof,['version','requestHash','recommendation','alternative','comparisons','opponentObservations','reversal','explanation'])||
    proof.version!==PROOF_VERSION||proof.requestHash!==envelope.requestHash)error('proof input binding');
 if(proof.recommendation===proof.alternative||
    !i.actions.some(a=>a.key===proof.recommendation)||
    !i.actions.some(a=>a.key===proof.alternative))error('invalid candidate contrast');
 if(!Array.isArray(proof.comparisons)||proof.comparisons.length<1||proof.comparisons.length>10)error('missing bounded comparisons');
 let distinct=0;
 const used=new Set();
 for(const c of proof.comparisons){
  if(!sameKeys(c,['metric','recommended','alternative','relation','recommendedAfterCallDiscard','alternativeAfterCallDiscard'])||
     !NUMERIC.includes(c.metric)||!finite(c.recommended)||!finite(c.alternative)||
     !['higher','lower','same'].includes(c.relation)||used.has(c.metric))error('invalid or duplicate numerical comparison');
  used.add(c.metric);
  const a=expectedMetric(i,proof.recommendation,c.recommendedAfterCallDiscard,c.metric);
  const b=expectedMetric(i,proof.alternative,c.alternativeAfterCallDiscard,c.metric);
  if(c.recommended!==a||c.alternative!==b||c.relation!==relation(a,b))error('untrue candidate calculation');
  if(a!==b)distinct++;
 }
 if(!distinct)error('only equal metrics: no meaningful quantitative contrast');
 if(!Array.isArray(proof.opponentObservations)||proof.opponentObservations.length<1||proof.opponentObservations.length>3)error('no opponent-specific observations');
 const own=resolve(i,'board')?.ownSeat; if(!Number.isInteger(own))error('missing own seat');
 const seats=new Set();
 for(const o of proof.opponentObservations){
  if(!sameKeys(o,['seat','field','value','assessment'])||
     !Number.isInteger(o.seat)||o.seat<0||o.seat>3||o.seat===own||
     !SEAT_FIELDS.includes(o.field)||!['potentially_relevant','not_established'].includes(o.assessment)||
     seats.has(o.seat))error('invalid opponent observation');
  seats.add(o.seat);
  const info=resolve(i,'public-value-'+o.seat);
  if(!info||!Object.hasOwn(info,o.field)||sha(info[o.field])!==sha(o.value))error('false or mismatched opponent fact');
 }
 if(!sameKeys(proof.reversal,['unknownFactors','ifThen'])||
    !Array.isArray(proof.reversal.unknownFactors)||
    proof.reversal.unknownFactors.length<1||
    proof.reversal.unknownFactors.length>6||
    !proof.reversal.unknownFactors.every(x=>typeof x==='string'&&/^[a-zA-Z][a-zA-Z0-9_]{1,40}$/.test(x))||
    new Set(proof.reversal.unknownFactors).size!==proof.reversal.unknownFactors.length||
    !sentence(proof.reversal.ifThen)||!sentence(proof.explanation))error('unverifiable or absent condition fields');
 return {
  version:PROOF_VERSION,requestHash:envelope.requestHash,
  candidateFactsVerified:proof.comparisons.length,
  opponentFactsVerified:proof.opponentObservations.length,
  distinctCandidateMetrics:distinct,
  deterministicGate:'pass',
  // Do not silently upgrade a proof of accurate inputs to tactical validity.
  tacticalCausality:'not_certified',
  semanticExplanation:'not_certified',
  rolloutValue:'not_certified',
  expertLevel:'not_certified',
  purpose:'development-only-positive-and-negative-validator-QA'
 };
}
// Explicitly labeled known-good ARITHMETIC fixture, not a model output or
// chess/mahjong strategic oracle. Useful for testing an all-reject evaluator.
export function makeArithmeticFixture(envelope){
 const i=envelope.request.input,board=resolve(i,'board'),actions=i.actions;
 for(const a of actions)for(const b of actions){
  if(a.key===b.key)continue;
  const ca=resolve(i,'calc-'+a.key),cb=resolve(i,'calc-'+b.key);
  if(!ca||!cb)continue;
  const aa=Array.isArray(ca.afterCallDiscards)?ca.afterCallDiscards[0]:ca;
  const bb=Array.isArray(cb.afterCallDiscards)?cb.afterCallDiscards[0]:cb;
  if(!aa||!bb)continue;
  const metric=NUMERIC.find(m=>finite(aa[m])&&finite(bb[m])&&aa[m]!==bb[m]);
  if(!metric)continue;
  const seat=[0,1,2,3].find(x=>x!==board.ownSeat&&resolve(i,'public-value-'+x));
  if(seat===undefined)continue;
  const v=resolve(i,'public-value-'+seat),field='riichi';
  const c={metric,recommended:aa[metric],alternative:bb[metric],relation:relation(aa[metric],bb[metric]),recommendedAfterCallDiscard:Array.isArray(ca.afterCallDiscards)?aa.discard:null,alternativeAfterCallDiscard:Array.isArray(cb.afterCallDiscards)?bb.discard:null};
  return {
   version:PROOF_VERSION,requestHash:envelope.requestHash,
   recommendation:a.key,alternative:b.key,comparisons:[c],
   opponentObservations:[{seat,field,value:v[field],assessment:'not_established'}],
   reversal:{unknownFactors:['pWin','pDealIn'],ifThen:'和了と放銃の未知頻度によって最適な押し引きは変わり得るため、方向性は未認定。'},
   explanation:'算術テスト用の正例。戦術判断の正しさや他家が真の決定要因であることは示さない。'
  };
 }
 error('no arithmetically distinct candidate pair (not a quality failure)');
}
