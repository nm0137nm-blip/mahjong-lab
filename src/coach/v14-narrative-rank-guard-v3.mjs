// Development-only, post-failure source-backed arithmetic guard for Japanese
// ChatGPT prose. Added AFTER seeing pilot-48 schema-v3 answer. This is an
// adversarial QA regression, not an independent held-out model-performance test.
// A clean result NEVER certifies every numeric sentence or tactical quality.
const int=s=>Number(String(s).replaceAll(',',''));
const mentions=(s,re)=>[...s.matchAll(re)].map(x=>x[1]);
function derive(board,amount,opp){
 const scores=board.scores.map(x=>({seat:x.seat,points:x.points+(x.seat===board.ownSeat?-amount:x.seat===opp?amount:0)}));
 const rankOrder=new Map(board.initialOrder.map((seat,i)=>[seat,i]));
 const ordered=[...scores].sort((a,b)=>b.points-a.points||rankOrder.get(a.seat)-rankOrder.get(b.seat));
 return {ownPoints:scores.find(x=>x.seat===board.ownSeat).points,
  opponentPoints:scores.find(x=>x.seat===opp).points,
  ownRank:ordered.findIndex(x=>x.seat===board.ownSeat)+1,
  opponentRank:ordered.findIndex(x=>x.seat===opp)+1};
}
export function auditV3NarrativeRankClaims(envelope,answer){
 const board=envelope?.request?.input?.evidence?.find(x=>x.id==='board')?.value;
 if(!board||!Array.isArray(board.scores)||board.scores.length!==4||
    !Array.isArray(board.initialOrder)||board.initialOrder.length!==4)
  throw Error('narrative-rank: missing public board');
 const sources=[];
 for(const k of ['explanation'])if(typeof answer?.evidenceProof?.[k]==='string')
  sources.push({path:'evidenceProof.'+k,text:answer.evidenceProof[k]});
 for(const category of ['importantSeats','uncertainSeats'])if(Array.isArray(answer?.[category]))
  for(const [i,row] of answer[category].entries())
   for(const field of ['whyMatters','changeCondition','reason'])
    if(typeof row[field]==='string')sources.push({path:category+'['+i+'].'+field,text:row[field]});
 for(const field of ['reason','opponentTradeoff','boundary','lesson'])
  if(typeof answer?.educational?.[field]==='string')
   sources.push({path:'educational.'+field,text:answer.educational[field]});
 const checked=[],unparsed=[],mismatches=[];
 for(const source of sources){
  for(const sentence0 of source.text.split(/[。\n]/)){
   const sentence=sentence0.trim();
   if(!sentence.includes('放銃')||!sentence.includes('点'))continue;
   // Only claim a check where one quoted payment and BOTH post-settlement
   // scores can be unambiguously extracted. Never invent missing numbers.
   const amountHits=mentions(sentence,/(\d[\d,]*)点放銃/g);
   if(amountHits.length!==1){unparsed.push({path:source.path,reason:'payment-amount-not-unique'});continue;}
   const amount=int(amountHits[0]);
   const ownHits=mentions(sentence,/自分(?:が|は)?\s*([\d,]+)点/g);
   const opponentHits=[];
   for(const r of sentence.matchAll(/席([013])(?:が|は)?\s*([\d,]+)点/g))
    if(r.index!==undefined)opponentHits.push({seat:Number(r[1]),points:int(r[2])});
   const explicit=sentence.match(/席([013])(?:へ|への|に)(?:[\s\S]{0,100}?)(?:\d[\d,]*点放銃)/);
   const seat=explicit?Number(explicit[1]):opponentHits.length===1?opponentHits[0].seat:null;
   if(!(Number.isSafeInteger(amount)&&amount>0)||ownHits.length!==1||opponentHits.length!==1||
      seat===null||seat!==opponentHits[0].seat||
      sentence.includes('立直後')||sentence.includes('供託')){
    unparsed.push({path:source.path,reason:'conditional-or-ambiguous-case'});
    continue;
   }
   const expected=derive(board,amount,seat);
   const actual={ownPoints:int(ownHits[0]),opponentPoints:opponentHits[0].points};
   const same=actual.ownPoints===expected.ownPoints&&actual.opponentPoints===expected.opponentPoints;
   const record={path:source.path,seat,claimedDealIn:amount,actual,expected};
   (same?checked:mismatches).push(record);
  }
 }
 return {scope:'partial_visible_prose_only_post_failure_development_QA',
  checkedClaims:checked.length+mismatches.length,
  matchedClaims:checked.length,mismatchedClaims:mismatches.length,
  mismatches,verified:checked,unparsedCount:unparsed.length,
  verdict:mismatches.length?'KNOWN_ARITHMETIC_CONTRADICTION':'NO_CONTRADICTION_IN_PARSED_CLAIMS_ONLY',
  limitations:['No guarantee every Japanese paraphrase parses',
    'No unverified opponent hands, probabilities or tactical model certification',
    'Assumes zero deposit change in the specific baseline hypotheticals; candidates after riichi deposit must be manually audited',
    'Added after viewing pilot-48 model error and not an independent ability benchmark']};
}
