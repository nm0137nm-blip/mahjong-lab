import {makeAllLastQuery} from './alllast-query.mjs';
const expected='0e3f0dd2ed26d571a6a74154658a22bad71cae574a228e494913273a59be91f5';
const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e};
const labels={all:'開始順位のみ',dealer:'開始順位・親子',gap:'開始順位・競合との点差'};
export function createAllLastPanel({dialog,body,read,isCurrent,onClose=()=>{}}){
 let active=null,query=null;
 function close(){const was=!!active;active=null;dialog.classList.add('hidden');body.replaceChildren();if(was)onClose();}
 function sync(){if(active&&!isCurrent(active.key))close();}
 function render(ctx){
  if(active!==ctx||!isCurrent(ctx.key)){close();return;}
  body.replaceChildren();body.append(node('p','最初の南4局開始時点に限定。S42自己対局970半荘中、南4局に到達した710半荘。人間卓の確率・打牌の効果ではありません。'));
  if(!query){
   const label=node('label','南4局研究ファイル（JSON・端末内で検証）'),input=node('input'),msg=node('p');input.type='file';input.accept='.json,application/json';input.id='allLastPackInput';label.htmlFor=input.id;msg.setAttribute('role','status');
   input.addEventListener('change',async()=>{try{
    const f=input.files?.[0];if(!f||f.size>500000||!globalThis.crypto?.subtle)throw Error('研究ファイルまたは安全な接続が必要です。');
    const bytes=await f.arrayBuffer(),digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
    if(digest!==expected)throw Error('研究ファイルのハッシュが一致しません。');
    const candidate=makeAllLastQuery(JSON.parse(new TextDecoder().decode(bytes)));
    if(active!==ctx||!isCurrent(ctx.key))return;query=candidate;render(ctx);
   }catch(e){if(active===ctx&&isCurrent(ctx.key))msg.textContent=e.message;}});
   body.append(label,input,msg);return;
  }
  try{
   const {snapshot,mode,timing}=read(ctx.key);
   const select=node('select');select.id='allLastDimension';const label=node('label','研究条件');label.htmlFor=select.id;
   for(const [k,v] of Object.entries(labels)){const o=node('option',v);o.value=k;select.append(o);}
   select.value='gap';const output=node('section');output.id='allLastResult';output.setAttribute('aria-live','polite');body.append(label,select,output);
   const draw=()=>{
    if(active!==ctx||!isCurrent(ctx.key)){close();return;}
    const r=query(snapshot,select.value,mode,timing);output.replaceChildren();
    if(r.status!=='descriptive_only'){output.append(node('p','対局中は参照できません。'));return;}
    output.append(node('p','南4局開始時：'+r.filter.rank+'着・'+(r.filter.role==='parent'?'親':'子')+'・'+r.filter.near+'着との点差 '+r.filter.gap.toLocaleString()+'点'),node('p','検索条件：'+labels[r.dimension]+'（'+r.level+'）／'+r.n+'半荘'));
    for(const m of r.metrics)output.append(node('p',m.rank+'着：'+(m.status==='supported'?m.pct.toFixed(1)+'%（95% CI '+m.ci95.map(x=>x.toFixed(1)).join('〜')+'%）':'標本不足')));
    output.append(node('p','支持不足の順位は補完・再正規化しません。親連荘・西入を含む最終順位。現在の点棒ではなく南4局開始時の情報を使用。押し引き判断の期待値ではありません。'));
   };
   select.addEventListener('change',draw);draw();
  }catch(e){body.append(node('p','この局面は研究対象外、または検証に失敗しました。'));}
 }
 return Object.freeze({open(key){close();if(!isCurrent(key))return false;active={key};dialog.classList.remove('hidden');render(active);dialog.querySelector('button')?.focus();return true},close,sync,isOpen:()=>!!active});
}
