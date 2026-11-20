// P2a preparatory, facts-only boundary. Not a P1 certification or integration.
// Accept the existing public-case format; never copy its derived facts, hidden
// payload, arbitrary strings, predicted probabilities, Q values or prose.
export const VERSION='P2a-facts-only-v1';
const tile=p=>typeof p==='string'&&/^(?:[mps][0-9]|z[1-7])$/.test(p);
const seat=n=>Number.isInteger(n)&&n>=0&&n<4;
const int=n=>Number.isSafeInteger(n);
const norm=p=>p[0]+(p[1]==='0'?'5':p[1]);
const meld=m=>typeof m==='string'&&/^[mps][0-9]{1,4}[+=-]?[0-9]{0,3}$|^z[1-7]{1,4}[+=-]?[1-7]{0,3}$/.test(m)&&[...m.slice(1)].filter(x=>/\d/.test(x)).length>=3&&[...m.slice(1)].filter(x=>/\d/.test(x)).length<=4;
const list=(a,p)=>Array.isArray(a)&&a.every(p);
const fail=()=>{throw Error('invalid public facts')};
const labels={37:'立直',38:'チー',39:'チー',40:'チー',41:'ポン',42:'槓',43:'和了',44:'九種九牌',45:'スルー'};
const idTile=i=>i<27?'mps'[Math.floor(i/9)]+(i%9+1):i<34?'z'+(i-26):'mps'[i-34]+'0';
const bool=x=>typeof x==='boolean';
function action(a,phase){
 if(!int(a?.action)||a.action<0||a.action>45||!Array.isArray(a.details)||!a.details.length||new Set(a.details).size!==a.details.length)fail();
 const i=a.action;
 if(i<37){if(phase!=='turn'||!a.details.every(x=>typeof x==='string'&&/^(?:[mps][0-9]|z[1-7])_?$/.test(x)&&x.slice(0,2)===idTile(i)))fail();}
 else if(i===37){if(phase!=='turn'||a.details.length!==1||a.details[0]!=='立直')fail();}
 else if(i>=38&&i<=42){if((i!==42&&phase!=='reaction')||!a.details.every(meld))fail();}
 else if(i===43){if(a.details.length!==1||a.details[0]!==(phase==='turn'?'ツモ':'ロン'))fail();}
 else if(i===44){if(phase!=='turn'||a.details.length!==1||a.details[0]!=='九種九牌')fail();}
 else if(i===45){if(phase!=='reaction'||a.details.length!==1||a.details[0]!=='スルー')fail();}
 return {id:i,label:i<37?'打'+idTile(i):labels[i],details:a.details.slice()};
}
function publicEvent(e){
 if(e?.種類==='ドラ表示追加'&&tile(e.牌))return {種類:e.種類,牌:e.牌};
 if(!seat(e?.席))fail();
 if(e.種類==='自摸'||e.種類==='嶺上自摸')return {種類:e.種類,席:e.席};
 if(e.種類==='打牌'&&tile(e.牌)&&bool(e.ツモ切り)&&bool(e.立直宣言))return {種類:e.種類,席:e.席,牌:e.牌,ツモ切り:e.ツモ切り,立直宣言:e.立直宣言};
 if((e.種類==='副露'||e.種類==='槓')&&meld(e.面子))return {種類:e.種類,席:e.席,面子:e.面子};
 fail();
}
export function factsOnly(caseData){
 const s=caseData?.scene,phase=caseData?.phase;
 if(!s||s.snapshotVersion!==2||!['turn','reaction'].includes(phase)||!seat(s.ownSeat)||!seat(s.activeSeat)||typeof s.round!=='string'||!/^[東南西北][1-4]$/.test(s.round)||!list(s.hand,tile)||!list(s.selfMelds,meld)||!list(s.dora,tile)||!int(s.remaining)||s.remaining<0||s.remaining>70||!int(s.honba)||s.honba<0||!int(s.kyotaku)||s.kyotaku<0||!bool(s.pendingReach)||!list(s.initialOrder,seat)||s.initialOrder.length!==4||new Set(s.initialOrder).size!==4||!list(s.scores,x=>int(x?.points))||s.scores.length!==4||!Array.isArray(s.rivers)||s.rivers.length!==4||!Array.isArray(s.publicEvents)||!Array.isArray(caseData.actions)||!caseData.actions.length)fail();
 if(s.drawn!=null&&!tile(s.drawn))fail();
 const rivers=s.rivers.map((r,i)=>{
  if(!bool(r?.riichi)||!list(r.melds,meld)||!list(r.discards,d=>tile(d?.tile)&&bool(d.tsumogiri)&&bool(d.riichi)&&bool(d.called)))fail();
  return {seat:i,riichi:r.riichi,melds:r.melds.slice(),discards:r.discards.map(d=>({tile:d.tile,tsumogiri:d.tsumogiri,riichi:d.riichi,called:d.called}))};
 });
 if(JSON.stringify(rivers[s.ownSeat].melds)!==JSON.stringify(s.selfMelds))fail();
 const actions=caseData.actions.map(a=>action(a,phase));
 if(new Set(actions.map(a=>a.id)).size!==actions.length)fail();
 const reaction=phase==='reaction'?caseData.reaction:null;
 if(phase==='reaction'&&(!seat(reaction?.from)||reaction.from===s.ownSeat||!tile(reaction.tile)))fail();
 // Only an opponent's own river is a deterministic genbutsu source.
 const safety=actions.filter(a=>a.id<37).map(a=>({action:a.id,ownRiverSameTypeSeats:rivers.filter(r=>r.seat!==s.ownSeat&&r.discards.some(d=>norm(d.tile)===norm(idTile(a.id)))).map(r=>r.seat)}));
 const scores=s.scores.map((v,i)=>({seat:i,points:v.points}));
 const rank=s.pendingReach?null:1+scores.filter(v=>v.seat!==s.ownSeat&&(v.points>scores[s.ownSeat].points||v.points===scores[s.ownSeat].points&&s.initialOrder.indexOf(v.seat)<s.initialOrder.indexOf(s.ownSeat))).length;
 return {version:VERSION,phase,publicFacts:{round:s.round,honba:s.honba,kyotaku:s.kyotaku,pendingReach:s.pendingReach,ownSeat:s.ownSeat,activeSeat:s.activeSeat,hand:s.hand.slice(),drawn:s.drawn??null,ownMelds:s.selfMelds.slice(),doraIndicators:s.dora.slice(),remaining:s.remaining,scores,rank,rivers,events:s.publicEvents.map(publicEvent),reaction:reaction?{from:reaction.from,tile:reaction.tile}:null,legalActions:actions,ownRiverGenbutsu:safety},externalEstimate:{status:'suppressed_unvalidated_P1'},hypothesis:{status:'not_established',note:'相手の聴牌・待ち・打点・危険度・期待損失・推奨理由は確定しない。現物は当該他家へのロンについてのみ。'},release:'research_preparation_only'};
}
// An optional matched model result is a separate external reference, NOT a
// reason, physical quantity or safety verdict. No new policy selection here.
export function attachMortalReference(facts,key,expectedDecisionId){
 const out={...facts};
 const q=key?.q;
 const validKey=typeof expectedDecisionId==='string'&&expectedDecisionId.length>0&&key?.id===expectedDecisionId&&key.phase===facts.phase&&key.model_sha256==='30381bf21389e2d25d3edf48fed11bf772336ef3daeee67d1bdae7fb9dd30cb4'&&Array.isArray(q)&&q.length===46&&q.every(x=>x===null||typeof x==='number'&&Number.isFinite(x));
 if(!validKey)return {...out,mortalReference:{status:'unavailable'}};
 const legal=facts.publicFacts.legalActions.map(a=>a.id).sort((a,b)=>a-b);
 const model=q.flatMap((v,i)=>v===null?[]:[i]);
 if(JSON.stringify(legal)!==JSON.stringify(model)||!legal.includes(key.best)||q[key.best]!==Math.max(...legal.map(i=>q[i])))return {...out,mortalReference:{status:'unavailable'}};
 const ordered=legal.slice().sort((a,b)=>q[b]-q[a]||a-b);
 return {...out,mortalReference:{status:'matched_group_only',recommendedAction:key.best,tiedBest:ordered.filter(i=>q[i]===q[key.best]),orderedActions:ordered,note:'Mortalの合法行動グループ順位。Q差・内部理由・牌変種・立直後打牌はこの資料で未認証。'}};
}
