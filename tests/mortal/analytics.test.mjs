import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeDecision,analyzeAction,actionForDiscard,aggregateDecisions,combineAggregates,
  INDEX_VERSION,RATING_VERSION,BAD_MOVE_VERSION,SOFTMAX_TEMPERATURE,BAD_MOVE_THRESHOLD,
  RATING_TEXT
} from '../../src/mortal/s42-analytics.mjs';

const approx=(actual,expected,epsilon=1e-10)=>{
  assert.ok(Math.abs(actual-expected)<epsilon,'expected '+expected+' but got '+actual);
};
const q=Array(46).fill(null);
q[0]=0;q[1]=-0.01;q[2]=-0.4;q[37]=-1;
const op={best:0,qLegal:q};
const chosen=(action)=>analyzeAction(op,action);

test('tile mapping and independent version tags',()=>{
  assert.equal(actionForDiscard('m0'),34);
  assert.equal(actionForDiscard('z7'),33);
  assert.equal(actionForDiscard('p5_'),13);
  assert.equal(actionForDiscard('s5',true),37);
  assert.equal(actionForDiscard('m9'),8);
  assert.equal(INDEX_VERSION,'S42-relative-Q-v1');
  assert.equal(RATING_VERSION,'S42-mjai-reviewer-rating-v1');
  assert.equal(BAD_MOVE_VERSION,'S42-softmax-0.1-under5-v1');
  assert.equal(SOFTMAX_TEMPERATURE,0.1);
  assert.equal(BAD_MOVE_THRESHOLD,0.05);
});

test('Mortal recommendation from legal Q uses stable temperature-0.1 softmax',()=>{
  const best=analyzeDecision(op,'m1');
  const second=analyzeDecision(op,'m2');
  const poor=analyzeDecision(op,'m3');
  assert.equal(best.agreement,true);
  assert.equal(best.ratingContribution,1);
  assert.equal(best.badMove,false);
  assert.equal(second.rank,2);
  assert.equal(second.badMove,false);
  assert.equal(poor.rank,3);
  assert.equal(poor.badMove,true);
  approx(poor.ratingContribution,0.6);
  approx(poor.relativeGap,0.4);
  const denom=1+Math.exp(-0.1)+Math.exp(-4)+Math.exp(-10);
  approx(best.recommendation,1/denom);
  approx(second.recommendation,Math.exp(-.1)/denom);
  approx(poor.recommendation,Math.exp(-4)/denom);
  approx(best.top.reduce((s,x)=>s+x.recommendation,0),1);
  approx(poor.stateValue,-1.41/4);
  approx(poor.chosenQ,poor.stateValue+poor.chosenAdvantage);
  assert.equal(analyzeDecision(op,'p2'),null);
});

test('strict under-five classification, without rounding recommendation',()=>{
  const make=diff=>{
    const vals=Array(46).fill(null);
    vals[0]=0;vals[1]=-diff;
    return analyzeAction({best:0,qLegal:vals},1);
  };
  const boundary=SOFTMAX_TEMPERATURE*Math.log(19);
  approx(make(boundary).recommendation,0.05);
  assert.equal(make(boundary-1e-5).badMove,false);
  assert.equal(make(boundary+1e-5).badMove,true);
});

test('only legal choices, with a minimum of two actions; numerically stable softmax',()=>{
  const vals=Array(46).fill(null);
  vals[0]=10000;vals[1]=9999.9;
  const out=analyzeAction({best:0,qLegal:vals},1);
  assert.ok(out.recommendation>0&&out.recommendation<1);
  assert.equal(analyzeAction({best:0,qLegal:vals},2),null);
  const single=Array(46).fill(null);single[0]=1;
  assert.equal(analyzeAction({best:0,qLegal:single},0),null);
});

test('official reviewer: exact model choice contributes 1, including equal-Q ties',()=>{
  const vals=Array(46).fill(null);vals[0]=0;vals[1]=0;
  const exact=analyzeAction({best:1,qLegal:vals},1);
  assert.equal(exact.ratingContribution,1);
  assert.equal(exact.rank,1);
  // Official mjai-reviewer awards 1 to the exact action; otherwise uses
  // (chosen - minimum) / max(1e-6, maximum - minimum).
  const other=analyzeAction({best:1,qLegal:vals},0);
  assert.equal(other.ratingContribution,0);
  assert.equal(other.agreement,false);
});

