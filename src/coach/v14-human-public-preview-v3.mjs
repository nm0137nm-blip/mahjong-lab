// Human-only companion to frozen machine-readable public request.
// This is a faithful display of selected public records and selected derived
// calculation records, NOT an additional independent source or tactical answer.
// No hidden opponent hands, private verifier-only data, S42 Q or labels.
const get=(i,id)=>i.evidence.find(x=>x.id===id)?.value;
const winds=['東','南','西','北','白','發','中'];
function tile(s){
 if(typeof s!=='string')return String(s);
 const m=/^([mpsz])([0-9])/.exec(s);
 if(!m)return s;
 const n=m[2]==='0'?'赤5':m[2];
 if(m[1]==='z')return winds[Number(m[2])-1]??s;
 return n+(m[1]==='m'?'萬':m[1]==='p'?'筒':'索');
}
const printed=x=>x===null||x===undefined?'未計算':String(x);
export function renderV3PublicScene(envelope){
 const i=envelope?.request?.input;if(!i||!Array.isArray(i.evidence)||!Array.isArray(i.actions))throw Error('invalid public scene');
 const board=get(i,'board'),own=get(i,'own'),dora=get(i,'dora'),rivers=[0,1,2,3].map(n=>get(i,'seat-'+n));
 if(!board||!own||rivers.some(x=>!x))throw Error('incomplete public projection');
 const lines=['# 麻雀LAB 開発用問題：'+i.id,'',
  '## 局面',
  board.round+'／'+board.honba+'本場／供託'+board.kyotaku+'本／残り'+board.remaining+'牌。自分は席'+board.ownSeat+'（現在'+board.rank+'位）。',
  '点棒：'+board.scores.map(x=>'席'+x.seat+' '+x.points.toLocaleString('ja-JP')+'点').join('、'),
  'ドラ表示牌：'+own.doraIndicators.map(tile).join(' ')+'（ドラ：'+(dora?.actualDora??[]).map(tile).join(' ')+'）',
  '自分の手牌：'+own.hand.map(tile).join(' ')+' ／ 今回ツモ：'+printed(own.drawn===null?null:tile(own.drawn)),
  '自分の副露：'+(own.melds?.length?own.melds.join('、'):'なし'), '',
  '## 他の3人の公開情報'];
 for(const river of rivers.filter(x=>x.seat!==board.ownSeat)){
  const p=get(i,'public-value-'+river.seat);
  const riverText=river.discards.map(x=>tile(x.tile)+(x.tsumogiri?'（ツモ切）':'')+(x.riichi?'（立直宣言）':'')).join(' ');
  lines.push('### 席'+river.seat,
   '点数 '+board.scores[river.seat].points+'点／立直 '+(river.riichi?'あり':'なし')+
   '／副露 '+(river.melds.length?river.melds.join('、'):'なし'),
   '捨て牌：'+(riverText||'なし'),
   '公開副露のドラ'+printed(p?.exposedDoraHan)+'翻・役牌'+printed(p?.exposedYakuhaiHan)+'翻（隠し手の強さ・聴牌を意味しない）','');
 }
 lines.push('## 選べる行動','下記は合法候補と自分の形だけです。推奨順位やMortalの正解ではありません。','');
 for(const a of i.actions){
  const c=get(i,'calc-'+a.key);
  const group=a.group===37?'立直':a.group===45?'スルー':a.group===43?'ロン':a.group>=38&&a.group<=42?'鳴き／カン':'打牌';
  let suffix='';
  if(c&&Number.isInteger(c.shanten))suffix='／向聴'+c.shanten+'／受入上限'+printed(c.ukeireUpperBound)+'枚／保持ドラ'+printed(c.retainedDoraHan)+'翻';
  if(c?.afterCallDiscards)suffix='／鳴いた後の合法な打牌：'+c.afterCallDiscards.map(x=>tile(x.discard)).join('、');
  lines.push('- '+a.key+'：'+group+' '+a.detail+suffix);
 }
 lines.push('', '## この問題で比較したいこと',
  '選択候補それぞれの速さ・打点・現物・守備の自由度と、席ごとの公開状況、順位が変わり得る条件を比較してください。',
  '計算に出ていない和了率・放銃率・他家の手牌は不明です。ここに書かれた点数は現時点での確定利益ではありません。',
  'JSON原本には各候補の条件付き得点や仮の点棒移動など、答えを機械で確認するための細かい情報が含まれます。',
  'この人間向けメモは補助表示です。**回答時には同封のJSON原本の情報だけに従い、メモだけで回答しないでください。**');
 return lines.join('\n')+'\n';
}
