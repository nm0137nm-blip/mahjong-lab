import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {deriveGenbutsuContrast,verifyGenbutsuContrast,scanGenbutsuContrastExamples} from '../../src/coach/v14-seat-genbutsu-proof-v2.mjs';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const clone=x=>structuredClone(x);
const es=process.env.V14_STAGE1?JSON.parse(fs.readFileSync(process.env.V14_STAGE1,'utf8')):[];
test('all 30 public cases: scan seat-specific non-probabilistic genbutsu contrasts and independently reverify all discovered proofs',()=>{
 if(!es.length)return;
 assert.equal(es.length,30);
 let seatCases=0,pairs=0,certificates=0;
 const affected=new Set();
 for(const e of es){
  const examples=scanGenbutsuContrastExamples(e);
  for(const x of examples){
   const m=verifyGenbutsuContrast(e,x.example);
   assert.equal(m.meaningfulDistinctCertainty,true);
   assert.equal(m.dealInRate,'unknown');
   assert.equal(m.overallOptimality,'not_certified');
   assert.equal(x.example.relation,'action_proven_genbutsu_other_not_proven');
   assert(x.certifiableContrastPairs>=1);
   seatCases++;
   pairs+=x.certifiableContrastPairs;
   certificates++;
   affected.add(x.caseId);
  }
 }
 assert.equal(seatCases,59);
 assert.equal(pairs,1254);
 assert.equal(affected.size,22);
 assert.equal(certificates,59);
});
test('real seat-sensitive contrast rejects coherent action reversal and re-labelled seat with unchanged numerical certainty',()=>{
 if(!es.length)return;
 const e=es.find(x=>x.request.input.id==='pilot-01');
 const r=deriveGenbutsuContrast(e,'a4-0','a3-0',0);
 assert.equal(r.actionGenbutsu,true);assert.equal(r.againstGenbutsu,false);
 const badSeat=clone(r);badSeat.seat=2;
 assert.throws(()=>verifyGenbutsuContrast(e,badSeat),/false genbutsu statement/);
 const swap=clone(r);swap.action=r.against;swap.against=r.action;
 assert.throws(()=>verifyGenbutsuContrast(e,swap),/false genbutsu statement/);
 const fake=clone(r);fake.relation='action_stronger_EV';
 assert.throws(()=>verifyGenbutsuContrast(e,fake),/false genbutsu statement/);
 const fakeProbability=clone(r);fakeProbability.dealInProbability=.05;
 assert.throws(()=>verifyGenbutsuContrast(e,fakeProbability),/unknown certificate field/);
 const good=deriveGenbutsuContrast(e,'a3-0','a4-0',0);
 assert.equal(good.relation,'against_proven_genbutsu_action_not_proven');
 assert.equal(verifyGenbutsuContrast(e,good).opponentTacticalInfluence,'not_certified');
});
test('public reference is hash bound; future/private injection or illegal action cannot be masked by plausible prose',()=>{
 if(!es.length)return;
 const e=es.find(x=>x.request.input.id==='pilot-01');
 const certificate=deriveGenbutsuContrast(e,'a4-0','a3-0',0);
 const bad=clone(e);bad.request.input.evidence.push({id:'future',value:{winningTile:'s1'}});
 assert.throws(()=>verifyGenbutsuContrast(bad,certificate),/tampered frozen input/);
 assert.throws(()=>deriveGenbutsuContrast(e,'a4-0','a4-0',0),/illegal or same candidates/);
 assert.throws(()=>deriveGenbutsuContrast(e,'a4-0','a99-0',0),/illegal or same candidates/);
 assert.throws(()=>deriveGenbutsuContrast(e,'a4-0','a3-0',1),/own seat is not a defender/);
});
test('perfectly generic description with valid seat-certificate remains uncertified explanation',()=>{
 if(!es.length)return;
 const e=es[0],g=scanGenbutsuContrastExamples(e)[0].example;
 const p=verifyGenbutsuContrast(e,g);
 assert.equal(p.verified,'public_discard_to_seat_match_only');
 assert.equal(p.opponentTacticalInfluence,'not_certified');
 assert.equal(p.overallOptimality,'not_certified');
});
