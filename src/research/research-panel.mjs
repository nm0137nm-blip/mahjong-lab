import {createDecisionResearch,buildResearchQuery} from './research-core.mjs';
import {publicUnseenWaits,makeUnseenQuery} from './unseen-wait-query.mjs';
const unseenHash='bea9c1ff502851c7a18168619bd24ee7333efc0826d1ccdbeb5a2e9d7e433e9c';
// The private data pack is loaded in memory only; no upload, storage or network.
const packHash='412c8f711270d1fb74620440e7fcdb503b9f39814816432b6f2b8c897b312d44';
const canonical=x=>x&&typeof x==='object'?(Array.isArray(x)?'['+x.map(canonical).join(',')+']':'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}'):JSON.stringify(x);
const names={shape:'待ち形',dealer:'親子',band:'巡目',scoreBand:'参考打点帯'};
const shapeLabels={ryanmen_only:'両面のみ',mixed:'両面とその他の複合',no_ryanmen:'両面なし'};
const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e};
export function createResearchPanel({M,dialog,body,readCurrent,isCurrent,tileName,onClose=()=>{}}){
 let pack=null,query=null,unseenQuery=null,context=null,session=null,token=null;
 function close(){const wasOpen=!!context;dialog.classList.add('hidden');body.replaceChildren();context=null;session?.invalidate();session=null;token=null;if(wasOpen)onClose();}
 function sync(){if(context&&!isCurrent(context.key))close()}
 function showError(msg){body.replaceChildren(node('p',msg));}
 async function load(file,ctx){
  if(!file||file.size>2_000_000)throw Error('研究ファイルのサイズが不正です。');
  if(!globalThis.crypto?.subtle)throw Error('安全な接続が必要です（HTTPS）。');
  const bytes=await file.arrayBuffer();const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
  if(hash!==packHash)throw Error('研究ファイルの版またはハッシュが一致しません。');
  const v=JSON.parse(new TextDecoder().decode(bytes));if(v.schema!=='mahjong-lab-research-pack-v1'||v.ruleProfile!=='tenhou-ranked-4p-red-hanchan-v1')throw Error('研究ファイルの形式が不正です。');
  const q=buildResearchQuery(v.v3,v.v4);
  if(context!==ctx||!isCurrent(ctx.key))return;pack=v;query=q;render(ctx);
 }
 function render(ctx){
  if(context!==ctx||!isCurrent(ctx.key)){close();return;}
  body.replaceChildren();body.append(node('p','S42自己対局970半荘の探索的統計。人間卓の確率や立直の最適性ではありません。'));
  if(!pack){const label=node('label','研究データ（JSON・端末内で読み込み）');const input=node('input');input.type='file';input.accept='.json,application/json';input.id='researchPackInput';label.htmlFor=input.id;const msg=node('p');msg.setAttribute('role','status');input.addEventListener('change',async()=>{try{msg.textContent='検証中';await load(input.files?.[0],ctx)}catch(e){if(context===ctx&&isCurrent(ctx.key))msg.textContent=e.message}});body.append(label,input,msg);return;}
  try{
   const snapshot=readCurrent(ctx.key);if(canonical(snapshot.rule)!==canonical(pack.rule)){body.append(node('p','このルールでは研究統計を利用できません。'));return;}
   const timing=snapshot.timing??'during',mode=snapshot.mode??'coach';
   session=createDecisionResearch({M,rule:snapshot.rule,query,mode});
   const read=()=>({publicCase:snapshot.publicCase,legalRiichiDiscards:snapshot.legalRiichiDiscards});
   if(timing==='after'){session.finishMatch();token=session.beginReview(read);}
   else if(timing==='during'){token=session.beginDecision(read);}
   else throw Error('invalid research timing');
   if(timing==='after')body.append(node('p','終局後の振り返り：判断当時の公開情報・合法候補のみを使用しています。'));
   const data=session.access(token);if(data.status!=='ready'){body.append(node('p','この局面に対応する研究統計はまだありません。'));return;}
   const label=node('label','立直候補');const select=node('select');select.id='researchCandidate';label.htmlFor=select.id;for(const c of data.candidates){const o=node('option',tileName(c.discard)+(c.discard.endsWith('_')?'（ツモ切り）':'')+'を切る');o.value=c.discard;select.append(o)}
   if(timing==='after'&&snapshot.chosenDiscard&&data.candidates.some(c=>c.discard===snapshot.chosenDiscard))select.value=snapshot.chosenDiscard;
   const filters=node('fieldset');filters.append(node('legend','比較条件を明示的に広げる'));const controls=[];
   for(const k of Object.keys(names)){const l=node('label');const check=node('input');check.type='checkbox';check.value=k;l.append(check,document.createTextNode(names[k]+'を全体にする'));filters.append(l);controls.push(check)}
   const result=node('section');result.id='researchResult';result.setAttribute('aria-live','polite');body.append(label,select,filters,result);
   function draw(){if(context!==ctx||!isCurrent(ctx.key)){close();return;}const omitted=controls.filter(x=>x.checked).map(x=>x.value);const r=session.lookup(token,select.value,omitted);result.replaceChildren();const f=r.candidate.filter;result.append(node('p',(f.role==='first'?'先制':'追いかけ')+'・'+shapeLabels[f.shape]+'・'+(f.dealer?'親':'子')+'・'+r.candidate.turn+'巡目'),node('p','仮の最低〜最高子相当ロン点：'+r.candidate.score.min.toLocaleString()+'〜'+r.candidate.score.max.toLocaleString()+'点'));if(omitted.length)result.append(node('p','検索では全体に変更：'+omitted.map(k=>names[k]).join('、')));
    if(r.status==='no_exact_cell'){result.append(node('p','この条件の集計はありません。条件を広げる場合は上で明示的に変更してください。'));return;}
    result.append(node('p',r.data.n+'件／'+r.data.matches+'半荘／'+r.data.hands+'局'));for(const [k,n] of [['win','和了率'],['deal','放銃率'],['tsumo','被ツモ率']]){const m=r.data.metrics[k];result.append(node('p',n+'：'+(m.status==='supported_descriptive'?m.percent.toFixed(1)+'%（95% CI '+m.ci95.map(x=>x.toFixed(1)).join('〜')+'%）':'標本不足')))}result.append(node('p','受理済立直に条件付き。宣言牌の放銃リスク・ダマとの差・段位ptの期待値は含みません。'));
   }
   const extra=node('section');extra.id='unseenWaitSection';body.append(extra);
   function drawUnseen(){
    if(context!==ctx||!isCurrent(ctx.key))return;
    extra.replaceChildren();extra.append(node('h3','未見待ち枚数の研究'));
    try{
     const u=publicUnseenWaits(M,snapshot.publicCase.scene,select.value);
     const f=data.candidates.find(c=>c.discard===select.value).filter;
     if(u.shape!==f.shape)throw Error('wait shape mismatch');
     extra.append(node('p','未見 '+u.unseen+'枚（他家手牌・王牌を含む可能性。山残り枚数ではない）'));
     if(!unseenQuery){
      const label=node('label','未見枚数研究ファイル（JSON）'),input=node('input'),msg=node('p');input.id='unseenPackInput';input.type='file';input.accept='.json,application/json';label.htmlFor=input.id;msg.setAttribute('role','status');
      input.addEventListener('change',async()=>{try{
       const file=input.files?.[0];if(!file||file.size>500000||!globalThis.crypto?.subtle)throw Error('安全な接続と研究ファイルが必要です。');
       const bytes=await file.arrayBuffer(),digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
       if(digest!==unseenHash)throw Error('未見枚数ファイルのハッシュが一致しません。');
       const q=makeUnseenQuery(JSON.parse(new TextDecoder().decode(bytes)));if(context!==ctx||!isCurrent(ctx.key))return;unseenQuery=q;drawUnseen();
      }catch(e){if(context===ctx&&isCurrent(ctx.key))msg.textContent=e.message;}});
      extra.append(label,input,msg);return;
     }
     const axis=node('select');axis.id='unseenAxis';const label=node('label','未見枚数と組み合わせる条件');label.htmlFor=axis.id;
     for(const [k,v] of [['none','先制/追いかけ・未見枚数のみ'],['shape','待ち形を追加'],['band','巡目を追加']]){const o=node('option',v);o.value=k;axis.append(o);}
     const output=node('section');output.id='unseenResult';output.setAttribute('aria-live','polite');extra.append(label,axis,output);
     const show=()=>{if(context!==ctx||!isCurrent(ctx.key))return;const q=unseenQuery({role:f.role,unseenBand:u.unseenBand,shape:axis.value==='shape'?f.shape:null,band:axis.value==='band'?f.band:null},mode,timing);output.replaceChildren();
      if(q.status!=='descriptive_only'){output.append(node('p','該当する集計はありません。'));return;}
      output.append(node('p',q.n+'件／'+q.matches+'半荘／'+q.hands+'局'));
      for(const [k,n] of [['win','和了率'],['deal','放銃率'],['tsumo','被ツモ率']]){const m=q.metrics[k];output.append(node('p',n+'：'+(m.status==='supported'?m.pct.toFixed(1)+'%（95% CI '+m.ci95.map(v=>v.toFixed(1)).join('〜')+'%）':'標本不足')));}
      output.append(node('p','受理済立直のS42記述統計。打点帯・親子はこの集計の条件に含まれません。'));
     };axis.addEventListener('change',show);show();
    }catch(e){extra.append(node('p','未見枚数の検証に失敗したため表示しません。'));}
   }
   select.addEventListener('change',()=>{draw();drawUnseen()});for(const c of controls)c.addEventListener('change',draw);draw();drawUnseen();
  }catch(e){showError('現在の局面は研究対象外、または検証に失敗しました。');}
 }
 return Object.freeze({open(ctx){close();if(!isCurrent(ctx))return false;context={key:ctx};dialog.classList.remove('hidden');render(context);dialog.querySelector('button')?.focus();return true;},close,sync,isOpen:()=>!!context});
}
