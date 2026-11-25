// L2 experimental receipt guard; not an engine or independent proof of hashes/attestations.
export function auditPair(pair) {
  const fail = (why) => { throw new Error(why); };
  const check = (condition, why) => { if (!condition) fail(why); };
  const hex = v => typeof v === "string" && /^[0-9a-f]{64}$/.test(v);
  const integer = Number.isSafeInteger;
  const vector = v => Array.isArray(v) && v.length === 4 && v.every(integer);
  const eq = (a,b) => JSON.stringify(a) === JSON.stringify(b);
  const canonical = x => {
    if (x === null || typeof x === "string" || typeof x === "boolean") return JSON.stringify(x);
    if (typeof x === "number" && Number.isSafeInteger(x)) return JSON.stringify(x);
    if (Array.isArray(x)) return "[" + x.map(canonical).join(",") + "]";
    if (typeof x === "object" && x !== null && Object.getPrototypeOf(x) === Object.prototype)
      return "{" + Object.keys(x).sort().map(k => JSON.stringify(k)+":"+canonical(x[k])).join(",") + "}";
    fail("noncanonical action payload");
  };
  const validateAction = a => {
    check(a && Object.getPrototypeOf(a)===Object.prototype, "invalid action object");
    const keys = Object.keys(a);
    check(keys.length<=1, "ambiguous action payload");
    if (!keys.length) return canonical(a); // pass
    const k=keys[0], v=a[k];
    check(["dapai","fulou","gang","hule","daopai"].includes(k), "unknown action kind");
    check(typeof v==="string" && v.length>0, "invalid action value");
    return canonical(a);
  };
  check(pair && pair.schema==="l2-pair-receipt-v1", "schema");
  const {source, baseline, alternative} = pair;
  check(source && baseline && alternative, "missing branch");
  check(typeof source.matchId==="string" && source.matchId.length>0, "match cluster");
  check(integer(source.seed) && source.seed>0 && source.seed<=0xffffffff, "seed");
  check(integer(source.dealer) && source.dealer>=0 && source.dealer<4, "initial dealer");
  check(integer(source.actorId) && source.actorId>=0 && source.actorId<4, "actor identity");
  check(integer(source.decisionIndex) && source.decisionIndex>0, "decision index");
  check(source.ruleProfile==="tenhou-ranked-4p-red-hanchan-v1", "rule profile");
  for (const k of ["prefixHash","preStateHash","publicViewHash","wallHash","legalSetHash","policyHash","ruleHash","originalLogHash","originalWallScheduleHash"])
    check(hex(source[k]), "missing source digest "+k);
  check(Array.isArray(source.legalPayloads) && source.legalPayloads.length>=2,"no real choice");
  const legal = source.legalPayloads.map(validateAction);
  check(new Set(legal).size===legal.length,"duplicate concrete legal payload");
  const originalAction = validateAction(source.originalAction);
  check(legal.includes(originalAction),"source action illegal");
  for(const b of [baseline,alternative]){
    for(const k of ["seed","dealer","actorId","decisionIndex","ruleProfile","prefixHash","preStateHash","publicViewHash","wallHash","legalSetHash","policyHash","ruleHash"])
      check(b[k]===source[k],"prefix/config mismatch "+k);
    check(Array.isArray(b.legalPayloads) && eq(b.legalPayloads.map(validateAction).sort(),legal.slice().sort()),"concrete legal set mismatch");
    check(legal.includes(validateAction(b.forcedAction)),"illegal forced action");
    check(validateAction(b.forcedAction)===validateAction(b.appliedAction),"forced action not applied");
    check(b.forcedCount===1 && b.forcedDecisionIndex===source.decisionIndex,"intervention count/index");
    check(b.fallbacks===0 && b.illegalActions===0 && b.complete===true,"invalid continuation");
    check(b.policyInputScope==="own-hand-and-public-events" && b.privateStateReadByPolicy===false,"policy boundary not attested");
    check(b.wallScheduleMode==="seed-round-honba-occurrence-v1" && b.commonWallKeysMismatch===0,"common wall schedule mismatch");
    check(hex(b.finalLogHash)&&hex(b.finalWallScheduleHash),"missing output digest");
    check(vector(b.finalScores) && b.finalScores.reduce((a,c)=>a+c,0)===100000,"final score conservation");
    check(vector(b.finalRanks) && eq(b.finalRanks.slice().sort((a,c)=>a-c),[1,2,3,4]),"rank permutation");
    const order=[0,1,2,3].sort((a,c)=>b.finalScores[c]-b.finalScores[a]||((a-source.dealer+4)%4)-((c-source.dealer+4)%4));
    check(order.every((id,i)=>b.finalRanks[id]===i+1),"rank/tie mismatch");
    check(vector(b.roundStartScores) && vector(b.roundEndScores) && integer(b.roundStartEscrow) && integer(b.roundEndEscrow),"round boundary missing");
    check(b.roundStartEscrow>=0&&b.roundEndEscrow>=0&&b.roundStartEscrow%1000===0&&b.roundEndEscrow%1000===0,"invalid escrow");
    check(b.roundStartScores.reduce((a,c)=>a+c,0)+b.roundStartEscrow===100000 && b.roundEndScores.reduce((a,c)=>a+c,0)+b.roundEndEscrow===100000,"round score conservation");
  }
  check(validateAction(baseline.forcedAction)===originalAction,"baseline not source action");
  check(baseline.finalLogHash===source.originalLogHash && baseline.finalWallScheduleHash===source.originalWallScheduleHash,"baseline does not reproduce original");
  check(validateAction(alternative.forcedAction)!==originalAction,"no intervention difference");
  check(eq(baseline.roundStartScores,alternative.roundStartScores) && baseline.roundStartEscrow===alternative.roundStartEscrow,"round start mismatch");
  const i=source.actorId;
  return {status:"PAIR_RECEIPT_CHECK_PASS_NOT_STRATEGY_CERTIFICATION", matchId:source.matchId, decisionIndex:source.decisionIndex, actorId:i, roundNetDifference:(alternative.roundEndScores[i]-alternative.roundStartScores[i])-(baseline.roundEndScores[i]-baseline.roundStartScores[i]), finalScoreDifference:alternative.finalScores[i]-baseline.finalScores[i], fourthDifference:Number(alternative.finalRanks[i]===4)-Number(baseline.finalRanks[i]===4), rankImprovement:baseline.finalRanks[i]-alternative.finalRanks[i]};
}
