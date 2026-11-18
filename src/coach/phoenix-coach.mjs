import {strategyInstructions,curriculumVersion} from './strategy-curriculum.mjs?v=257';
import {relativeInstructions,relativeVersion} from './relative-instructions.mjs?v=257';
export const VERSION='Phoenix-v4.2-20261118-dev';
const valid=p=>typeof p==='string'&&/^(?:[mps][0-9]|z[1-7])$/.test(p);
const norm=p=>p[0]+(p[1]==='0'?'5':p[1]);
const types=[...('mps')].flatMap(s=>Array.from({length:9},(_,i)=>s+(i+1))).concat(Array.from({length:7},(_,i)=>'z'+(i+1)));
const validSeat=l=>Number.isInteger(l)&&l>=0&&l<4;
const meldValid=m=>typeof m==='string'&&/^[mpsz][0-9+=-]{3,6}$/.test(m);
const meldTiles=m=>[...m.slice(1).matchAll(/\d/g)].map(x=>m[0]+x[0]);
export function nextPublicEvents(previous,msg){
 if(msg?.qipai||msg?.kaiju)return [];
 const rows=Array.isArray(previous)?previous:[];
 for(const k of ['zimo','gangzimo','dapai','fulou','gang','kaigang']){
  const e=msg?.[k];if(!e)continue;
  if(k==='kaigang'){
   if(!valid(e.baopai))return rows;
   return [...rows,{種類:'ドラ表示追加',牌:e.baopai}];
  }
  if(!validSeat(e.l))return rows;
  if(k==='zimo'||k==='gangzimo')return [...rows,{種類:k==='zimo'?'自摸':'嶺上自摸',席:e.l}]; // never record a drawn tile
  if(k==='dapai'&&typeof e.p==='string'&&valid(e.p.slice(0,2)))return [...rows,{種類:'打牌',席:e.l,牌:e.p.slice(0,2),ツモ切り:e.p.includes('_'),立直宣言:e.p.includes('*')}];
  if((k==='fulou'||k==='gang')&&meldValid(e.m))return [...rows,{種類:k==='fulou'?'副露':'槓',席:e.l,面子:e.m}];
 }
 return rows;
}
function knownCounts(v){
 if(v?.snapshotVersion!==2||!Array.isArray(v.hand)||v.rivers?.length!==4||!Array.isArray(v.dora))return null;
 const c=Object.fromEntries(types.map(p=>[p,0]));let bad=false;
 function add(p){if(!valid(p)){bad=true;return;}c[norm(p)]++;}
 for(const p of v.hand)add(p);
 for(const r of v.rivers){
  if(!Array.isArray(r.discards)||!Array.isArray(r.melds))return null;
  for(const d of r.discards)if(!d.called)add(d.tile);
  for(const m of r.melds){if(!meldValid(m)){bad=true;continue;}for(const p of meldTiles(m))add(p);}
 }
 for(const p of v.dora)add(p);
 return bad||Object.values(c).some(n=>n>4)?null:c;
}
function shoupai(M,tiles,melds){
 if(!Array.isArray(tiles)||!tiles.every(valid)||!Array.isArray(melds)||!melds.every(meldValid))return null;
 if(tiles.length+3*melds.length!==13)return null;
 const s=M.Shoupai.fromString(tiles.join('')+(melds.length?','+melds.join(','):''));
 return s._fulou.length===melds.length?s:null;
}
function metric(M,h,c){
 const n=M.Util.xiangting(h),waits=Array.from(M.Util.tingpai(h)||[]).map(norm).filter(p=>c[p]<4);
 return {向聴:n,受け入れ:waits.reduce((sum,p)=>sum+4-c[p],0),有効牌:waits.map(p=>({牌:p,残上限:4-c[p]}))};
}

