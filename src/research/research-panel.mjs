import {createDecisionResearch,buildResearchQuery} from './research-core.mjs';
// The private data pack is loaded in memory only; no upload, storage or network.
const packHash='412c8f711270d1fb74620440e7fcdb503b9f39814816432b6f2b8c897b312d44';
const canonical=x=>x&&typeof x==='object'?(Array.isArray(x)?'['+x.map(canonical).join(',')+']':'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}'):JSON.stringify(x);
const names={shape:'待ち形',dealer:'親子',band:'巡目',scoreBand:'参考打点帯'};
const shapeLabels={ryanmen_only:'両面のみ',mixed:'両面とその他の複合',no_ryanmen:'両面なし'};
const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e};
export function createResearchPanel({M,dialog,body,readCurrent,isCurrent,tileName,onClose=()=>{}}){
 let pack=null,query=null,context=null,session=null,token=null;
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
   session=createDecisionResearch({M,rule:snapshot.rule,query,mode:'coach'});token=session.beginDecision(()=>({publicCase:snapshot.publicCase,legalRiichiDiscards:snapshot.legalRiichiDiscards}));
   const data=session.access(token);if(data.status!=='ready'){body.append(node('p','この局面に対応する研究統計はまだありません。'));return;}
   const label=node('label','立直候補');const select=node('select');select.id='researchCandidate';label.htmlFor=select.id;for(const c of data.candidates){const o=node('option',tileName(c.discard)+(c.discard.endsWith('_')?'（ツモ切り）':'')+'を切る');o.value=c.discard;select.append(o)}
   const filters=node('fieldset');filters.append(node('legend','比較条件を明示的に広げる'));const controls=[];
   for(const k of Object.keys(names)){const l=node('label');const check=node('input');check.type='checkbox';check.value=k;l.append(check,document.createTextNode(names[k]+'を全体にする'));filters.append(l);controls.push(check)}
   const result=node('section');result.id='researchResult';result.setAttribute('aria-live','polite');body.append(label,select,filters,result);
   function draw(){if(context!==ctx||!isCurrent(ctx.key)){close();return;}const omitted=controls.filter(x=>x.checked).map(x=>x.value);const r=session.lookup(token,select.value,omitted);result.replaceChildren();const f=r.candidate.filter;result.append(node('p',(f.role==='first'?'先制':'追いかけ')+'・'+shapeLabels[f.shape]+'・'+(f.dealer?'親':'子')+'・'+r.candidate.turn+'巡目'),node('p','仮の最低〜最高子相当ロン点：'+r.candidate.score.min.toLocaleString()+'〜'+r.candidate.score.max.toLocaleString()+'点'));if(omitted.length)result.append(node('p','検索では全体に変更：'+omitted.map(k=>names[k]).join('、')));
    if(r.status==='no_exact_cell'){result.append(node('p','この条件の集計はありません。条件を広げる場合は上で明示的に変更してください。'));return;}
    result.append(node('p',r.data.n+'件／'+r.data.matches+'半荘／'+r.data.hands+'局'));for(const [k,n] of [['win','和了率'],['deal','放銃率'],['tsumo','被ツモ率']]){const m=r.data.metrics[k];result.append(node('p',n+'：'+(m.status==='supported_descriptive'?m.percent.toFixed(1)+'%（95% CI '+m.ci95.map(x=>x.toFixed(1)).join('〜')+'%）':'標本不足')))}result.append(node('p','受理済立直に条件付き。宣言牌の放銃リスク・ダマとの差・段位ptの期待値は含みません。'));
   }
   select.addEventListener('change',draw);for(const c of controls)c.addEventListener('change',draw);draw();
  }catch(e){showError('現在の局面は研究対象外、または検証に失敗しました。');}
 }
 return Object.freeze({open(ctx){close();if(!isCurrent(ctx))return false;context={key:ctx};dialog.classList.remove('hidden');render(context);dialog.querySelector('button')?.focus();return true;},close,sync,isOpen:()=>!!context});
}
