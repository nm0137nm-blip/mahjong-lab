import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeDecision,analyzeAction,actionForDiscard,aggregateDecisions,combineAggregates,
  INDEX_VERSION,BAD_MOVE_VERSION,SOFTMAX_TEMPERATURE,BAD_MOVE_THRESHOLD
} from '../../src/mortal/s42-analytics.mjs';

const q=Array(46).fill(null);
q[0]=0;q[1]=-0.01;q[2]=-0.4;q[37]=-1;
const op={best:0,qLegal:q};

test('S42 tile and reach action mapping',()=>{
  assert.equal(actionForDiscard('m0'),34);
  assert.equal(actionForDiscard('z7'),33);
  assert.equal(actionForDiscard('p5_'),13);
  assert.equal(actionForDiscard('s5',true),37);
  assert.equal(actionForDiscard('m9'),8);
  assert.equal(INDEX_VERSION,'S42-relative-Q-v1');
  assert.equal(BAD_MOVE_VERSION,'S42-softmax-0.1-under5-v1');
  assert.equal(SOFTMAX_TEMPERATURE,0.1);
  assert.equal(BAD_MOVE_THRESHOLD,0.05);
});

test('Mortal recommendation from legal Q uses stable temperature-0.1 softmax',()=>{
  const best=analyzeDecision(op,'m1');
  const second=analyzeDecision(op,'m2');
  const poor=analyzeDecision(op,'m3');
  assert.equal(best.agreement,true);
  assert.equal(best.index,100);
  assert.equal(best.badMove,false);
  assert.equal(second.rank,2);
  assert.equal(second.badMove,false);
  assert.equal(poor.rank,3);
  assert.equal(poor.badMove,true);
  assert.equal(poor.index,60);
  assert(Math.abs(poor.relativeGap-0.4)<1e-12);
  const denom=1+Math.exp(-0.1)+Math.exp(-4)+Math.exp(-10);
  assert(Math.abs(best.recommendation-1/denom)<1e-12);
  assert(Math.abs(second.recommendation-Math.exp(-.1)/denom)<1e-12);
  assert(Math.abs(poor.recommendation-Math.exp(-4)/denom)<1e-12);
  assert(Math.abs(best.top.reduce((s,x)=>s+x.recommendation,0)-1)<1e-12);
  assert(Math.abs(poor.stateValue-(-1.41/4))<1e-12);
  assert(Math.abs(poor.chosenQ-(poor.stateValue+poor.chosenAdvantage))<1e-12);
  assert.equal(analyzeDecision(op,'p2'),null);
});

test('strict under-five threshold, with no rounding before classification',()=>{
  const make=diff=>{
    const vals=Array(46).fill(null);
    vals[0]=0;vals[1]=-diff;
    return analyzeAction({best:0,qLegal:vals},1);
  };
  const boundary=SOFTMAX_TEMPERATURE*Math.log(19);
  assert(Math.abs(make(boundary).recommendation-0.05)<1e-12);
  assert.equal(make(boundary-1e-5).badMove,false);
  assert.equal(make(boundary+1e-5).badMove,true);
});

test('probabilities ignore illegal actions, handle huge Q without overflow and flag only legal choices',()=>{
  const vals=Array(46).fill(null);
  vals[0]=10000;vals[1]=9999.9;
  const out=analyzeAction({best:0,qLegal:vals},1);
  assert(Number.isFinite(out.recommendation));
  assert(out.recommendation>0&&out.recommendation<1);
  assert.equal(analyzeAction({best:0,qLegal:vals},2),null);
  const noCompetition=Array(46).fill(null);noCompetition[0]=1;
  assert.equal(analyzeAction({best:0,qLegal:noCompetition},0),null);
});

test('bad move rate includes only evaluated discards, not call/skip, and skips unscored plays',()=>{
  const good=analyzeDecision(op,'m1'),bad=analyzeDecision(op,'m3');
  const agg=aggregateDecisions([
    {type:'discard',s42Review:good},
    {type:'discard',s42Review:bad},
    {type:'discard',s42Review:null},
    {type:'call',s42Review:bad},
    {type:'discard',riichiAvailable:true,s42Review:analyzeDecision(op,'m1',true)}
  ]);
  assert.equal(agg.count,4);
  assert.equal(agg.agreements,1);
  assert.equal(agg.callCount,1);
  assert.equal(agg.riichiCount,1);
  assert.equal(agg.discardCount,4);
  assert.equal(agg.badReviewed,3);
  assert.equal(agg.badCount,2);
  assert.equal(agg.badMoveRate,2/3);
  assert.equal(agg.badRateVersion,BAD_MOVE_VERSION);
  assert.equal(agg.index,Math.round((good.index+bad.index+bad.index+0)/4));
});

test('new bad rate never silently backfills old relative-Q records',()=>{
  const fresh=aggregateDecisions([
    {type:'discard',s42Review:analyzeDecision(op,'m1')},
    {type:'discard',s42Review:analyzeDecision(op,'m3')}
  ]);
  const legacy={version:INDEX_VERSION,count:3,index:65,agreements:2,suspected:3,badCandidateRate:1};
  const all=combineAggregates([fresh,legacy,{},null]);
  assert.equal(all.count,5);
  assert.equal(all.badReviewed,2);
  assert.equal(all.badCount,1);
  assert.equal(all.badMoveRate,0.5);
  assert.equal(all.index,Math.round((fresh.index*2+65*3)/5));
  assert.equal(all.agreementRate,(fresh.agreements+2)/5);
  const legacyOnly=combineAggregates([legacy]);
  assert.equal(legacyOnly.badMoveRate,null);
  assert.equal(legacyOnly.badReviewed,0);
  assert.equal(combineAggregates([]).badMoveRate,null);
});

test('5% low-recommendation tests are distinct from the old relative-gap rule',()=>{
  const vals=Array(46).fill(null);vals[0]=0;vals[1]=-0.4;vals[2]=-1.5;
  const result=analyzeAction({best:0,qLegal:vals},1);
  assert(result.relativeGap<0.30);
  assert(result.recommendation<0.05);
  assert(result.badMove);
});