// Distinguish structural tenpai, live upper-bound, yaku, and own-river furiten.
// Special event yaku, temporary furiten, red winning tile and hidden draw locations
// are deliberately not inferred. Hule is evaluated on a normal non-red tile.
export function shapeFacts(M,h,c,v,discard=null){
 const U=M.Util;
 const forms={一般形:U.xiangting_yiban,七対子:U.xiangting_qidui,国士無双:U.xiangting_guoshi};
 const split=Object.fromEntries(Object.entries(forms).map(([k,f])=>{
  const n=f(h);return [k,Number.isFinite(n)?n:null];
 }));
 const out={門前:h.menqian,向聴内訳:split,注記:'nullは形として不可。各向聴は役の成立や和了率を示さない。'};
 if(U.xiangting(h)!==0)return out;
 const waits=Array.from(U.tingpai(h)||[]).map(norm);
 const river=v.rivers?.[v.ownSeat]?.discards;
 const own=Array.isArray(river)?new Set(river.map(d=>norm(d.tile))):null;
 if(own&&discard)own.add(norm(discard));
 const hit=own?waits.filter(p=>own.has(p)):null;
 const wind='東南西北'.indexOf(String(v.round||'')[0]);
 const param=wind>=0&&validSeat(v.ownSeat)?U.hule_param({zhuangfeng:wind,menfeng:v.ownSeat,baopai:v.dora||[],rule:M.rule({'クイタンあり':true})}):null;
 const roles=x=>x?.defen>0?x.hupai.filter(y=>!['ドラ','赤ドラ','裏ドラ'].includes(y.name)).map(y=>y.name):[];
 out.形式待ち=waits.map(p=>{
  const row={牌:p,残上限:Math.max(0,4-c[p])};
  if(param){
   row.通常ロン役=roles(U.hule(h,p+'+',param));
   row.通常ツモ役=roles(U.hule(h.clone().zimo(p),null,param));
  }
  return row;
 });
 out.自己河フリテン該当牌=hit;
 out.自己河フリテン=hit===null?null:hit.length>0;
 out.立直なし通常和了注記='形式待ち全体で自己河フリテンを判定（残上限0の待ち、今回切る牌、鳴かれた自分の捨牌も含む）。自己河フリテンなら全待ちでロン不可。過去の見逃し・同巡フリテン・立直後見逃しは別で未判定。役リストは立直・一発・海底等を付けない通常和了の仮定、赤5の和了は通常5で代表。役があっても実際のロン・ツモ合法性、残存場所、点数を保証しない。門前なら合法な立直で役を得る経路は別途検討。';
 return out;
}

