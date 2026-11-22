// P2a-v2 isolated development-only prompt/answer contract.
// Carries the audited public input unchanged. No Mortal Q, hidden hand, future,
// user choice or unvalidated opponent probabilities enter Stage1.
import {createHash} from 'node:crypto';
import {verifyConditionalProof,PROOF_VERSION} from './v14-evidence-proof-v2.mjs';
export const ANSWER_VERSION='p2a-v2-independent-answer-1';
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const fail=s=>{throw Error('independent-v2: '+s);};
const exact=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===k.slice().sort().join('|');
const narrative=x=>typeof x==='string'&&x.trim().length>=8&&x.length<=3000;
const instruction=[
 '麻雀LABの開発用独立判断。入力は公開事実のみでMortal・隠し手・未来・実際のユーザー選択は存在しない。Mortalの推奨やQ値を推測して生成しない。',
 '全合法候補を検討し、推薦候補と有力対案を具体的に比較する。自手の向聴数・受け入れ上限などはcalc根拠から正確に引用し、受け入れ上限を実際のツモ確率と呼ばない。',
 '他家は実際に影響があると考える相手だけを重要と説明する。判断に影響することが証明できない相手は未確定に分類し、三人全員の強い影響を無理に書かない。公開観測と仮説を区別する。',
 '条件付き点数・順位シナリオと未知の和了率・放銃率を分離する。長期期待値・相手聴牌確率・安全度を捏造しない。判断が逆転する条件・未知量を明記する。',
 '証明欄はrequestHash・具体候補key・算術値と比較方向・相手seatの公開観測に完全一致させる。一般論の言い換えや根拠IDの水増しは比較の証明にならない。',
 '出力JSONのみ。戦術説明の品質認定は別の評価器で行う。'
].join('\n');
const responseShape={
 version:ANSWER_VERSION,requestHash:'<this requestHash>',
 evidenceProof:{
  version:PROOF_VERSION,requestHash:'<this requestHash>',
  recommendation:'legal action key',alternative:'different legal action key',
  comparisons:[{metric:'shanten|ukeireUpperBound|retainedDoraHan',
   recommended:0,alternative:1,relation:'lower|higher|same',
   recommendedAfterCallDiscard:null,alternativeAfterCallDiscard:null}],
  opponentObservations:[{seat:1,
   field:'riichi|meldCount|exposedDoraHan|exposedYakuhaiHan|discardCount|points|pointGapFromOwn',
   value:false,assessment:'potentially_relevant|not_established'}],
  reversal:{unknownFactors:['pWin','pDealIn'],ifThen:'条件がどう変われば推奨も変わるか'},
  explanation:'候補間の具体的な計算根拠と、未実証の戦術要因'
 },
 importantSeats:[{seat:1,whyMatters:'公開観測から影響すると仮定する根拠',changeCondition:'判断が逆転する条件'}],
 uncertainSeats:[{seat:2,reason:'重要性が判定できない理由'}],
 educational:{reason:'推奨の主理由',opponentTradeoff:'他家との相対価値',boundary:'反転条件と未知の量',lesson:'次に使える教訓'}
};
export function createV2IndependentDevelopmentRequest(frozenV1){
 if(!exact(frozenV1,['request','requestHash'])||frozenV1.request?.stage!=='independent'||
    sha(frozenV1.request)!==frozenV1.requestHash)fail('untrusted frozen public source');
 const input=structuredClone(frozenV1.request.input);
 if(input?.version!=='v14-pilot-calculated-1')fail('unvalidated public input');
 const request={stage:'independent-v2-dev',version:ANSWER_VERSION,system:instruction,
  responseShape,sourcePublicInputHash:sha(input),input};
 const packet={request,requestHash:sha(request)};
 if(sha(packet.request.input)!==sha(frozenV1.request.input))fail('modified public input');
 return packet;
}
export function verifyV2IndependentDevelopmentAnswer(envelope,answer){
 if(!exact(envelope,['request','requestHash'])||envelope.request?.stage!=='independent-v2-dev'||
    sha(envelope.request)!==envelope.requestHash||sha(envelope.request.input)!==envelope.request.sourcePublicInputHash)fail('tampered request');
 if(!exact(answer,['version','requestHash','evidenceProof','importantSeats','uncertainSeats','educational'])||
    answer.version!==ANSWER_VERSION||answer.requestHash!==envelope.requestHash)fail('response integrity');
 if(!answer.evidenceProof||answer.evidenceProof.requestHash!==envelope.requestHash)fail('separate proof binding');
 const verified=verifyConditionalProof(envelope,answer.evidenceProof);
 const own=envelope.request.input.evidence.find(x=>x.id==='board').value.ownSeat;
 if(!Array.isArray(answer.importantSeats)||!Array.isArray(answer.uncertainSeats)||
    answer.importantSeats.length>3||answer.uncertainSeats.length>3)fail('invalid relevance partition');
 const labels=new Map(answer.evidenceProof.opponentObservations.map(x=>[x.seat,x.assessment])),seen=new Set();
 for(const [kind,rows] of [['important',answer.importantSeats],['uncertain',answer.uncertainSeats]]){
  for(const r of rows){
   if(!exact(r,kind==='important'?['seat','whyMatters','changeCondition']:['seat','reason'])||
      !Number.isInteger(r.seat)||r.seat<0||r.seat>3||r.seat===own||seen.has(r.seat)||!labels.has(r.seat)||
      labels.get(r.seat)!==(kind==='important'?'potentially_relevant':'not_established')||
      !(kind==='important'?narrative(r.whyMatters)&&narrative(r.changeCondition):narrative(r.reason)))fail('unproven seat assignment');
   seen.add(r.seat);
  }
 }
 if(seen.size!==labels.size)fail('unassigned opponent observation: relevance partition incomplete');
 if(!exact(answer.educational,['reason','opponentTradeoff','boundary','lesson'])||
    !Object.values(answer.educational).every(narrative))fail('invalid teaching explanation');
 return {requestHash:envelope.requestHash,calculationProof:verified,
  naturalLanguageImpact:'not_certified',opponentInfluence:'not_certified',
  explanationQuality:'not_certified',noForcedAllThreeSeats:true,
  stage:'independent-v2-dev',
  gate:'syntax_and_deterministic_evidence_only_not_expert_quality'};
}
