// P2a-v3 development Stage2: uniform answer contract for genuine reference
// and tests-only counterfeit references. Product MUST use separately validated
// pinned reference. No hidden hand, S42 Q magnitudes or model internals sent.
import {createHash} from 'node:crypto';
import {verifySingleInference} from './v14-inference-record-v3.mjs';
import {verifyV3IndependentDevelopmentAnswer} from './v14-independent-request-v3.mjs';
import {PROOF_VERSION_V3,verifyV3PublicContrast} from './v14-evidence-proof-v3.mjs';
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const fail=s=>{throw Error('stage2-v3: '+s);};
const exact=(x,k)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join('|')===k.slice().sort().join('|');
const pinnedModel='30381bf21389e2d25d3edf48fed11bf772336ef3daeee67d1bdae7fb9dd30cb4';
const statement=s=>typeof s==='string'&&s.trim().length>=12&&s.length<=4000;
export const STAGE2_REQUEST_VERSION_V3='p2a-v3-unified-explanation-request-1';
export const STAGE2_ANSWER_VERSION_V3='p2a-v3-unified-explanation-answer-1';
export const STAGE2_RESPONSE_SHAPE_V3={
 version:STAGE2_ANSWER_VERSION_V3,requestHash:'<Stage2 requestHash>',stage1AnswerHash:'<immutable Stage1 answerHash>',
 referenceTopAcknowledged:'<integer legal group>',endorsedGroup:'<integer legal group>',
 stance:'accept_reference|question_reference|uncertain',
 contrastProof:{version:PROOF_VERSION_V3,requestHash:'<immutable Stage1 requestHash>',
  recommendation:{key:'legal concrete option',afterCallDiscard:null},
  alternative:{key:'different legal concrete option',afterCallDiscard:null},
  comparisons:[{type:'actionKind',recommended:'riichi',alternative:'discard',relation:'different'}],
  opponentObservations:[{seat:0,field:'riichi',value:false,assessment:'not_established'}],
  reversal:{unknownFactors:['pWin'],ifThen:'未知条件によって見解が変わる理由'},
  explanation:'見せられた公開事実だけで検証できる候補間の差'},
 explanation:'Stage1の回答に照らしたMortal順位との比較、確定情報と仮説の区別',
 whatWouldChangeAssessment:'公開情報や条件が変わったときに再評価すべき点',
 relativeQMagnitude:'not_provided'
};
function groupRef(stage1,reference){
 const i=stage1.request.input,ids=[...new Set(i.actions.map(x=>x.group))].sort((a,b)=>a-b);
 if(!exact(reference,['caseId','requestHash','modelSHA256','q','best','origin'])||
    reference.caseId!==i.id||reference.requestHash!==stage1.requestHash||
    reference.modelSHA256!==pinnedModel||reference.origin!=='verifier_only_pinned_model'||
    !Array.isArray(reference.q)||reference.q.length!==46||!Number.isInteger(reference.best))
   fail('untrusted pinned model reference');
 const present=reference.q.flatMap((q,k)=>q===null?[]:[k]);
 if(sha(ids)!==sha(present)||!present.every(g=>Number.isFinite(reference.q[g])))
   fail('incompatible legal-group action mask');
 const max=Math.max(...present.map(g=>reference.q[g]));
 if(reference.q[reference.best]!==max)fail('best group disagrees with sealed q');
 const order=ids.slice().sort((a,b)=>reference.q[b]-reference.q[a]||a-b);
 return {bestGroups:order.filter(g=>reference.q[g]===max),rankedGroups:order,
  modelSHA256:pinnedModel,relativeQMagnitude:'not_provided',
  scope:'S42 ordinal legal-action-group ranking only; not EV, specific discard, strategic reason or confidence margin'};
}
function validateChoice(input,x){
 if(x===null)return null;
 if(!exact(x,['key','afterCallDiscard'])||typeof x.key!=='string')fail('invalid concrete user action');
 const a=input.actions.find(q=>q.key===x.key),c=input.evidence.find(e=>e.id==='calc-'+x.key)?.value;
 if(!a||!c)fail('user action not legal in public input');
 if(Array.isArray(c.afterCallDiscards)){
  if(typeof x.afterCallDiscard!=='string'||
     c.afterCallDiscards.filter(y=>y.discard===x.afterCallDiscard).length!==1)
    fail('invalid concrete call subsequent discard');
 }else if(x.afterCallDiscard!==null)fail('unexpected user after-call discard');
 return {key:x.key,afterCallDiscard:x.afterCallDiscard,group:a.group};
}
export function createV3Stage2GenuineRequest(stage1,locked,reference,userAction=null){
 if(stage1?.request?.stage!=='independent-v3-dev'||sha(stage1.request)!==stage1.requestHash)
  fail('untrusted Stage1');
 const proof=verifySingleInference(stage1,locked),answer=locked.packet.answerEnvelope.answer;
 verifyV3IndependentDevelopmentAnswer(stage1,answer);
 const publicRef=groupRef(stage1,reference),user=validateChoice(stage1.request.input,userAction);
 const request={stage:'comparison-v3-dev',version:STAGE2_REQUEST_VERSION_V3,
  caseId:stage1.request.input.id,stage1RequestHash:stage1.requestHash,stage1AnswerHash:proof.answerHash,
  lockedStage1RecordHash:proof.recordHash,
  independentStage1Answer:structuredClone(answer),
  input:structuredClone(stage1.request.input),
  reference:publicRef,userAction:user,
  responseShape:structuredClone(STAGE2_RESPONSE_SHAPE_V3),
  instructions:[
   'あなたの独立Stage1回答は書換えない。示されたS42推奨グループ順位に盲目的に迎合せず、公開計算と矛盾しないか確認する。',
   'S42参照のQ値・差の大小・局収支期待値・内部思考は一切不明。順位が違うことを重大な差と断定しない。',
   '偽りの参照が示される可能性も考え、確かな手牌効率・相手席への現物・点棒移動と矛盾する場合は矛盾を示す。',
   '具体牌の選択は別の合法候補として、公開情報のどの候補を推薦/対案とするか明示する。参考はあくまでグループ。',
   '回答の型と相手席・候補の比較はStage1と同一の検証可能な情報に基づく。条件付き点数を確率や勝率と呼ばない。',
   'この入力に推薦の真偽を表す実験ラベルはない。Stage2の出力形式は真正・隔離偽参照試験で同じ。'
  ].join('\n')};
 return {request,requestHash:sha(request)};
}
export function verifyV3Stage2GenuineRequest(stage1,locked,reference,packet,userAction=null){
 if(!exact(packet,['request','requestHash'])||sha(packet.request)!==packet.requestHash)
  fail('modified Stage2 prompt');
 const expected=createV3Stage2GenuineRequest(stage1,locked,reference,userAction);
 if(sha(packet)!==sha(expected))fail('counterfeit, mismatched original reference or changed Stage1');
 return {genuineInputIntegrity:'pass',pinnedReferenceGroupOnly:true,
  userConcreteAction:packet.request.userAction,sourceModelInternals:'unknown',
  strategy:'not_certified'};
}
// This output-shape verifier NEVER authenticates the reference. Only
// verifyV3Stage2GenuineRequest can authenticate a real comparison prompt.
// The tests-only counterfeit challenge uses the SAME answer verifier.
export function verifyV3Stage2AnswerShape(stage1,locked,packet,answer){
 if(!exact(packet,['request','requestHash'])||sha(packet.request)!==packet.requestHash||
    packet.request.stage!=='comparison-v3-dev'||packet.request.version!==STAGE2_REQUEST_VERSION_V3||
    packet.request.stage1RequestHash!==stage1.requestHash)
   fail('unbound Stage2 packet');
 const receipt=verifySingleInference(stage1,locked);
 if(packet.request.stage1AnswerHash!==receipt.answerHash||
    packet.request.lockedStage1RecordHash!==receipt.recordHash||
    sha(packet.request.independentStage1Answer)!==sha(locked.packet.answerEnvelope.answer)||
    sha(packet.request.input)!==sha(stage1.request.input)||
    sha(packet.request.responseShape)!==sha(STAGE2_RESPONSE_SHAPE_V3))
   fail('Stage1 locked answer or source facts replaced');
 if(!exact(answer,['version','requestHash','stage1AnswerHash','referenceTopAcknowledged','endorsedGroup','stance','contrastProof','explanation','whatWouldChangeAssessment','relativeQMagnitude'])||
    answer.version!==STAGE2_ANSWER_VERSION_V3||answer.requestHash!==packet.requestHash||
    answer.stage1AnswerHash!==receipt.answerHash||
    answer.relativeQMagnitude!=='not_provided'||!statement(answer.explanation)||
    !statement(answer.whatWouldChangeAssessment))
   fail('invalid unified Stage2 answer');
 const ref=packet.request.reference,groups=[...new Set(stage1.request.input.actions.map(x=>x.group))];
 if(!ref||ref.relativeQMagnitude!=='not_provided'||!Array.isArray(ref.rankedGroups)||
    !Array.isArray(ref.bestGroups)||!groups.includes(answer.endorsedGroup)||
    !ref.bestGroups.includes(answer.referenceTopAcknowledged)||
    sha(ref.rankedGroups.slice().sort((a,b)=>a-b))!==sha(groups.sort((a,b)=>a-b)))
   fail('unbound or illegal group / missing reference comparison');
 if(!['accept_reference','question_reference','uncertain'].includes(answer.stance)||
   answer.stance==='accept_reference'&&!ref.bestGroups.includes(answer.endorsedGroup)||
   answer.stance==='question_reference'&&ref.bestGroups.includes(answer.endorsedGroup))
  fail('stance contradicts concrete endorsed and referenced groups');
 const proof=verifyV3PublicContrast(stage1,answer.contrastProof);
 const concrete=stage1.request.input.actions.find(x=>x.key===answer.contrastProof.recommendation.key);
 if(!concrete||concrete.group!==answer.endorsedGroup)fail('typed recommendation not part of endorsed legal group');
 return {stage2Schema:'unified_v3_verified',publicContrastFacts:proof.candidateFactsVerified,
  concreteEndorsedLegalAction:answer.contrastProof.recommendation,
  semanticCoherence:'not_certified',fakeRecommendationResistance:'not_measured',
  authenticity:'not_established_by_shape_check',tacticalExpertise:'not_certified'};
}
export function storeV3GenuineStage2Answer(stage1,locked,reference,packet,answer,userAction=null){
 verifyV3Stage2GenuineRequest(stage1,locked,reference,packet,userAction);
 const shape=verifyV3Stage2AnswerShape(stage1,locked,packet,answer);
 const record={stage2RequestHash:packet.requestHash,answerHash:sha(answer),
  stage1ImmutableAnswerHash:packet.request.stage1AnswerHash,
  answer:structuredClone(answer),
  publicVerification:'pass',sourceAuthenticity:'pinned_only_in_this_store_method',
  certification:'not_certified_without_real_model_and_independent_semantic_exam'};
 return {record,recordHash:sha(record),shape};
}