function twoDraw(M,h,c){
 const base=metric(M,h,c);
 if(base.向聴<1)return null;
 const rows=base.有効牌.map(({牌,残上限})=>{
  const after=h.clone().zimo(牌);
  const counts={...c,[牌]:c[牌]+1};
  const choices=Array.from(after.get_dapai()||[]).map(p=>{
   const next=after.clone().dapai(p),m=metric(M,next,counts);
   return {打牌:p,牌姿:next.toString(),...m};
  }).sort((a,b)=>a.向聴-b.向聴||b.受け入れ-a.受け入れ||a.打牌.localeCompare(b.打牌));
  const best=choices[0];if(!best||best.向聴!==base.向聴-1)throw Error('shanten progression');
  return {ツモ:牌,残上限,次の向聴:best.向聴,次の受け入れ:best.受け入れ,打牌例:best.打牌,牌姿例:best.牌姿,組合せ:残上限*best.受け入れ};
 });
 return {組合せ数:rows.reduce((n,r)=>n+r.組合せ,0),内訳:rows};
}
function doraHan(tiles,dora){return tiles.reduce((n,p)=>n+(p[1]==='0'?1:0)+dora.filter(d=>d===norm(p)).length,0);}
function opponentFacts(v,dora,c){
 const roundWind=String(v.round||'').startsWith('南')?'z2':'z1';
 return v.rivers.map((r,l)=>{
  const all=r.melds.flatMap(meldTiles);
  const yakuhai=r.melds.reduce((n,m)=>{
   const t=meldTiles(m).map(norm);
   if(t.length<3||!t.every(p=>p===t[0])||t[0][0]!=='z')return n;
   const p=t[0];return n+(Number(p[1])>=5?1:0)+(p===roundWind?1:0)+(p==='z'+(l+1)?1:0);
  },0);
  const gen=[...new Set(r.discards.map(d=>norm(d.tile)))].sort();
  return {席:l,自分:l===v.ownSeat,立直宣言済:!!r.riichi,副露:r.melds.slice(),公開ドラ翻:doraHan(all,dora),公開役牌翻:yakuhai,捨牌種類:gen,直近手出し:r.discards.filter(d=>!d.tsumogiri).slice(-4).map(d=>d.tile),注記:'公開副露だけの確定翻材料。テンパイ・全打点・他家の隠し手は不明。本人の河の牌は現物（同種赤5含む）。'};
 });
}
// Pure geometry: these are shapes that could accept the tile, NOT actual
// opponent waits, danger probabilities, or proof that a yaku exists.
export function sequenceWaitShapes(tile){
 if(!valid(tile)||tile[0]==='z')return [];
 const p=norm(tile),n=Number(p[1]),s=p[0],out=[];
 for(let start=1;start<=7;start++){
  const seq=[start,start+1,start+2];if(!seq.includes(n))continue;
  const shape=seq.filter(x=>x!==n);
  const kind=n===start+1?'嵌張':(n===3&&start===1||n===7&&start===7)?'辺張':'両面';
  out.push({牌姿:s+shape.join(''),待ち形:kind});
 }
 return out;
}
export function rankFacts(v){
 if(!validSeat(v.ownSeat)||v.scores?.length!==4||v.scores.some(x=>!Number.isFinite(x.points))||!Array.isArray(v.initialOrder)||v.initialOrder.length!==4||new Set(v.initialOrder).size!==4||!v.initialOrder.every(validSeat)||!Number.isInteger(v.honba)||!Number.isInteger(v.kyotaku)||v.pendingReach)return null;
 const own=v.ownSeat,base=v.scores.map(x=>x.points),h=v.honba,k=v.kyotaku;
 const rank=a=>1+[0,1,2,3].filter(i=>i!==own&&(a[i]>a[own]||a[i]===a[own]&&v.initialOrder.indexOf(i)<v.initialOrder.indexOf(own))).length;
 const other=[0,1,2,3].filter(i=>i!==own);
 const rows=[];
 for(const [child,parent] of [[1000,1500],[3900,5800],[7700,11600],[8000,12000]]){
  for(const l of other){
   const win=base.slice(),lose=base.slice();
   const gain=(own===0?parent:child)+300*h,loss=(l===0?parent:child)+300*h;
   win[own]+=gain+1000*k;win[l]-=gain;
   lose[own]-=loss;lose[l]+=loss+1000*k;
   rows.push({相手:l,仮ロン基本点:(own===0?parent:child),自分和了後点棒:win,自分和了後順位:rank(win),仮放銃基本点:(l===0?parent:child),放銃後点棒:lose,放銃後順位:rank(lose)});
  }
 }
 // Explicit sample legal base tsumo payments, independent of actual hand yaku.
 const tsumo=[];
 for(const l of [0,1,2,3]){
  for(const unit of [500,1000,2000]){
   const score=base.slice();
   for(const i of [0,1,2,3])if(i!==l){const pay=(l===0||i===0?unit*2:unit)+100*h;score[i]-=pay;score[l]+=pay;}
   score[l]+=1000*k;
   tsumo.push({和了者:l,子支払基本点:l===0?unit*2:unit,親支払基本点:l===0?null:unit*2,点棒:score,自分順位:rank(score)});
  }
 }
 return {現在順位:rank(base),ロンと放銃:rows,ツモ:tsumo,注記:'例示した基本点を用いる仮の点棒移動。本場供託込み。自手や相手が実際にこの打点で和了できることや終局を保証しない。未成立リーチがあれば計算しない。'};
}
function safeEvents(rows){
 if(!Array.isArray(rows))return null;
 return rows.flatMap(e=>{
  if(e?.種類==='ドラ表示追加'&&valid(e.牌))return [{種類:e.種類,牌:e.牌}];
  if(!validSeat(e?.席))return [];
  if(['自摸','嶺上自摸'].includes(e.種類))return [{種類:e.種類,席:e.席}];
  if(e.種類==='打牌'&&valid(e.牌))return [{種類:e.種類,席:e.席,牌:e.牌,ツモ切り:!!e.ツモ切り,立直宣言:!!e.立直宣言}];
  if(['副露','槓'].includes(e.種類)&&meldValid(e.面子))return [{種類:e.種類,席:e.席,面子:e.面子}];
  return [];
 });
}
export function buildEvidence(entry,M){
 const v=entry?.scene;if(!v||!M?.Util)return null;
 const dora=(v.dora||[]).filter(valid).map(p=>M.Shan.zhenbaopai(p));
 const c=knownCounts(v);
 const out={実ドラ:dora,赤ドラ:'0は赤5、実ドラと重複計上する',判断時点の公開時系列:safeEvents(v.publicEvents),計算制約:'見え枚数は残存上限。和了率・放銃率・好形率・期待値は未計算。公開情報から他家の聴牌・待ちを確定しない。'};
 if(!c){out.欠落='完全な河・副露・見え枚数を確定できず、二次変化と相手別事実の計算は省略';return out;}
 out.見え枚数=c;out.各家公開事実=opponentFacts(v,dora,c);
 out.点棒変動例=rankFacts(v);
 const candidates=(entry.candidates||[]).filter(x=>valid(x?.p?.slice(0,2))&&Number.isFinite(x.shanten)&&x.shanten!==99);
 const ranked=candidates.slice().sort((a,b)=>a.shanten-b.shanten||b.ukeire-a.ukeire||a.p.localeCompare(b.p));
 const keys=new Set(),selected=[];
 for(const x of [candidates.find(x=>x.p===entry.discard),candidates.find(x=>x.p.slice(0,2)===entry.mortalOpinion?.tile?.slice(0,2)),...ranked]){
  if(!x||keys.has(x.p.slice(0,2)))continue;keys.add(x.p.slice(0,2));selected.push(x);if(selected.length>=4)break;
 }
 out.候補別牌姿=candidates.map(x=>{
  const h=shoupai(M,x.handTiles,x.melds);
  if(!h)return {打牌:x.p,牌姿:null};
  const result={打牌:x.p,打牌後:h.toString(),...metric(M,h,c),保持ドラ翻:doraHan([...x.handTiles,...x.melds.flatMap(meldTiles)],dora),順子待ち形の幾何学的候補:sequenceWaitShapes(x.p.slice(0,2)),相手別現物:v.rivers.map((r,l)=>({席:l,現物:r.discards.some(d=>norm(d.tile)===norm(x.p))})).filter(x=>x.席!==v.ownSeat)};
  result.形と和了条件=shapeFacts(M,h,c,v,x.p);
  if(selected.includes(x))result.二連続向聴改善=twoDraw(M,h,c);
  return result;
 });
 if(entry.legalChoices?.phase==='reaction'){
  const h=shoupai(M,v.hand,v.selfMelds||[]);
  if(h){
   out.スルー後={...metric(M,h,c),形と和了条件:shapeFacts(M,h,c,v)};
   out.鳴き候補=(['chi','pon'].flatMap(k=>entry.legalChoices[k]||[])).filter(meldValid).map(m=>{
    const after=h.clone().fulou(m);
    const rows=Array.from(after.get_dapai()||[]).map(p=>{const sh=after.clone().dapai(p);return {打牌:p,打牌後:sh.toString(),...metric(M,sh,c),形と和了条件:shapeFacts(M,sh,c,v,p),順子待ち形の幾何学的候補:sequenceWaitShapes(p.slice(0,2)),相手別現物:v.rivers.map((r,l)=>({席:l,現物:r.discards.some(d=>norm(d.tile)===norm(p))})).filter(x=>x.席!==v.ownSeat)};});
    return {副露:m,合法打牌:rows};
   });
   out.槓注記='カン後の嶺上牌・新ドラは不明のため計算しない。';
  }
 }
 out.二次変化の定義='本人の選択・S42打牌候補・直接牌効率上位から最大4牌種のみ。連続する2回の自ツモで向聴が下がる牌の組合せ数。1回目のツモ後は向聴最小・受け入れ最大を選ぶ。手変わり・鳴き・守備・打点・相手の進行・赤5の新規ツモ差を含まない。掲載されない候補を劣るとみなさない。';
 return out;
}
const evidenceCache=new WeakMap();
export function buildPrompt(legacy,entry,M){
 const marker='\n\n【判断時点の記録】\n',i=legacy.indexOf(marker);
 if(i<0)return legacy;
 const end=legacy.indexOf('\n\n【追加で確認したい点】',i+marker.length);
 const data=JSON.parse(legacy.slice(i+marker.length,end<0?undefined:end));
 const question=end<0?'':legacy.slice(end);
 // Keep S42 at the end. Single-prompt instruction is not a blind comparison.
 const q=data.S42;delete data.S42;
 const key=entry.mortalOpinion?.tile??null;
 let cached=evidenceCache.get(entry);
 if(!cached||cached.key!==key){cached={key,value:buildEvidence(entry,M)};evidenceCache.set(entry,cached);}
 data.コーチ計算情報=cached.value;data.S42=q;
 const intro=[
 'あなたは天鳳の鳳凰位レベルの知識・判断力を目標とする四人麻雀コーチです。実際の資格やMortal内部理由は主張しない。',
 '目的：鳳凰卓に通用する判断力を育てる。相対評価に基づき、合法な選択から自分なら選ぶ最善手を原則一つ提示する。僅差でも結論を出し確信度を区別。打ち手の理由を検討し、誤りは具体的に指摘する。',
 '事実を厳守：実ドラと表示牌を区別。打牌後の牌姿にない牌を根拠にしない。二度受けと三面張を混同しない。変化は具体的なツモ・打牌・牌姿を示す。データ不足を明記し条件付きで判断。役や危険度は事実と仮説を区別。未知の確率・点数を捏造しない。',
 strategyInstructions(),relativeInstructions,
 '実力試験の反省：一般形・七対子・国士の向聴を分け、形式テンパイと役あり和了の距離を区別する。自己河フリテンがあれば残存する他の待ちでもロン不可。既に副露した手に門前維持という利益を帰属させない。与えられた二次変化数と受け入れを比較に使い、未計算の役・打点との交換条件を具体化する。複数の有力和了経路（門前、役牌、喰いタン、染め、三色等）は候補ごとに必要なツモ・副露・切る牌を示し、成立済みの役と将来の仮説を区別する。',
 '追加監査からの注意：順子待ちの分類は牌の並びを照合する（12で3、89で7は辺張、68で7は嵌張、56で7は両面）。計算情報の順子待ち形候補は幾何学的な可能性のみで、相手の実際の待ちや安全度ではない。順位は点棒移動後の全員を並べ直す。現3着だけでなく放銃者が下位に転落する可能性にも注意。放銃者が不明なら相手別に最善手を提示してよい。小差・未計算の打点経路・河不足では推奨を明示しても確信度は中以下とする。',
 '回答形式：①最善手・自手の相対価値（高/中/低）・確信度・選択評価S/A/B/C/D ②この局の目的と他家別の脅威（事実/推測）③自手と他家の速度・打点・危険の比較、選択の決め手と代償 ④打ち手の思考への具体的な助言、結論を変える条件 ⑤S42への見解。無関係な原則や一般論を列挙しない。不一致だけで悪手判定しない。',
 '牌コード m萬 p筒 s索 z1〜7東南西北白發中、0赤5、_ツモ切り、+下家 =対面 -上家、席0親。麻雀LABは延長なし、オーラス親単独トップ止め、トビ終了あり。S42のQは点数・確率ではなく、Softmax温度0.1の推奨度は誤打の重大性ではない。',
 '版：'+VERSION+' / '+curriculumVersion+' / '+relativeVersion
 ];
 return intro.join('\n')+marker+JSON.stringify(data,null,2)+question;
}
