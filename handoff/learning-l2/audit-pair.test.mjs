import test from 'node:test';
import assert from 'node:assert/strict';
import {auditPair} from './audit-pair.mjs';
const h='a'.repeat(64),k='b'.repeat(64);
const source={matchId:'synthetic-1',seed:1,dealer:1,actorId:0,decisionIndex:17,ruleProfile:'tenhou-ranked-4p-red-hanchan-v1',prefixHash:h,preStateHash:h,publicViewHash:h,wallHash:h,legalSetHash:h,policyHash:h,ruleHash:h,originalLogHash:h,originalWallScheduleHash:h,legalPayloads:[{dapai:'m1'},{dapai:'m2_'}],originalAction:{dapai:'m1'}};
const common={...source,forcedCount:1,forcedDecisionIndex:17,fallbacks:0,illegalActions:0,complete:true,policyInputScope:'own-hand-and-public-events',privateStateReadByPolicy:false,wallScheduleMode:'seed-round-honba-occurrence-v1',commonWallKeysMismatch:0,finalLogHash:h,finalWallScheduleHash:h,finalScores:[25000,25000,25000,25000],finalRanks:[4,1,2,3],roundStartScores:[25000,25000,25000,25000],roundEndScores:[25000,25000,25000,25000],roundStartEscrow:0,roundEndEscrow:0};
function fixture(){return structuredClone({schema:'l2-pair-receipt-v1',source,baseline:{...common,forcedAction:{dapai:'m1'},appliedAction:{dapai:'m1'}},alternative:{...common,forcedAction:{dapai:'m2_'},appliedAction:{dapai:'m2_'},finalLogHash:k,finalScores:[26000,24000,25000,25000],finalRanks:[1,4,2,3],roundEndScores:[26000,24000,25000,25000]}})}
test('valid receipt and signed differences',()=>{const r=auditPair(fixture());assert.equal(r.roundNetDifference,1000);assert.equal(r.fourthDifference,-1);assert.equal(r.rankImprovement,3)});
const negatives=[
['private state',q=>q.alternative.preStateHash=k],
['public view',q=>q.alternative.publicViewHash=k],
['seed',q=>q.alternative.seed=2],
['policy hash',q=>q.alternative.policyHash=k],
['legal set',q=>q.alternative.legalPayloads=[{dapai:'m1'}]],
['illegal force',q=>q.alternative.forcedAction={dapai:'m3'}],
['not applied',q=>q.alternative.appliedAction={dapai:'m1'}],
['double force',q=>q.alternative.forcedCount=2],
['fallback',q=>q.alternative.fallbacks=1],
['leak',q=>q.alternative.privateStateReadByPolicy=true],
['common wall',q=>q.alternative.commonWallKeysMismatch=1],
['baseline replay',q=>q.baseline.finalLogHash=k],
['same action',q=>{q.alternative.forcedAction={dapai:'m1'};q.alternative.appliedAction={dapai:'m1'}}],
['bad conservation',q=>q.alternative.finalScores[0]++],
['tie',q=>q.baseline.finalRanks=[1,2,3,4]],
['escrow',q=>q.alternative.roundEndEscrow=1000],
['round start',q=>{q.alternative.roundStartScores[0]--;q.alternative.roundStartScores[1]++}],
['wrong decision',q=>q.alternative.forcedDecisionIndex=18],
['incomplete',q=>q.alternative.complete=false]];
for(const [name,change] of negatives)test('reject '+name,()=>{const q=fixture();change(q);assert.throws(()=>auditPair(q))});
