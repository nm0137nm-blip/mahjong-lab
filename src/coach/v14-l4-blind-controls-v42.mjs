// Genuine model response-independent L4 adversarial weak controls.
// Created & hashed BEFORE any v4 real independent ChatGPT answers.
// L4 reviewer must NOT see which is real and which is a control.
import {createHash} from 'node:crypto';
import {createV42CompactDevelopmentPacket} from './v14-compact-model-contract-v42.mjs';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export const L42_CONTROL_VERSION='p2a-v42-fixed-public-weak-control-1';
const kinds=['generic_public_template','wrong_opponent_attribution',
 'fabricated_unmeasured_probability','reversed_known_rank_condition'];
const t=n=>Number(n).toLocaleString('ja-JP');
export function createV42BlindWeakControl(envelope,ordinal){
 if(!Number.isInteger(ordinal)||ordinal<0||ordinal>=8)throw Error('v4-l4: ordinal');
 const p=createV42CompactDevelopmentPacket(envelope),b=p.request.publicBrief;
 const own=b.board.ownSeat,seats=b.opponents.map(x=>x.seat);
 if(seats.length!==3||new Set(seats).size!==3)throw Error('v4-l4: invalid opponents');
 const actions=b.allLegalActions;
 if(actions.length<2)throw Error('v4-l4: not enough choices');
 const chosen=actions[0],alt=actions.find(x=>x.key!==chosen.key);
 const first=b.opponents[0],second=b.opponents[1],third=b.opponents[2];
 const kind=kinds[ordinal%4];
 const point=s=>'席'+s.seat+'は'+t(s.publicValues.points)+'点、公開副露'+s.publicValues.meldCount+'組';
 const snippets=b.opponents.map(s=>({seat:s.seat,
  analysis:point(s)+'。全員に注意する。危険なら降り、そうでなければ進める。',
  tradeoff:'和了することも守ることも大切であり、ここでは未計算の相手脅威を断定しない。',
  changeCondition:'相手が早そうなら守備へ変え、遅そうなら攻撃する。'}));
 let conclusion='公開事実を考慮し、形がよさそうな'+chosen.key+'を推奨し、'+alt.key+'を次善とする。';
 if(kind==='wrong_opponent_attribution'){
  snippets[0].analysis='席'+first.seat+'は'+t(second.publicValues.points)+
   '点で公開副露'+second.publicValues.meldCount+
   '組。別の席の数字をこの席に転記して、危険度を評価する。';
 }
 if(kind==='fabricated_unmeasured_probability'){
  snippets[1].analysis=point(second)+'。この相手の聴牌確率は公開入力上95%と確定している。';
 }
 if(kind==='reversed_known_rank_condition'){
  const input=envelope.request.input,board=input.evidence.find(x=>x.id==='board').value;
  const tiers=input.evidence.find(x=>x.id==='rank-scenarios').value;
  const baseRank=tiers.currentRanks[own];
  const same=tiers.ron.find(x=>x.lossRanks[own]===baseRank);
  const row=same||tiers.ron.find(x=>x.lossRanks[own]!==baseRank);
  if(!row)throw Error('v4-l4: rank sensitivity evidence absent');
  conclusion+=' 仮に席'+row.other+'へ'+t(row.lossBase)+'点放銃した場合、'+
   (row.lossRanks[own]===baseRank?'必ず自分の順位が落ちる。':'自分の順位は絶対に変わらない。');
 }
 const visible={
  version:L42_CONTROL_VERSION,caseId:b.caseId,publicBriefRequestHash:p.requestHash,
  recommendation:{key:chosen.key,afterCallDiscard:null},
  alternative:{key:alt.key,afterCallDiscard:null},
  comparison:'手の形、打点、危険度をいずれも慎重に見るという一般論で比較する。',
  opponents:snippets,bottomLine:conclusion,
  reversal:'状況次第で選択は変わるため、現時点で具体的な反転境界は示せない。',
  lesson:'公開情報と未知情報を混同してはいけないという共通知識を繰り返す。'
 };
 if(kind==='generic_public_template'&&
    visible.opponents.some(x=>x.analysis.length===0))
  throw Error('v4-l4: weak template failed');
 return {
  controlVersion:L42_CONTROL_VERSION,caseId:b.caseId,kind,
  maskedPresentation:visible,lockedBytesHash:hash(visible),
  generationOrigin:'fixed_rule_without_model_answer_Mortal_labels_or_private_hands',
  role:'DECOY_NOT_ALLOWED_AS_REAL_CHATGPT_BENCHMARK_RESULT',
  semanticValidity:'deliberately_weak_or_false_do_not_grade_as_model_output'
 };
}
export function createV42BlindControlBatch(envelopes,orderedIds){
 if(!Array.isArray(envelopes)||!Array.isArray(orderedIds)||orderedIds.length!==8||
   new Set(orderedIds).size!==8)throw Error('v4-l4: fixed eight-case selection required');
 const rows=orderedIds.map((id,i)=>{
  const x=envelopes.find(x=>x.request.input.id===id);
  if(!x)throw Error('v4-l4: missing case '+id);
  return createV42BlindWeakControl(x,i);
 });
 return {version:L42_CONTROL_VERSION,
  status:'LOCKED_WEAK_CONTROLS_PRE_MODEL_ONLY_NOT_RESULTS',
  originalCaseOrder:orderedIds,
  controls:rows,
  experimentGoal:'blind scorer must reject empty public template, seat-swap, invented probability and rank reversal',
  note:'Exactly one negative control per case; do not choose a control after seeing a real answer'};
}
