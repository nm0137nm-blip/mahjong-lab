// Prospective research only. No calls to a model, no production promotion.
import {createHash} from 'node:crypto';
import {createV4PublicBrief} from './v14-public-brief-v4.mjs';
import {buildV4CandidateSettlementCatalog} from './v14-candidate-settlement-v4.mjs';
import {formatV4Settlement} from './v14-settlement-events-v4.mjs';
const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const fail=s=>{throw Error('v47: '+s)};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,ks)=>obj(x)&&Object.keys(x).sort().join('|')===ks.slice().sort().join('|');
const ev=(i,id)=>i.evidence.find(e=>e.id===id)?.value;
const seats=o=>[0,1,2,3].filter(s=>s!==o);
const text=x=>typeof x==='string'&&x.trim().length>0&&x.length<=6000;
const refRE=/\[\[([A-Za-z0-9_.:-]+)\]\]/g;
export const VERSION='p2a-v47-minimal-diagnostic-1';
export const RESPONSE_FIELDS=['recommendation','alternative','keyOpponent','explanation','opponents','flips'];
// Narrow quantity guard. Tile labels (5筒, 五萬, m5), seat IDs and round/turn
// labels are not scalar quantities. Ambiguous prose remains a semantic issue.
export function explicitQuantity(s){
 const t=s.normalize('NFKC');
 const n='(?:[+−-]?(?:\\d[\\d,]*(?:\\.\\d+)?(?:万|億)?(?:\\d[\\d,]*)?|[〇零一二三四五六七八九十百千万億壱弐参拾佰仟萬]+))';
 const units='(?:点(?![灯])|翻|飜|符|枚|%|パーセント|向聴|シャンテン|本場|供託)';
 return new RegExp(n+'\\s*'+units,'u').test(t);
}
export function buildV47Packet(envelope){
 const {brief}=createV4PublicBrief(envelope),i=envelope.request.input,b=ev(i,'board');
 const facts=Object.create(null),scope=Object.create(null),actions=Object.create(null),choiceMap=Object.create(null);
 const add=(id,value,seat=null)=>{
  if(!/^[A-Za-z0-9_.:-]+$/.test(id)||Object.hasOwn(facts,id))fail('duplicate/bad public ID '+id);
  if(value===undefined)return;
  facts[id]=structuredClone(value);scope[id]=seat;
 };
 add('b:round',b.round);add('b:remaining',b.remaining);add('b:honba',b.honba);add('b:kyotaku',b.kyotaku);
 add('b:ownSeat',b.ownSeat);add('b:ownPoints',b.scores.find(s=>s.seat===b.ownSeat).points);
 add('b:initialOrder',b.initialOrder);add('b:dealer',brief.dealerProvenance.dealerSeat);
 const own=brief.own;for(const k of ['hand','drawn','melds','doraIndicators','reaction'])add('self:'+k,own[k]);
 const ownRiver=ev(i,'seat-'+b.ownSeat);if(ownRiver)add('self:discards',ownRiver.discards);
 for(const s of seats(b.ownSeat)){
  const p=ev(i,'seat-'+s),v=ev(i,'public-value-'+s);
  if(!p||!v)fail('missing opponent');
  for(const k of ['points','pointGapFromOwn','meldCount','exposedYakuhaiHan','exposedDoraHan','discardCount','recentHandDiscards'])add('s'+s+':'+k,v[k],s);
  for(const k of ['riichi','melds','discards'])add('s'+s+':'+k,p[k],s);
 }
 // Each concrete call/discard gets a distinct key. A source key is not a
 // ranking. Short action IDs never derive from Mortal, outcomes or responses.
 const top=new Set(brief.detailedCandidates.map(a=>a.key));
 for(const a of i.actions){
  const c=ev(i,'calc-'+a.key);if(!c)fail('missing calculation');
  const call=a.group>=38&&a.group<=41;
  const variants=call?c.afterCallDiscards?.map((v,index)=>({key:a.key+'.c'+index,discard:v.discard,v})):
   [{key:a.key,discard:null,v:c}];
  if(!variants?.length)fail('call without concrete legal variants');
  for(const x of variants){
   if(Object.hasOwn(actions,x.key)||!/^[A-Za-z0-9_.:-]+$/.test(x.key))fail('action collision');
   const choice={key:a.key,afterCallDiscard:x.discard};
   // Existing deterministic catalog independently checks the concrete choice.
   const catalog=buildV4CandidateSettlementCatalog(envelope,choice);
   actions[x.key]=x.discard===null?[a.group,a.detail]:[a.group,a.detail,x.discard];
   choiceMap[x.key]=choice;
   const v=x.v,k=x.key+':';
   for(const f of ['shanten','ukeireUpperBound','retainedDoraHan','ownRiverFuriten'])if(v[f]!==null)add(k+f,v[f]);
   if(Number.isInteger(v.forms?.standard))add(k+'standardShanten',v.forms.standard);
   if(top.has(a.key)&&Array.isArray(v.improving)&&v.improving.length)add(k+'improving',v.improving.map(y=>[y.tile,y.remainingUpperBound]));
   for(const s of v.safety||[])if(seats(b.ownSeat).includes(s.seat)&&typeof s.ownRiverGenbutsu==='boolean')add(k+'safe'+s.seat,s.ownRiverGenbutsu,s.seat);
   // A score here is conditional; no assertion of legal ron or probabilities.
   const mode=a.group===37?'hypotheticalRiichiRon':'ron';
   for(const w of v.conditionalNormalWins||[]){
    const p=w[mode];if(!p)continue;
    if(!Number.isSafeInteger(p.basePoints)||p.basePoints<=0||!Array.isArray(p.yaku))fail('invalid conditional score');
    add(k+'ron:'+w.tile,[p.basePoints,p.yaku]);
   }
   // Detailed hypothetical settlements for publicly selected top groups only.
   // Keep one source-bound fact per tile / payer; not actual expected value.
   if(top.has(a.key))for(const w of catalog.scoredOwnRon){
    const s=w.hypotheticalSettlement.opponentSeat;
    // Settlement renderer carries full actual assumptions; own score vs each payer.
    // Seat scope is bound by original event ID even if event uses a different field.
    const m=w.factId.match(/:opp([0-3]):/);
    if(!m)fail('missing settlement payer');
    add(k+'settle:'+w.sourceTile+':s'+m[1],formatV4Settlement(w.hypotheticalSettlement),Number(m[1]));
   }
  }
 }
 const instruction=[
  '麻雀LAB v4.7開発診断。赤あり四人麻雀、25000点持ち素点勝負、親トップ止め・トビ終了。順位期待値は素点とは区別。公開情報と自手だけで判断し、Mortalや実際の結果を推測で作らない。',
  'actionsのキーから異なる推薦・対案を選ぶ。副露の行は[行動group,鳴き面子,鳴き後打牌]、それ以外は[group,行動詳細]。打牌群0〜36、立直37、副露38〜41、槓42、和了43、途中流局44、見送り45。',
  'factsは唯一の確定データ辞書。数値（点、枚、翻、符、割合、向聴など）は[[実在するfact ID]]で引用し、本文に値を書き写さない。牌名、巡目、席名は自然な記述可。actionsのキーも[[キー:move]]で引用可能。ukeireUpperBoundは公開情報上の残り枚数上限、safeNは席Nの河の現物であって絶対安全ではない。ronは指定条件での基本支払点と役、settleは条件付き点移動。フリテン、役の有無、実際の和了可能性を区別する。',
  '推薦と対案について何を得て何を失うか、局面固有の決め手を自然な日本語で説明する。席ごとに公開根拠を引用し、影響が小さい相手は短く理由を述べる。席別の文にはその席専用の事実だけ引用可（自手や共通の事実は可）。最重要席が一意に選べないならnull。',
  'flipsには現状の推薦から別の合法手へ変える具体的な仮定と理由を自由記述し、thenに行動キーを指定する。seatは対象相手または全体ならnull。最重要席がある場合はその席に関わる反転条件を含める。同じ条件で全体と最重要席を兼ねてよい。隠し牌・未来・未校正確率を断定しない。現状の事実と仮定を区別する。',
  '回答はresponseShapeの6項目のみのUTF-8 JSONファイル。バージョンやハッシュの転記不要。チャットにはファイルリンクのみ。定型文や数値の羅列でなく、実戦で使える学びを説明する。'
 ].join('\n');
 const request={version:VERSION,caseId:i.id,instruction,actions,facts,
  responseShape:{recommendation:'<action key>',alternative:'<different action key>',keyOpponent:null,explanation:'<自然な比較と学び>',opponents:Object.fromEntries(seats(b.ownSeat).map(s=>[s,'<当該席の根拠付き説明>'])),flips:[{if:'<具体的な仮定と理由>',then:'<different legal action key>',seat:null}]},
  delivery:{filename:'mahjong_P2a_v47_diagnostic_'+i.id+'_response.json',format:'UTF-8 JSON file only'}};
 return {request,requestHash:hash(request),sourceHash:envelope.request.sourcePublicInputHash,scope,choiceMap};
}
export function verifyV47(envelope,packet,answer){
 const fresh=buildV47Packet(envelope);
 if(!packet||packet.requestHash!==fresh.requestHash||hash(packet.request)!==fresh.requestHash||packet.sourceHash!==fresh.sourceHash)fail('request binding mismatch');
 const {actions,facts}=fresh.request,own=facts['b:ownSeat'],other=seats(own);
 const legal=k=>typeof k==='string'&&Object.hasOwn(actions,k);
 if(!exact(answer,RESPONSE_FIELDS)||!legal(answer.recommendation)||!legal(answer.alternative)||answer.recommendation===answer.alternative)fail('invalid response or legal choice');
 if(answer.keyOpponent!==null&&!other.includes(answer.keyOpponent))fail('invalid keyOpponent');
 if(!exact(answer.opponents,other.map(String)))fail('missing/extra opponent');
 const registry={...facts,...Object.fromEntries(Object.entries(actions).map(([k,v])=>[k+':move',v]))};
 const warnings=[];
 function check(s,seat=null,requireSeat=false){
  if(!text(s))fail('missing or oversized prose');
  const refs=[];
  const raw=s.replace(refRE,(_,id)=>{
   if(!Object.hasOwn(registry,id))fail('unknown fact '+id);
   if(seat!==null&&fresh.scope[id]!=null&&fresh.scope[id]!==seat)fail('cross-seat fact '+id);
   refs.push(id);return '';
  });
  if(raw.includes('[[')||raw.includes(']]'))fail('malformed reference');
  if(explicitQuantity(raw))fail('unanchored explicit quantity');
  if(requireSeat&&!refs.some(id=>fresh.scope[id]===seat))fail('missing same-seat fact');
  // Uncertain semantic assertions are flagged, never judged solely on keywords.
  if(/(?:確実|絶対|必ず|確定|100パーセント|聴牌率|放銃率|和了率)/u.test(raw))warnings.push('semantic assertion requires review');
  return {text:s.replace(refRE,(_,id)=>typeof registry[id]==='string'?registry[id]:JSON.stringify(registry[id])),refs};
 }
 const explanation=check(answer.explanation);
 if(!explanation.refs.length)warnings.push('comparison lacks direct citation');
 const opponents=Object.fromEntries(other.map(s=>[s,check(answer.opponents[s],s,true)]));
 if(!Array.isArray(answer.flips)||!answer.flips.length||answer.flips.length>8)fail('missing/bad flips');
 const flips=answer.flips.map(f=>{
  if(!exact(f,['if','then','seat'])||!legal(f.then)||f.then===answer.recommendation||(f.seat!==null&&!other.includes(f.seat)))fail('invalid reversal choice/seat');
  return {...check(f.if,f.seat),then:f.then,seat:f.seat};
 });
 if(answer.keyOpponent!==null&&!flips.some(f=>f.seat===answer.keyOpponent))fail('missing key-opponent reversal');
 return {verdict:'CONTRACT_PASS_SEMANTICS_UNASSESSED',packetHash:fresh.requestHash,sourceHash:fresh.sourceHash,
  recommendation:fresh.choiceMap[answer.recommendation],alternative:fresh.choiceMap[answer.alternative],keyOpponent:answer.keyOpponent,
  explanation,opponents,flips,warnings,semanticCertified:false};
}
export function receiveV47(envelope,packet,raw,transport){
 // Manual provenance is user-reported, not API-authenticated. Bind to the
 // dispatch record out of band; never ask the model to transcribe hashes.
 if(!transport||transport.packetHash!==packet.requestHash||typeof transport.status!=='string')fail('unbound transport receipt');
 if(transport.status!=='completed')return {verdict:'OPERATIONAL_INCOMPLETE',packetHash:packet.requestHash,rawSha256:typeof raw==='string'?hash(raw):null,semanticCertified:false};
 if(typeof raw!=='string')fail('missing completed raw');
 let a;try{a=JSON.parse(raw)}catch{return {verdict:'FATAL_INVALID_JSON',rawSha256:hash(raw),semanticCertified:false}}
 try{return {...verifyV47(envelope,packet,a),rawSha256:hash(raw)}}catch(e){return {verdict:'FATAL_CONTRACT',failure:String(e),rawSha256:hash(raw),semanticCertified:false}}
}