test('official reviewer: Q range floor 1e-6 rather than 1e-9',()=>{
  const vals=Array(46).fill(null);vals[0]=0;vals[1]=-1e-8;vals[2]=-2e-8;
  const next=analyzeAction({best:0,qLegal:vals},1);
  approx(next.ratingContribution,0.01);
});

test('Mortal Rating is square of mean UNROUNDED contributions, not mean squared',()=>{
  const vals=Array(46).fill(null);vals[0]=1;vals[1]=1/3;vals[2]=0;
  const mid=analyzeAction({best:0,qLegal:vals},1);
  const good=analyzeAction({best:0,qLegal:vals},0);
  const r=aggregateDecisions([{type:'discard',s42Review:mid},{type:'discard',s42Review:good}]);
  const expected=100*Math.pow((1/3+1)/2,2);
  approx(r.ratingRawSum,4/3);
  approx(r.rating,expected);
  assert.equal(r.ratingVersion,RATING_VERSION);
  assert.equal(r.version,RATING_VERSION);
  assert.equal(r.ratingCount,2);
  assert.equal(RATING_TEXT(r.rating),expected.toFixed(1)+'/100');
});

test('official-style rating includes calls, pass, and riichi, while bad rate uses discards only',()=>{
  const good=analyzeDecision(op,'m1'),bad=analyzeDecision(op,'m3');
  const agg=aggregateDecisions([
    {type:'discard',s42Review:good},
    {type:'discard',s42Review:bad},
    {type:'discard',s42Review:null},
    {type:'call',s42Review:bad},
    {type:'discard',riichiAvailable:true,s42Review:analyzeDecision(op,'m1',true)}
  ]);
  assert.equal(agg.count,4);
  assert.equal(agg.ratingCount,4);
  assert.equal(agg.agreements,1);
  assert.equal(agg.callCount,1);
  assert.equal(agg.riichiCount,1);
  assert.equal(agg.discardCount,4);
  assert.equal(agg.badReviewed,3);
  assert.equal(agg.badCount,2);
  assert.equal(agg.badMoveRate,2/3);
  approx(agg.rating,100*Math.pow((1+0.6+0.6+0)/4,2));
});

test('across matches, pooled raw contributions must be squared AFTER weighted aggregation',()=>{
  const good=chosen(0),worst=chosen(37);
  const first=aggregateDecisions([{type:'discard',s42Review:good}]);
  const second=aggregateDecisions([
    {type:'discard',s42Review:worst},{type:'discard',s42Review:worst},
    {type:'discard',s42Review:worst}
  ]);
  approx(first.rating,100);approx(second.rating,0);
  const all=combineAggregates([first,second]);
  assert.equal(all.ratingCount,4);
  approx(all.ratingRawSum,1);
  approx(all.rating,6.25);
  assert.notEqual(all.rating,25);
  approx(all.agreementRate,0.25);
});

test('historical in-house index cannot be converted into an official rating',()=>{
  const fresh=aggregateDecisions([
    {type:'discard',s42Review:analyzeDecision(op,'m1')},
    {type:'discard',s42Review:analyzeDecision(op,'m3')}
  ]);
  const legacy={version:INDEX_VERSION,count:3,index:65,agreements:2,suspected:3,badCandidateRate:1};
  const compatibleBadRateLegacy={
    version:INDEX_VERSION,count:2,index:90,agreements:1,
    badRateVersion:BAD_MOVE_VERSION,badReviewed:2,badCount:1
  };
  const all=combineAggregates([fresh,legacy,compatibleBadRateLegacy,{},null]);
  assert.equal(all.count,7);
  assert.equal(all.ratingCount,2);
  approx(all.rating,64);
  assert.equal(all.badReviewed,4);
  assert.equal(all.badCount,2);
  approx(all.badMoveRate,0.5);
  approx(all.agreementRate,(fresh.agreements+2+1)/7);
  assert.equal(combineAggregates([legacy]).rating,null);
  assert.equal(combineAggregates([legacy]).ratingCount,0);
  assert.equal(combineAggregates([legacy]).badMoveRate,null);
  assert.equal(combineAggregates([]).rating,null);
});

test('5% low-recommendation and min-max rating are different measures',()=>{
  const vals=Array(46).fill(null);vals[0]=0;vals[1]=-0.4;vals[2]=-1.5;
  const r=analyzeAction({best:0,qLegal:vals},1);
  assert(r.relativeGap<0.30);
  assert(r.recommendation<0.05);
  assert(r.badMove);
  approx(r.ratingContribution,1.1/1.5);
});
